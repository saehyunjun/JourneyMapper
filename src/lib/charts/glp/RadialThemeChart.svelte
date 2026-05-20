<script lang="ts" module>
	/** One block per contributing segment, carrying what's needed to colour it. */
	export type RadialBlock = { sentiment: number; interview_id: string };
	/** One theme bar: a label, its total count, its tag group, and its blocks. */
	export type RadialRow = {
		word: string;
		count: number;
		group: string;
		blocks: RadialBlock[];
	};
</script>

<script lang="ts">
	import { arc } from 'd3-shape';
	import { scaleLinear } from 'd3-scale';
	import { fade } from 'svelte/transition';

	let {
		data,
		groups,
		onselect,
		selected = null,
		unitLabel = 'tagged segments',
		itemNoun = 'themes',
		blockLabel = 'tagged segment'
	}: {
		data: RadialRow[];
		/** Ordered tag groups; only those present in `data` are drawn. */
		groups: { id: string; label: string; description?: string }[];
		/** When set, wedges become clickable and call this with the clicked datum. */
		onselect?: (datum: { word: string }) => void;
		/** `word` of the currently-selected theme — outlined and never dimmed. */
		selected?: string | null;
		unitLabel?: string;
		itemNoun?: string;
		blockLabel?: string;
	} = $props();

	// -2..2 diverging sentiment scale — matches SortableBarChart.
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
	const GROUP_PALETTE = ['#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#a855f7', '#ec4899', '#84cc16'];

	// --- Geometry (SVG user units; the <svg> scales responsively) ---
	const SIZE = 860;
	const C = SIZE / 2;
	const R_GROUP_BAND_IN = 16;
	const R_GROUP_BAND_OUT = 24;
	const R_BAR_IN = 40;
	const R_BAR_MAX = 244;
	const R_THEME_LABEL = 265;
	const R_GROUP_LABEL = 415;
	const GROUP_GAP = 0.1; // radians of blank angle before each group

	let hovered = $state<string | null>(null);
	let hoveredGroup = $state<string | null>(null);
	// Pointer position relative to the chart wrapper, for the floating tooltip.
	let pointer = $state({ x: 0, y: 0 });
	let wrapW = $state(700);

	function trackPointer(e: PointerEvent) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
	}

	const arcGen = arc().cornerRadius(1.5);
	/** Annular-sector path; angle 0 = up (12 o'clock), increasing clockwise. */
	const wedge = (
		innerRadius: number,
		outerRadius: number,
		startAngle: number,
		endAngle: number,
		padAngle = 0
	) => arcGen({ innerRadius, outerRadius, startAngle, endAngle, padAngle }) ?? '';

	/** Point on a circle in the same angle convention as `wedge`. */
	const pt = (r: number, a: number): [number, number] => [r * Math.sin(a), -r * Math.cos(a)];

	/** Circular-arc path used as a baseline for group-label textPaths. */
	function arcPath(r: number, a0: number, a1: number) {
		const [x0, y0] = pt(r, a0);
		const [x1, y1] = pt(r, a1);
		const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
		const sweep = a1 > a0 ? 1 : 0;
		return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
	}

	const GROUP_FONT = 13;
	// Angular span a group label needs at R_GROUP_LABEL, padded. A small group
	// (e.g. a one-theme group) gets a wider arc than it occupies so its textPath
	// label doesn't clip — extended symmetrically so the label stays centred.
	function labelSpan(g: { label: string; a0: number; a1: number }) {
		const mid = (g.a0 + g.a1) / 2;
		const need = (g.label.length * GROUP_FONT * 0.66) / R_GROUP_LABEL + 0.06;
		const used = Math.max(g.a1 - g.a0, need);
		return { a0: mid - used / 2, a1: mid + used / 2 };
	}

	const trunc = (s: string, n = 22) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

	const maxCount = $derived(Math.max(1, ...data.map((d) => d.count)));
	const rScale = $derived(scaleLinear().domain([0, maxCount]).range([R_BAR_IN, R_BAR_MAX]));
	const ticks = $derived(rScale.ticks(4).filter((t) => t > 0));

	const sentimentsPresent = $derived(
		[...new Set(data.flatMap((d) => d.blocks.map((b) => b.sentiment)))].sort((a, b) => a - b)
	);

	// Lay themes out around the circle, grouped — themes in the same tag group
	// sit adjacent, with GROUP_GAP of blank angle before each group.
	const layout = $derived.by(() => {
		const byGroup = new Map<string, RadialRow[]>();
		for (const row of data) {
			const g = row.group || '__other';
			const list = byGroup.get(g);
			if (list) list.push(row);
			else byGroup.set(g, [row]);
		}
		for (const list of byGroup.values()) list.sort((a, b) => b.count - a.count);

		const ordered: { id: string; label: string }[] = groups.filter((g) => byGroup.has(g.id));
		if (byGroup.has('__other')) ordered.push({ id: '__other', label: 'Other' });

		const n = Math.max(1, data.length);
		const per = (2 * Math.PI - ordered.length * GROUP_GAP) / n;

		const themes: { row: RadialRow; a0: number; a1: number; mid: number; color: string }[] = [];
		const groupArcs: { id: string; label: string; a0: number; a1: number; color: string }[] = [];
		let a = 0;
		ordered.forEach((g, gi) => {
			a += GROUP_GAP;
			const start = a;
			const color = GROUP_PALETTE[gi % GROUP_PALETTE.length];
			for (const row of byGroup.get(g.id) ?? []) {
				themes.push({ row, a0: a, a1: a + per, mid: a + per / 2, color });
				a += per;
			}
			groupArcs.push({ id: g.id, label: g.label, a0: start, a1: a, color });
		});
		return { themes, groupArcs, per };
	});

	const groupDesc = $derived(new Map(groups.map((g) => [g.id, g.description])));

	// The group highlighted right now — either hovered directly, or the group of
	// the hovered theme. Drives the dimming of both wedges and group bands.
	const activeGroup = $derived.by(() => {
		if (hoveredGroup) return hoveredGroup;
		if (hovered) return data.find((d) => d.word === hovered)?.group ?? null;
		return null;
	});

	// What the floating tooltip + centre readout describe right now.
	const tip = $derived.by(() => {
		if (hovered) {
			const row = data.find((d) => d.word === hovered);
			return row ? { kind: 'theme' as const, row } : null;
		}
		if (hoveredGroup) {
			const g = layout.groupArcs.find((x) => x.id === hoveredGroup);
			if (!g) return null;
			const rows = data.filter((d) => (d.group || '__other') === g.id);
			return {
				kind: 'group' as const,
				group: g,
				description: groupDesc.get(g.id) ?? '',
				themeCount: rows.length,
				total: rows.reduce((n, r) => n + r.count, 0)
			};
		}
		return null;
	});

	/** Stacked sentiment bands for one theme: cumulative radial spans. */
	function bandsFor(row: RadialRow) {
		const bands: { s: number; r0: number; r1: number }[] = [];
		let cum = 0;
		for (const s of SENTIMENT_ORDER) {
			const c = row.blocks.filter((b) => b.sentiment === s).length;
			if (!c) continue;
			bands.push({ s, r0: rScale(cum), r1: rScale(cum + c) });
			cum += c;
		}
		return bands;
	}
</script>

<div class="flex flex-col md:flex-row gap-3">


	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="relative" bind:clientWidth={wrapW} onpointermove={trackPointer}>
		<svg
			viewBox="0 0 {SIZE} {SIZE}"
			class="mx-auto block w-4xl max-w-[1050px]"
			role="presentation"
		>
		<defs>
			{#each layout.groupArcs as g, gi (g.id)}
				{@const ls = labelSpan(g)}
				{@const bottom = Math.cos((g.a0 + g.a1) / 2) < 0}
				<path
					id="radial-grp-{gi}"
					d={bottom
						? arcPath(R_GROUP_LABEL, ls.a1, ls.a0)
						: arcPath(R_GROUP_LABEL, ls.a0, ls.a1)}
				/>
			{/each}
		</defs>

		<g transform="translate({C} {C})">
			<!-- count-axis rings -->
			{#each ticks as t (t)}
				<circle r={rScale(t)} fill="none" class="stroke-(--ink) opacity-15" stroke-dasharray="2 3" />
				<text x="4" y={-rScale(t)} dominant-baseline="middle" class="tick">{t}</text>
			{/each}
			<circle r={R_BAR_IN} fill="none" class="stroke-(--ink) opacity-25" />

			<!-- group colour bands + arc labels — hoverable for the tooltip -->
			{#each layout.groupArcs as g, gi (g.id)}
				{@const gdim = activeGroup !== null && activeGroup !== g.id}
				{@const ls = labelSpan(g)}
				<g
					class="group"
					role="presentation"
					style:opacity={gdim ? 0.3 : 1}
					onpointerenter={() => (hoveredGroup = g.id)}
					onpointerleave={() => (hoveredGroup = null)}
				>
					<!-- transparent hit areas: the band ring and the label arc -->
					<path d={wedge(R_GROUP_BAND_IN - 6, R_BAR_IN, g.a0, g.a1)} fill="transparent" />
					<path d={wedge(393, 418, ls.a0, ls.a1)} fill="transparent" />
					<path
						d={wedge(R_GROUP_BAND_IN, R_GROUP_BAND_OUT, g.a0, g.a1, 0.012)}
						fill={g.color}
						opacity="0.85"
					/>
					<text
						class="group-label"
						class:active={hoveredGroup === g.id}
						fill={g.color}
					>
						<textPath
							href="#radial-grp-{gi}"
							startOffset="50%"
							text-anchor="middle"
							dominant-baseline="middle"
						>
							{g.label}
						</textPath>
					</text>
				</g>
			{/each}

			<!-- theme wedges -->
			{#each layout.themes as t (t.row.word)}
				{@const dim =
					selected !== t.row.word &&
					((hovered !== null && hovered !== t.row.word) ||
						(hoveredGroup !== null && (t.row.group || '__other') !== hoveredGroup))}
				{@const isSel = selected === t.row.word}
				{@const wa0 = t.a0 + layout.per * 0.1}
				{@const wa1 = t.a1 - layout.per * 0.1}
				{@const flip = Math.sin(t.mid) < 0}
				{@const deg = (t.mid * 180) / Math.PI}
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<g
					class="theme"
					class:selectable={!!onselect}
					style:opacity={dim ? 0.28 : 1}
					transition:fade={{ duration: 180 }}
					onpointerenter={() => (hovered = t.row.word)}
					onpointerleave={() => (hovered = null)}
					onclick={() => onselect?.({ word: t.row.word })}
					onkeydown={(e) => {
						if (onselect && (e.key === 'Enter' || e.key === ' ')) {
							e.preventDefault();
							onselect({ word: t.row.word });
						}
					}}
					role={onselect ? 'button' : 'presentation'}
					tabindex={onselect ? 0 : undefined}
					aria-label="{t.row.word}: {t.row.count} {blockLabel}s"
				>
					<!-- faint full-length track, also the hit area -->
					<path d={wedge(R_BAR_IN, R_BAR_MAX, wa0, wa1)} class="track" />
					{#each bandsFor(t.row) as band (band.s)}
						<path
							d={wedge(band.r0, band.r1, wa0, wa1)}
							fill={SENTIMENT_COLORS[band.s]}
							stroke="white"
							stroke-width="0.75"
						/>
					{/each}
					{#if isSel}
						<path
							d={wedge(R_BAR_IN - 2, rScale(t.row.count) + 2, wa0, wa1)}
							fill="none"
							class="stroke-(--ink)"
							stroke-width="2"
						/>
					{/if}

					<text
						class="theme-label"
						class:sel={isSel}
						style:fill={t.color}
						transform="rotate({deg}) translate(0 {-R_THEME_LABEL}) {flip
							? 'rotate(90)'
							: 'rotate(-90)'}"
						text-anchor={flip ? 'end' : 'start'}
						dominant-baseline="middle">{trunc(t.row.word)}</text
					>
				</g>
			{/each}

		</g>
		</svg>
		<!-- floating tooltip — follows the pointer over wedges and group labels -->
		{#if tip}
			<div
				class="pointer-events-none absolute z-20 max-w-md rounded-md border border-slate-200 bg-secondary p-3 shadow-lg"
				style="left: {pointer.x}px; top: {pointer.y}px; transform: translate({pointer.x >
				wrapW / 2
					? 'calc(-100% - 16px)'
					: '16px'}, 12px);"
			>
				{#if tip.kind === 'theme'}
					<p class="text-sm font-semibold text-slate-800">{tip.row.word}</p>
					<p class="mt-0.5 text-xs text-muted-foreground">
						{tip.row.count} tagged {tip.row.count === 1 ? 'segment' : 'segments'}
					</p>
					<div class="mt-2 flex flex-col gap-1">
						{#each SENTIMENT_ORDER as s (s)}
							{@const c = tip.row.blocks.filter((b) => b.sentiment === s).length}
							{#if c}
								<div class="flex items-center gap-1.5 text-xs text-slate-600">
									<span
										class="size-2.5 shrink-0"
										style:background-color={SENTIMENT_COLORS[s]}
									></span>
									<span class="flex-1">{SENTIMENT_LABEL[s]}</span>
									<span class="tabular-nums text-slate-400">{c}</span>
								</div>
							{/if}
						{/each}
					</div>
				{:else}
					<div class="flex flex-row items-center gap-2.5">
						<span
							class="size-2.5 shrink-0 rounded-full"
							style:background-color={tip.group.color}
						></span>
						<p class="text-sm font-semibold text-slate-800">{tip.group.label}</p>
					</div>
					{#if tip.description}
						<p class="mt-1 text-xs leading-snug text-muted-foreground">{tip.description}</p>
					{/if}
					<p class="mt-2 text-xs text-muted-foreground">
						{tip.themeCount} {tip.themeCount === 1 ? 'theme' : 'themes'} · {tip.total} tagged
						{tip.total === 1 ? 'segment' : 'segments'}
					</p>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Legend — counts, sentiment scale, and codebook groups stacked in one column -->
	<aside class="flex flex-col gap-4 md:w-56 md:shrink-0">
		<p class="caption text-muted-foreground">
			{data.length} {itemNoun} · {layout.groupArcs.length} groups
		</p>

		<div class="flex flex-col gap-1.5">
			<p class="text-[10px] font-medium uppercase tracking-wide text-slate-400">Sentiment</p>
			{#each sentimentsPresent as s (s)}
				<span class="flex items-center gap-1.5 font-mono text-xs text-foreground">
					<span class="size-3 shrink-0" style:background-color={SENTIMENT_COLORS[s]}></span>
					{SENTIMENT_LABEL[s]}
				</span>
			{/each}
		</div>

		<div class="flex flex-col gap-1.5">
			<p class="text-[10px] font-medium uppercase tracking-wide text-slate-400">Groups</p>
			{#each layout.groupArcs as g (g.id)}
				<span class="flex items-center gap-1.5 text-xs text-muted-foreground">
					<span class="size-2.5 shrink-0 rounded-full" style:background-color={g.color}></span>
					{g.label}
				</span>
			{/each}
		</div>

		<p class="caption">
			Each wedge is one theme, clustered into its codebook group; radial length = {unitLabel},
			stacked into sentiment bands. Hover a wedge or a group label to isolate it{onselect
				? '; click a theme to open the quotes behind it'
				: ''}.
		</p>
	</aside>

</div>

<style>
	.theme {
		cursor: crosshair;
		transition: opacity 150ms ease;
	}
	.theme.selectable {
		cursor: pointer;
	}
	.theme.selectable:focus-visible {
		outline: none;
	}
	.theme.selectable:focus-visible .theme-label {
		text-decoration: underline;
	}
	.track {
		fill: var(--color-muted-foreground);
		opacity: 0.04;
	}
	.theme-label {
		font-family: var(--font-body);
		font-size: .6725rem;
		fill: var(--color-secondary-foreground);
	}
	.theme-label.sel {
		font-weight: 500;
	}
	.group {
		cursor: help;
		transition: opacity 150ms ease;
	}
	.group-label {
		font-family: var(--font-heading, var(--font-body));
		font-size: .5825rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.group-label.active {
		font-weight: 800;
	}
	.tick {
		font-family: var(--font-mono);
		font-size: .625rem;
		fill: var(--color-secondary-foreground);
		opacity: 0.5;
	}
</style>
