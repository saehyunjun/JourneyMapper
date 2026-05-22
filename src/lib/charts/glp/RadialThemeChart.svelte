<script lang="ts" module>
	export type RadialBlock = { sentiment: number; interview_id: string };

	export type RadialNode = {
		id: string;
		label: string;
		count: number;
		blocks: RadialBlock[];
		kind: 'theme' | 'subtheme' | 'keyword';
		description?: string;
		children?: RadialNode[];
	};
</script>

<script lang="ts">
	import { arc } from 'd3-shape';
	import { scaleLinear } from 'd3-scale';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';

	let {
		tree,
		onselect,
		selected = null,
		unitLabel = 'tagged segments',
		blockLabel = 'tagged segment'
	}: {
		tree: RadialNode[];
		onselect?: (node: RadialNode) => void;
		selected?: string | null;
		unitLabel?: string;
		blockLabel?: string;
	} = $props();

	const SENTIMENT_COLORS: Record<number, string> = {
		[-2]: '#e11d48',
		[-1]: '#fb7185',
		0: '#cbd5e1',
		1: '#34d399',
		2: '#059669'
	};

	const SENTIMENT_LABEL: Record<number, string> = {
		[-2]: 'Strongly Negative',
		[-1]: 'Negative',
		0: 'Neutral / Mixed',
		1: 'Positive',
		2: 'Strongly Positive'
	};

	const SENTIMENT_ORDER = [-2, -1, 0, 1, 2];

	const THEME_PALETTE = [
		'#6366f1',
		'#0ea5e9',
		'#14b8a6',
		'#f59e0b',
		'#a855f7',
		'#ec4899',
		'#84cc16'
	];

	const SIZE = 820;
	const C = SIZE / 2;
	// The drawing is centred at (C, C); group + bar labels sit out near the edge of
	// SIZE, so a flush `0 0 SIZE SIZE` viewBox clips them. PAD adds breathing room on
	// every side while keeping the centre fixed, so nothing gets cut off.
	const PAD = 130;
	const VIEW = SIZE + PAD * 2;
	const R_GROUP_BAND_IN = 16;
	const R_GROUP_BAND_OUT = 24;
	const R_BAR_IN = 40;
	const R_BAR_MAX = 244;
	const R_THEME_LABEL = 265;
	const R_GROUP_LABEL = 415;
	const GROUP_GAP = 0.1;
	const ANIM_MS = 720;
	const DOUBLE_CLICK_MS = 260;

	type Indexed = {
		node: RadialNode;
		parent: RadialNode | null;
		theme: RadialNode | null;
	};

	const indexed = $derived.by(() => {
		const map = new Map<string, Indexed>();

		for (const t of tree) {
			map.set(t.id, { node: t, parent: null, theme: null });

			for (const s of t.children ?? []) {
				map.set(s.id, { node: s, parent: t, theme: t });

				for (const k of s.children ?? []) {
					map.set(k.id, { node: k, parent: s, theme: t });
				}
			}
		}

		return map;
	});

	const allNodes = $derived(Array.from(indexed.values()).map((x) => x.node));

	const themeColor = $derived.by(() => {
		const map = new Map<string, string>();
		tree.forEach((t, i) => map.set(t.id, THEME_PALETTE[i % THEME_PALETTE.length]));
		return map;
	});

	function colorFor(node: RadialNode): string {
		if (node.kind === 'theme') return themeColor.get(node.id) ?? '#94a3b8';

		const ix = indexed.get(node.id);
		const themeId = ix?.theme?.id;

		return (themeId && themeColor.get(themeId)) || '#94a3b8';
	}

	type View =
		| { kind: 'themes' }
		| { kind: 'subthemes'; themeId: string | null }
		| { kind: 'keywords'; subthemeId: string };

	let view = $state<View>({ kind: 'subthemes', themeId: null });

	type NodeFrame = {
		a0: number;
		a1: number;
		barOpacity: number;
		bandOpacity: number;
		count: number;
		blocks: RadialBlock[];
	};

	type Frames = Map<string, NodeFrame>;

	function hidden(): NodeFrame {
		return {
			a0: 0,
			a1: 0,
			barOpacity: 0,
			bandOpacity: 0,
			count: 0,
			blocks: []
		};
	}

	function layoutFor(v: View): Frames {
		const out: Frames = new Map();

		for (const id of indexed.keys()) {
			out.set(id, hidden());
		}

		if (v.kind === 'themes') {
			const themes = tree;
			const n = Math.max(1, themes.length);
			const per = (2 * Math.PI - n * GROUP_GAP) / n;

			let a = 0;

			for (const t of themes) {
				a += GROUP_GAP;

				out.set(t.id, {
					a0: a,
					a1: a + per,
					barOpacity: 1,
					bandOpacity: 0,
					count: t.count,
					blocks: t.blocks
				});

				a += per;
			}

			return out;
		}

		if (v.kind === 'subthemes') {
			const themes = v.themeId ? tree.filter((t) => t.id === v.themeId) : tree;

			const subsByTheme = themes.map((t) => ({
				theme: t,
				subs: (t.children ?? []).filter((s) => s.count > 0)
			}));

			const totalSubs = subsByTheme.reduce((n, x) => n + x.subs.length, 0);
			const groupCount = subsByTheme.filter((x) => x.subs.length > 0).length;

			if (totalSubs === 0 || groupCount === 0) return out;

			const per = (2 * Math.PI - groupCount * GROUP_GAP) / totalSubs;
			let a = 0;

			for (const { theme, subs } of subsByTheme) {
				if (subs.length === 0) continue;

				a += GROUP_GAP;
				const start = a;

				for (const s of subs) {
					out.set(s.id, {
						a0: a,
						a1: a + per,
						barOpacity: 1,
						bandOpacity: 0,
						count: s.count,
						blocks: s.blocks
					});

					a += per;
				}

				out.set(theme.id, {
					a0: start,
					a1: a,
					barOpacity: 0,
					bandOpacity: 1,
					count: theme.count,
					blocks: theme.blocks
				});
			}

			return out;
		}

		const ix = indexed.get(v.subthemeId);
		if (!ix) return out;

		const sub = ix.node;
		const kws = (sub.children ?? []).filter((k) => k.count > 0);

		if (kws.length === 0) return out;

		const per = (2 * Math.PI - GROUP_GAP) / kws.length;
		let a = GROUP_GAP;
		const start = a;

		for (const k of kws) {
			out.set(k.id, {
				a0: a,
				a1: a + per,
				barOpacity: 1,
				bandOpacity: 0,
				count: k.count,
				blocks: k.blocks
			});

			a += per;
		}

		out.set(sub.id, {
			a0: start,
			a1: a,
			barOpacity: 0,
			bandOpacity: 1,
			count: sub.count,
			blocks: sub.blocks
		});

		return out;
	}

	let progress = $state(1);
	let sourceFrames = $state<Frames>(new Map());
	let rafHandle = 0;

	const targetFrames = $derived(layoutFor(view));

	function frameMax(frames: Frames): number {
		return Math.max(
			1,
			...Array.from(frames.values())
				.filter((f) => f.barOpacity > 0.005)
				.map((f) => f.count)
		);
	}

	const sourceMaxCount = $derived(frameMax(sourceFrames));
	const targetMaxCount = $derived(frameMax(targetFrames));

	const currentMaxCount = $derived.by(() => {
		const eased = cubicInOut(progress);
		return sourceMaxCount + (targetMaxCount - sourceMaxCount) * eased;
	});

	const visibleBars = $derived(
		Array.from(targetFrames.entries())
			.filter(([, f]) => f.barOpacity > 0)
			.map(([id, f]) => ({ id, count: f.count }))
	);

	// Clamp so a node whose count outruns the *current* (still-animating) domain —
	// e.g. the focused subtheme converting to a band during drill-down — caps at the
	// outer track instead of extrapolating past it and ballooning over the container.
	const rScale = $derived(
		scaleLinear()
			.domain([0, Math.max(1, currentMaxCount)])
			.range([R_BAR_IN, R_BAR_MAX])
			.clamp(true)
	);

	// Tick rings ride the same animated domain as the bars, so they slide smoothly
	// between source and target spacing rather than snapping the instant `view` flips.
	const ticks = $derived(rScale.ticks(4).filter((t) => t > 0));

	$effect(() => {
		void tree;

		untrack(() => {
			const next: View = { kind: 'subthemes', themeId: null };
			view = next;
			sourceFrames = layoutFor(next);
			progress = 1;
		});
	});

	function anchorAngle(id: string, frames: Frames): number {
		const ix = indexed.get(id);
		let cur = ix?.parent ?? ix?.theme ?? null;

		while (cur) {
			const f = frames.get(cur.id);
			if (f && (f.barOpacity > 0 || f.bandOpacity > 0)) return (f.a0 + f.a1) / 2;
			cur = indexed.get(cur.id)?.parent ?? null;
		}

		for (const [, f] of frames) {
			if (f.bandOpacity > 0 && f.barOpacity === 0) return (f.a0 + f.a1) / 2;
		}

		return Math.PI;
	}

	const currentFrames = $derived.by(() => {
		const eased = cubicInOut(progress);
		const out: Frames = new Map();

		for (const id of indexed.keys()) {
			const s = sourceFrames.get(id) ?? hidden();
			const t = targetFrames.get(id) ?? hidden();

			const sVisible = s.barOpacity > 0 || s.bandOpacity > 0;
			const tVisible = t.barOpacity > 0 || t.bandOpacity > 0;

			const sa = sVisible ? s.a0 : anchorAngle(id, sourceFrames);
			const sb = sVisible ? s.a1 : sa;
			const ta = tVisible ? t.a0 : anchorAngle(id, targetFrames);
			const tb = tVisible ? t.a1 : ta;

			// A node's blocks are intrinsic, so source and target carry the same array
			// whenever it is present and an empty one where it is hidden. Prefer the side
			// that actually holds blocks (target first) so the sentiment stack is fixed for
			// the whole transition — no mid-flight swap as `count` interpolates the radius.
			const blocks = t.blocks.length ? t.blocks : s.blocks;

			out.set(id, {
				a0: sa + (ta - sa) * eased,
				a1: sb + (tb - sb) * eased,
				barOpacity: s.barOpacity + (t.barOpacity - s.barOpacity) * eased,
				bandOpacity: s.bandOpacity + (t.bandOpacity - s.bandOpacity) * eased,
				count: s.count + (t.count - s.count) * eased,
				blocks
			});
		}

		return out;
	});

	function changeView(next: View) {
		if (sameView(view, next)) return;

		const snap: Frames = new Map();
		for (const [id, f] of currentFrames) snap.set(id, { ...f });

		sourceFrames = snap;
		view = next;
		progress = 0;

		cancelAnimationFrame(rafHandle);

		const start = performance.now();

		const tick = (now: number) => {
			const t = Math.min(1, (now - start) / ANIM_MS);
			progress = t;

			if (t < 1) rafHandle = requestAnimationFrame(tick);
		};

		rafHandle = requestAnimationFrame(tick);
	}

	function sameView(a: View, b: View): boolean {
		if (a.kind !== b.kind) return false;
		if (a.kind === 'subthemes' && b.kind === 'subthemes') return a.themeId === b.themeId;
		if (a.kind === 'keywords' && b.kind === 'keywords') return a.subthemeId === b.subthemeId;
		return true;
	}

	let hovered = $state<string | null>(null);
	let pointer = $state({ x: 0, y: 0 });
	let wrapW = $state(700);

	function trackPointer(e: PointerEvent) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
	}

	let pendingClickTimer: ReturnType<typeof setTimeout> | null = null;

	function clearPendingClick() {
		if (pendingClickTimer) {
			clearTimeout(pendingClickTimer);
			pendingClickTimer = null;
		}
	}

	function handleBarClick(node: RadialNode) {
		if (pendingClickTimer) {
			clearPendingClick();
			onselect?.(node);
			return;
		}

		pendingClickTimer = setTimeout(() => {
			pendingClickTimer = null;
			zoomIn(node);
		}, DOUBLE_CLICK_MS);
	}

	function zoomIn(node: RadialNode) {
		if (node.kind === 'theme') {
			changeView({ kind: 'subthemes', themeId: node.id });
		} else if (node.kind === 'subtheme') {
			if ((node.children ?? []).length === 0) return;
			changeView({ kind: 'keywords', subthemeId: node.id });
		}
	}

	function handleBandDoubleClick(node: RadialNode) {
		clearPendingClick();
		onselect?.(node);
	}

	// Navigation layers, top → bottom:
	//   themes → subthemes (all) → [theme] · subthemes → [subtheme] · keywords
	// The all-subthemes view (themeId null) is the page-refresh default and sits
	// between themes and a single theme's subthemes.
	const canGoBack = $derived(view.kind !== 'themes');

	function parentView(v: View): View | null {
		if (v.kind === 'keywords') {
			const ix = indexed.get(v.subthemeId);
			return { kind: 'subthemes', themeId: ix?.theme?.id ?? null };
		}

		if (v.kind === 'subthemes') {
			return v.themeId !== null ? { kind: 'subthemes', themeId: null } : { kind: 'themes' };
		}

		return null;
	}

	function goBack() {
		clearPendingClick();

		const parent = parentView(view);
		if (parent) changeView(parent);
	}

	function handleWindowKeydown(e: KeyboardEvent) {
		// Escape steps one layer back, mirroring the Back button. When a node drawer is
		// open (`selected` set) we stand down so it can handle Escape and close first —
		// we only step back once nothing is open.
		if (e.key === 'Escape' && selected === null && canGoBack) {
			e.preventDefault();
			goBack();
		}
	}

	const arcGen = arc().cornerRadius(1.5);

	const wedge = (
		innerRadius: number,
		outerRadius: number,
		startAngle: number,
		endAngle: number,
		padAngle = 0
	) => arcGen({ innerRadius, outerRadius, startAngle, endAngle, padAngle }) ?? '';

	const pt = (r: number, a: number): [number, number] => [r * Math.sin(a), -r * Math.cos(a)];

	function arcPath(r: number, a0: number, a1: number) {
		const [x0, y0] = pt(r, a0);
		const [x1, y1] = pt(r, a1);
		const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
		const sweep = a1 > a0 ? 1 : 0;

		return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
	}

	const GROUP_FONT = 13;

	function labelSpan(g: { label: string; a0: number; a1: number }) {
		const mid = (g.a0 + g.a1) / 2;
		const need = (g.label.length * GROUP_FONT * 0.66) / R_GROUP_LABEL + 0.06;
		const used = Math.max(g.a1 - g.a0, need);

		return { a0: mid - used / 2, a1: mid + used / 2 };
	}

	const trunc = (s: string, n = 22) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

	function segmentsFor(blocks: RadialBlock[], maxVisibleCount: number) {
	const segments: { s: number; r0: number; r1: number; key: string }[] = [];

	// Never stack past the animating domain: with a clamped scale the overflow blocks
	// would collapse into stacked zero-width white outlines at the outer track and read
	// as a bright blob. For settled bars `count <= currentMaxCount`, so this is a no-op.
	const cap = Math.min(maxVisibleCount, currentMaxCount);
	let i = 0;

	for (const s of SENTIMENT_ORDER) {
		const matching = blocks.filter((b) => b.sentiment === s);

		for (const block of matching) {
			if (i >= cap) break;

			segments.push({
				s,
				r0: rScale(i),
				r1: rScale(i + 1),
				key: `${block.interview_id}-${s}-${i}`
			});

			i += 1;
		}

		if (i >= cap) break;
	}

	return segments;
}

	const sentimentsPresent = $derived(
		[...new Set(allNodes.flatMap((n) => n.blocks.map((b) => b.sentiment)))].sort((a, b) => a - b)
	);

	const breadcrumb = $derived.by(() => {
		// Build the full layer path top → down; the deepest (current) crumb gets
		// `view: null`, which the template renders as the non-clickable active label.
		const crumbs: { label: string; view: View | null; kind: string }[] = [];
		const markActive = () => (crumbs[crumbs.length - 1].view = null);

		// Layer 1 — Themes
		crumbs.push({ label: 'Themes', view: { kind: 'themes' }, kind: 'themes' });
		if (view.kind === 'themes') {
			markActive();
			return crumbs;
		}

		// Layer 2 — all-subthemes (page-refresh default)
		crumbs.push({ label: 'Subthemes', view: { kind: 'subthemes', themeId: null }, kind: 'subthemes-all' });
		if (view.kind === 'subthemes' && view.themeId === null) {
			markActive();
			return crumbs;
		}

		// Layer 3 — [theme] · subthemes (theme in context, from a filter or a drilled keyword)
		const themeId =
			view.kind === 'subthemes' ? view.themeId : (indexed.get(view.subthemeId)?.theme?.id ?? null);
		const theme = themeId ? tree.find((x) => x.id === themeId) : null;

		if (theme) {
			crumbs.push({
				label: `${theme.label} · subthemes`,
				view: { kind: 'subthemes', themeId: theme.id },
				kind: 'subthemes-filtered'
			});
		}

		if (view.kind === 'subthemes') {
			markActive();
			return crumbs;
		}

		// Layer 4 — [subtheme] · keywords
		const sub = indexed.get(view.subthemeId);
		crumbs.push({
			label: `${sub?.node.label ?? '…'} · keywords`,
			view: null,
			kind: 'keywords'
		});

		return crumbs;
	});

	function navigateCrumb(v: View | null) {
		if (!v) return;
		changeView(v);
	}

	const tip = $derived.by(() => {
		if (!hovered) return null;

		const ix = indexed.get(hovered);
		if (!ix) return null;

		const node = ix.node;
		const frame = currentFrames.get(node.id);

		return {
			node,
			blocks: frame?.blocks ?? node.blocks,
			count: frame?.count ?? node.count,
			kindLabel: node.kind === 'theme' ? 'Theme' : node.kind === 'subtheme' ? 'Subtheme' : 'Keyword'
		};
	});

	type RenderItem = {
		id: string;
		node: RadialNode;
		frame: NodeFrame;
		isBar: boolean;
		isBand: boolean;
	};

	const renderItems = $derived.by(() => {
		const items: RenderItem[] = [];

		for (const [id, frame] of currentFrames) {
			const ix = indexed.get(id);
			if (!ix) continue;

			const isBar = frame.barOpacity > 0.005 && frame.a1 > frame.a0;
			const isBand = frame.bandOpacity > 0.005 && frame.a1 > frame.a0;

			if (!isBar && !isBand) continue;

			items.push({ id, node: ix.node, frame, isBar, isBand });
		}

		return items;
	});

	function labelPathId(nodeId: string) {
		return `radial-grp-${nodeId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div class="flex flex-col lg:flex-row gap-3">
	<div class="flex flex-1 flex-col gap-2">
		<nav class="breadcrumb flex flex-row flex-wrap items-center gap-1 px-1 text-xs">
			{#if canGoBack}
				<Button
					variant="action"
					size="sm"
					class="mr-1"
					title="Back (Esc)"
					onclick={goBack}>← Back</Button
				>
			{/if}

			{#each breadcrumb as crumb, i (i)}
				{#if i > 0}
					<span class="text-(--ink)/30">›</span>
				{/if}

				{#if crumb.view}
					<Button
						variant="secondary"
						size="sm"
						onclick={() => navigateCrumb(crumb.view)}
					>
						{crumb.label}
					</Button>
				{:else}
					<span
						aria-current="page"
						class="inline-flex h-8 shrink-0 items-center rounded-full border border-(--ink)/15 bg-(--ink)/5 px-3 text-sm font-medium text-primary"
					>
						{crumb.label}
					</span>
				{/if}
			{/each}
		</nav>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="relative" bind:clientWidth={wrapW} onpointermove={trackPointer}>
			<svg viewBox="{-PAD} {-PAD} {VIEW} {VIEW}" class="mx-auto block w-full max-w-5xl" role="presentation">
				<defs>
					{#each renderItems as item (item.id + '-defs')}
						{#if item.isBand}
							{@const ls = labelSpan({
								label: item.node.label,
								a0: item.frame.a0,
								a1: item.frame.a1
							})}
							{@const bottom = Math.cos((item.frame.a0 + item.frame.a1) / 2) < 0}

							<path
								id={labelPathId(item.id)}
								d={bottom
									? arcPath(R_GROUP_LABEL, ls.a1, ls.a0)
									: arcPath(R_GROUP_LABEL, ls.a0, ls.a1)}
							/>
						{/if}
					{/each}
				</defs>

				<g transform="translate({C} {C})">
					{#each ticks as t (t)}
						<circle
							r={rScale(t)}
							fill="none"
							class="stroke-(--ink) opacity-15"
							stroke-dasharray="2 3"
						/>
						<text x="4" y={-rScale(t)} dominant-baseline="middle" class="tick">{t}</text>
					{/each}

					<circle r={R_BAR_IN} fill="none" class="stroke-(--ink) opacity-25" />

					{#each renderItems as item (item.id + '-band')}
						{#if item.isBand}
							{@const c = colorFor(item.node)}
							{@const isHov = hovered === item.id}
							{@const desat = hovered !== null && !isHov}
							{@const ls = labelSpan({
								label: item.node.label,
								a0: item.frame.a0,
								a1: item.frame.a1
							})}

							<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
							<g
								class="band"
								role="button"
								tabindex="0"
								aria-label="{item.node.label} — double-click to open drawer"
								style:opacity={item.frame.bandOpacity}
								style:filter={desat ? 'saturate(0.2)' : 'none'}
								ondblclick={() => handleBandDoubleClick(item.node)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										handleBandDoubleClick(item.node);
									}
								}}
								onpointerenter={() => (hovered = item.id)}
								onpointerleave={() => (hovered = null)}
							>
								<path
									d={wedge(R_BAR_MAX + 6, R_GROUP_LABEL + 14, ls.a0, ls.a1)}
									fill="rgba(0,0,0,0.001)"
								/>

								<path
									d={wedge(
										R_GROUP_BAND_IN - 4,
										R_GROUP_BAND_OUT + 8,
										item.frame.a0,
										item.frame.a1
									)}
									fill="rgba(0,0,0,0.001)"
								/>

								<path
									d={wedge(
										R_GROUP_BAND_IN,
										R_GROUP_BAND_OUT,
										item.frame.a0,
										item.frame.a1,
										0.012
									)}
									fill={c}
									opacity="0.85"
								/>

								<text class="group-label" class:hov={isHov} fill={c}>
									<textPath
										href="#{labelPathId(item.id)}"
										startOffset="50%"
										text-anchor="middle"
										dominant-baseline="middle"
									>
										{item.node.label}
									</textPath>
								</text>
							</g>
						{/if}
					{/each}

					{#each renderItems as item (item.id + '-bar')}
						{#if item.isBar}
							{@const c = colorFor(item.node)}
							{@const wa0 = item.frame.a0}
							{@const wa1 = item.frame.a1}
							{@const mid = (wa0 + wa1) / 2}
							{@const flip = Math.sin(mid) < 0}
							{@const deg = (mid * 180) / Math.PI}
							{@const isSel = selected === item.id}
							{@const isHov = hovered === item.id}
							{@const dim = selected !== null && !isSel && hovered !== item.id}
							{@const desat = hovered !== null && !isHov}
							{@const showLabel = wa1 - wa0 > 0.04 && item.frame.barOpacity > 0.6}

							<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
							<g
								class="bar"
								role="button"
								tabindex="0"
								aria-label="{item.node.label}: {Math.round(item.frame.count)} {blockLabel}s — click to zoom in, double-click to open drawer"
								style:opacity={item.frame.barOpacity * (dim ? 0.35 : 1)}
								style:filter={desat ? 'saturate(0.2)' : 'none'}
								onclick={() => handleBarClick(item.node)}
								ondblclick={(e) => {
									e.preventDefault();
									clearPendingClick();
									onselect?.(item.node);
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										handleBarClick(item.node);
									}
								}}
								onpointerenter={() => (hovered = item.id)}
								onpointerleave={() => (hovered = null)}
							>
								<path d={wedge(R_BAR_IN, R_BAR_MAX, wa0, wa1)} class="track" />
								{#each segmentsFor(item.frame.blocks, item.frame.count) as segment (segment.key)}
								<path
									d={wedge(segment.r0, segment.r1, wa0, wa1)}
									fill={SENTIMENT_COLORS[segment.s]}
									stroke="white"
									stroke-width="0.45"
									vector-effect="non-scaling-stroke"
								/>
							{/each}

								{#if isSel}
									<path
										d={wedge(R_BAR_IN - 2, rScale(item.frame.count) + 2, wa0, wa1)}
										fill="none"
										class="stroke-(--ink)"
										stroke-width="2"
									/>
								{/if}

								{#if showLabel}
									<text
										class="bar-label"
										class:sel={isSel}
										class:hov={isHov}
										style:fill={c}
										transform="rotate({deg}) translate(0 {-R_THEME_LABEL}) {flip
											? 'rotate(90)'
											: 'rotate(-90)'}"
										text-anchor={flip ? 'end' : 'start'}
										dominant-baseline="middle"
									>
										{trunc(item.node.label)}
									</text>
								{/if}
							</g>
						{/if}
					{/each}
				</g>
			</svg>

			{#if tip}
				<div
					class="pointer-events-none absolute z-20 max-w-md rounded-md border border-secondary-foreground bg-secondary p-3 shadow-lg"
					style="left: {pointer.x}px; top: {pointer.y}px; transform: translate({pointer.x >
					wrapW / 2
						? 'calc(-100% - 16px)'
						: '16px'}, 12px);"
				>
					<p class="figcaption text-[10px] uppercase tracking-wide text-(--ink)/50">
						{tip.kindLabel}
					</p>

					<p class="text-sm font-semibold text-slate-800">{tip.node.label}</p>

					<p class="mt-0.5 text-xs text-muted-foreground">
						{Math.round(tip.count)} tagged {Math.round(tip.count) === 1 ? 'segment' : 'segments'}
					</p>

					{#if tip.node.description}
						<p class="mt-1 text-xs leading-snug text-muted-foreground">{tip.node.description}</p>
					{/if}

					<div class="mt-2 flex flex-col gap-1">
						{#each SENTIMENT_ORDER as s (s)}
							{@const cnt = tip.blocks.filter((b) => b.sentiment === s).length}

							{#if cnt}
								<div class="flex items-center gap-1.5 text-xs text-slate-600">
									<span class="size-2.5 shrink-0" style:background-color={SENTIMENT_COLORS[s]}></span>
									<span class="flex-1">{SENTIMENT_LABEL[s]}</span>
									<span class="tabular-nums text-slate-400">{cnt}</span>
								</div>
							{/if}
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- <aside class="flex flex-col gap-4 md:w-2xs md:shrink-0">
		<p class="caption text-xs">
			<strong> Radial length </strong> = {unitLabel}, stacked into sentiment bands. 
			<br /><br />
			<strong>Click</strong> a subtheme to drill into its keywords, then use
			<strong>Back</strong> (or <strong>Esc</strong>) to step out one layer.
			<br /><br />
			<strong>Double-click</strong> any bar or band to open the drawer for that node.
		</p>
	</aside> -->
</div>

<style>
	.bar {
		cursor: pointer;
		transition:
			opacity 80ms linear,
			filter 120ms ease;
	}

	.bar:focus-visible {
		outline: none;
	}

	.bar:focus-visible .bar-label {
		text-decoration: underline;
	}

	.track {
		fill: var(--color-muted-foreground);
		opacity: 0.04;
	}

	.bar-label {
		font-family: var(--font-body);
		font-size: 0.6725rem;
		fill: var(--color-secondary-foreground);
		pointer-events: none;
	}

	.bar-label.sel {
		font-weight: 500;
	}

	.bar-label.hov {
		font-weight: 700;
	}

	.band {
		cursor: pointer;
		transition:
			opacity 80ms linear,
			filter 120ms ease;
	}

	.band:focus-visible {
		outline: none;
	}

	.group-label {
		font-family: var(--font-heading, var(--font-body));
		font-size: 0.5825rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.group-label.hov {
		font-weight: 800;
	}

	.tick {
		font-family: var(--font-mono);
		font-size: 0.625rem;
		fill: var(--color-secondary-foreground);
		opacity: 0.5;
	}

	.breadcrumb button {
		cursor: pointer;
	}
</style>