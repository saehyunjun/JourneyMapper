<script lang="ts" module>
	export type RadialFlowKeyword = {
		id: string;
		label: string;
		count: number;
	};

	export type RadialFlowSubtheme = {
		id: string;
		label: string;
		total: number;
		veryNegative?: number;
		negative: number;
		neutral: number;
		positive: number;
		veryPositive?: number;
		description?: string;
		/** Optional keyword children, sized by mention count in the outer layer. */
		keywords?: RadialFlowKeyword[];
	};

	export type RadialFlowTheme = RadialFlowSubtheme & {
		subthemes: RadialFlowSubtheme[];
		color?: string;
	};

	export type RadialFlowSelection = {
		kind: 'theme' | 'subtheme' | 'keyword';
		theme: RadialFlowTheme;
		subtheme?: RadialFlowSubtheme;
		keyword?: RadialFlowKeyword;
	};
</script>

<script lang="ts">
	import { cubicOut, cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { resolveMotionMode, type VizMotionMode } from '$lib/motion/viz';

	let {
		themes = [],
		title,
		subtitle,
		selectedId = null,
		activeThemeId = null,
		motionMode = 'dashboard',
		replayKey = 0,
		maxKeywordsPerSubtheme = 8,
		onselect,
		ontheme
	}: {
		themes: RadialFlowTheme[];
		title?: string;
		subtitle?: string;
		selectedId?: string | null;
		activeThemeId?: string | null;
		motionMode?: VizMotionMode;
		replayKey?: number;
		/** Cap on keywords rendered per subtheme (sorted by count, descending). */
		maxKeywordsPerSubtheme?: number;
		onselect?: (sel: RadialFlowSelection) => void;
		ontheme?: (themeId: string | null) => void;
	} = $props();

	// ── layout ────────────────────────────────────────────────────────────────
	const W = 960;
	const H = 800;
	const CX = W / 2;
	const CY = H / 2;
	// Theme layer — compact, near centre. Circle is the bezier source.
	const R_THEME = 70;
	const THEME_MAX_R = 14;
	const R_THEME_LABEL = 96;
	// Subtheme layer — 5 sentiment circles laid out tangentially around the anchor
	const R_SUB = 295;
	const SENTIMENT_MAX_R = 18;
	const SENTIMENT_SPACING = 14;
	// Keyword layer — pushed further out for clear separation from sentiment cluster
	const R_KEYWORD = 66;
	const KEYWORD_MAX_R = 8;
	// Outer subtheme label
	const R_LABEL = 380;

	// ── palettes ──────────────────────────────────────────────────────────────
	const C_VERY_NEG = '#e11d48';
	const C_NEG = '#fb7185';
	const C_NEU = '#cbd5e1';
	const C_POS = '#34d399';
	const C_VERY_POS = '#059669';
	const C_KEYWORD = '#94a3b8';

	const THEME_PALETTE = ['#6366f1', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#f97316'];

	const effectiveMode = $derived(resolveMotionMode(motionMode));

	// ── viewBox tween (pan/zoom on theme pin) ────────────────────────────────
	const viewBox = new Tween<[number, number, number, number]>([0, 0, W, H], {
		duration: 700,
		easing: cubicInOut
	});

	function wedgePath(rInner: number, rOuter: number, a1: number, a2: number): string {
		const so = pt(a1, rOuter);
		const eo = pt(a2, rOuter);
		const ei = pt(a2, rInner);
		const si = pt(a1, rInner);
		const large = a2 - a1 > Math.PI ? 1 : 0;
		return `M ${so.x.toFixed(1)} ${so.y.toFixed(1)} A ${rOuter} ${rOuter} 0 ${large} 1 ${eo.x.toFixed(1)} ${eo.y.toFixed(1)} L ${ei.x.toFixed(1)} ${ei.y.toFixed(1)} A ${rInner} ${rInner} 0 ${large} 0 ${si.x.toFixed(1)} ${si.y.toFixed(1)} Z`;
	}

	// ── motion phases ─────────────────────────────────────────────────────────
	// Innermost layer first, then outward. Each layer's intro window is shared;
	// inside the window each mark gets a randomized delay so the layer "fills
	// in" rather than sweeping in formation.
	const PHASE_DASHBOARD = {
		themeCircle: { start: 0, end: 550, growMs: 470 },
		themeLabel: { start: 250, end: 700 },
		sentiment: { start: 500, end: 1600, growMs: 520 },
		keyword: { start: 1250, end: 2300, growMs: 480 },
		subLabel: { start: 2000, end: 2500 }
	} as const;

	const PHASE_STORY = {
		themeCircle: { start: 0, end: 900, growMs: 760 },
		themeLabel: { start: 400, end: 1000 },
		sentiment: { start: 800, end: 2400, growMs: 720 },
		keyword: { start: 2000, end: 3500, growMs: 640 },
		subLabel: { start: 3200, end: 3900 }
	} as const;

	const phases = $derived(effectiveMode === 'story' ? PHASE_STORY : PHASE_DASHBOARD);
	const introTotalMs = $derived(phases.subLabel.end + 200);

	// ── geometry helpers ──────────────────────────────────────────────────────
	function pt(angle: number, r: number) {
		return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
	}

	function flowPath(origin: { x: number; y: number }, anchor: { x: number; y: number }): string {
		const mx = (origin.x + anchor.x) / 2;
		const my = (origin.y + anchor.y) / 2;
		const cx = mx + (CX - mx) * 0.32;
		const cy = my + (CY - my) * 0.32;
		return `M ${origin.x.toFixed(1)} ${origin.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${anchor.x.toFixed(1)} ${anchor.y.toFixed(1)}`;
	}

	/**
	 * Position + rotation for a label that sits *along* the quadratic-bezier
	 * strand between `origin` and `anchor`. Places the label at the bezier's
	 * t=0.5 point, nudged outward (away from chart centre) by `offset`, and
	 * rotated to align with the chord direction. Auto-flips 180° when the
	 * tangent would render the text right-to-left.
	 */
	function lineLabelPlacement(
		origin: { x: number; y: number },
		anchor: { x: number; y: number },
		offset = 10
	) {
		const mx = (origin.x + anchor.x) / 2;
		const my = (origin.y + anchor.y) / 2;
		const cx = mx + (CX - mx) * 0.32;
		const cy = my + (CY - my) * 0.32;
		// quadratic bezier evaluated at t = 0.5
		const bx = 0.25 * origin.x + 0.5 * cx + 0.25 * anchor.x;
		const by = 0.25 * origin.y + 0.5 * cy + 0.25 * anchor.y;
		const radial = Math.atan2(by - CY, bx - CX);
		const x = bx + Math.cos(radial) * offset;
		const y = by + Math.sin(radial) * offset;
		const tangent = Math.atan2(anchor.y - origin.y, anchor.x - origin.x);
		const flipped = Math.cos(tangent) < 0;
		const rotateDeg = (tangent * 180) / Math.PI + (flipped ? 180 : 0);
		return { x, y, rotateDeg };
	}

	// Deterministic seeded random — stable across renders so the staggered
	// intro doesn't re-roll on every reactive update.
	function seedFrom(s: string): number {
		let h = 2166136261;
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return (h >>> 0) / 4294967295;
	}

	function truncate(s: string, n = 24): string {
		return s.length > n ? s.slice(0, n - 1) + '…' : s;
	}

	function pct(n: number, total: number): string {
		return total === 0 ? '0%' : Math.round((n / total) * 100) + '%';
	}

	// ── derived layout ────────────────────────────────────────────────────────
	type ThemeBand = RadialFlowTheme & {
		color: string;
		angle: number;
		wedgeStart: number;
		wedgeEnd: number;
		origin: { x: number; y: number };
		labelPos: { x: number; y: number };
		finalR: number;
		seed: number;
	};

	type SentimentCircle = {
		bucket: 'vneg' | 'neg' | 'neu' | 'pos' | 'vpos';
		color: string;
		count: number;
		finalR: number;
		x: number;
		y: number;
		seed: number;
	};

	type KeywordNode = {
		id: string;
		label: string;
		count: number;
		finalR: number;
		x: number;
		y: number;
		seed: number;
	};

	type SubNode = RadialFlowSubtheme & {
		themeId: string;
		themeColor: string;
		origin: { x: number; y: number };
		angle: number;
		anchor: { x: number; y: number };
		path: string;
		sentimentCircles: SentimentCircle[];
		keywordNodes: KeywordNode[];
		seed: number;
	};

	const maxThemeTotal = $derived(Math.max(1, ...themes.map((t) => t.total)));
	function themeRadius(count: number): number {
		if (count <= 0) return 0;
		return Math.max(6, Math.sqrt(count / maxThemeTotal) * THEME_MAX_R);
	}

	const themesLaid = $derived.by((): ThemeBand[] => {
		const n = themes.length;
		if (n === 0) return [];
		const gap = Math.PI * 2 * 0.04;
		const wedge = (Math.PI * 2 - gap * n) / n;
		return themes.map((t, i) => {
			const wedgeStart = -Math.PI / 2 + i * (wedge + gap) + gap / 2;
			const wedgeEnd = wedgeStart + wedge;
			const angle = (wedgeStart + wedgeEnd) / 2;
			const color = t.color ?? THEME_PALETTE[i % THEME_PALETTE.length];
			return {
				...t,
				color,
				angle,
				wedgeStart,
				wedgeEnd,
				origin: pt(angle, R_THEME),
				labelPos: pt(angle, R_THEME_LABEL),
				finalR: themeRadius(t.total),
				seed: seedFrom(t.id)
			};
		});
	});

	const allSubs = $derived(themesLaid.flatMap((t) => t.subthemes));

	// Scale denominators — one per layer so a tiny keyword count isn't drowned
	// by the biggest sentiment bucket and vice versa.
	const maxBucketCount = $derived(
		Math.max(
			1,
			...allSubs.flatMap((s) => [
				s.veryNegative ?? 0,
				s.negative,
				s.neutral,
				s.positive,
				s.veryPositive ?? 0
			])
		)
	);
	const maxKeywordCount = $derived(
		Math.max(
			1,
			...allSubs.flatMap((s) => (s.keywords ?? []).map((k) => k.count))
		)
	);

	function sentimentRadius(count: number): number {
		if (count <= 0) return 0;
		return Math.max(3, Math.sqrt(count / maxBucketCount) * SENTIMENT_MAX_R);
	}

	function keywordRadius(count: number): number {
		if (count <= 0) return 0;
		return Math.max(2, Math.sqrt(count / maxKeywordCount) * KEYWORD_MAX_R);
	}

	function buildSentimentCircles(
		anchor: { x: number; y: number },
		subAngle: number,
		s: RadialFlowSubtheme
	): SentimentCircle[] {
		// Tangent to the radial direction so the cluster spreads sideways along
		// the ring rather than overlapping at a single point.
		const tx = -Math.sin(subAngle);
		const ty = Math.cos(subAngle);
		const buckets: { bucket: SentimentCircle['bucket']; color: string; count: number; slot: number }[] = [
			{ bucket: 'vneg', color: C_VERY_NEG, count: s.veryNegative ?? 0, slot: 0 },
			{ bucket: 'neg', color: C_NEG, count: s.negative, slot: 1 },
			{ bucket: 'neu', color: C_NEU, count: s.neutral, slot: 2 },
			{ bucket: 'pos', color: C_POS, count: s.positive, slot: 3 },
			{ bucket: 'vpos', color: C_VERY_POS, count: s.veryPositive ?? 0, slot: 4 }
		];
		return buckets
			.filter((b) => b.count > 0)
			.map((b) => {
				const offset = (b.slot - 2) * SENTIMENT_SPACING;
				return {
					bucket: b.bucket,
					color: b.color,
					count: b.count,
					finalR: sentimentRadius(b.count),
					x: anchor.x + offset * tx,
					y: anchor.y + offset * ty,
					seed: seedFrom(s.id + ':' + b.bucket)
				};
			});
	}

	function buildKeywordNodes(
		anchor: { x: number; y: number },
		subAngle: number,
		subId: string,
		keywords: RadialFlowKeyword[]
	): KeywordNode[] {
		if (keywords.length === 0) return [];
		const top = [...keywords]
			.sort((a, b) => b.count - a.count)
			.slice(0, maxKeywordsPerSubtheme);
		const n = top.length;
		const spread = Math.PI / 2.4; // ~75° arc on the outward side
		return top.map((kw, i) => {
			const t = n === 1 ? 0 : -0.5 + i / (n - 1);
			const angle = subAngle + t * spread;
			return {
				id: kw.id,
				label: kw.label,
				count: kw.count,
				finalR: keywordRadius(kw.count),
				x: anchor.x + R_KEYWORD * Math.cos(angle),
				y: anchor.y + R_KEYWORD * Math.sin(angle),
				seed: seedFrom(subId + ':kw:' + kw.id)
			};
		});
	}

	const subsLaid = $derived.by((): SubNode[] => {
		const out: SubNode[] = [];
		for (const t of themesLaid) {
			const m = t.subthemes.length;
			if (m === 0) continue;
			const inset = Math.min(0.15, 0.5 / m);
			for (let i = 0; i < m; i++) {
				const tFrac = m === 1 ? 0.5 : inset + (i / (m - 1)) * (1 - 2 * inset);
				const angle = t.wedgeStart + tFrac * (t.wedgeEnd - t.wedgeStart);
				const anchor = pt(angle, R_SUB);
				const sub = t.subthemes[i];
				out.push({
					...sub,
					themeId: t.id,
					themeColor: t.color,
					origin: t.origin,
					angle,
					anchor,
					path: flowPath(t.origin, anchor),
					sentimentCircles: buildSentimentCircles(anchor, angle, sub),
					keywordNodes: buildKeywordNodes(anchor, angle, sub.id, sub.keywords ?? []),
					seed: seedFrom(sub.id)
				});
			}
		}
		return out;
	});

	// ── motion: rAF-driven introProgress, per-mark grow timing ────────────────
	let introProgress = $state(0);

	$effect(() => {
		void replayKey;
		const mode = effectiveMode;
		if (mode === 'none') {
			introProgress = 1e9;
			return;
		}
		introProgress = 0;
		const total = untrack(() => introTotalMs);

		let t0 = 0;
		let rafId = 0;
		const tick = (now: number) => {
			if (t0 === 0) t0 = now;
			const elapsed = now - t0;
			introProgress = elapsed;
			if (elapsed < total) rafId = requestAnimationFrame(tick);
		};
		rafId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafId);
	});

	function phaseT(now: number, start: number, end: number): number {
		if (now <= start) return 0;
		if (now >= end) return 1;
		return cubicOut((now - start) / (end - start));
	}

	/**
	 * Per-mark grow factor in [0, 1]. The mark's delay inside its phase is
	 * scaled by `seed` so circles arrive at randomized intervals; growMs is the
	 * actual radius-grow duration once that mark wakes up.
	 */
	function markT(
		now: number,
		phase: { start: number; end: number; growMs: number },
		seed: number
	): number {
		if (effectiveMode === 'none') return 1;
		const window = Math.max(0, phase.end - phase.start - phase.growMs);
		const delay = seed * window;
		const start = phase.start + delay;
		const end = start + phase.growMs;
		if (now <= start) return 0;
		if (now >= end) return 1;
		return cubicOut((now - start) / phase.growMs);
	}

	const themeLabelOpacity = $derived(
		phaseT(introProgress, phases.themeLabel.start, phases.themeLabel.end)
	);
	const subLabelOpacity = $derived(
		phaseT(introProgress, phases.subLabel.start, phases.subLabel.end)
	);
	// Connectors fade in alongside the sentiment layer so they don't precede
	// the marks they belong to.
	const connectorOpacity = $derived(
		phaseT(introProgress, phases.sentiment.start, phases.sentiment.start + 400)
	);

	const introDone = $derived(introProgress >= introTotalMs);

	// ── interaction ───────────────────────────────────────────────────────────
	let hoveredSubId = $state<string | null>(null);
	let hoveredKeywordKey = $state<string | null>(null); // "${subId}:${kwId}"
	let hoveredThemeId = $state<string | null>(null);
	let pinnedThemeId = $state<string | null>(null);
	let tooltipPos = $state<{ x: number; y: number } | null>(null);
	let activeId = $state<string | null>(null);

	$effect(() => {
		activeId = selectedId;
	});

	$effect(() => {
		pinnedThemeId = activeThemeId;
	});

	const spotlightTheme = $derived(hoveredThemeId ?? pinnedThemeId);

	/**
	 * Bounding box of every visible mark belonging to `themeId`. Includes the
	 * theme circle, all subtheme sentiment circles, the keyword arc, and the
	 * outer subtheme label. Padded and expanded to the SVG aspect so the tween
	 * doesn't squash content when target aspect ≠ source aspect.
	 */
	function computeFocusViewBox(themeId: string): [number, number, number, number] {
		const theme = themesLaid.find((t) => t.id === themeId);
		if (!theme) return [0, 0, W, H];
		const subs = subsLaid.filter((s) => s.themeId === themeId);
		const xs: number[] = [theme.origin.x - theme.finalR, theme.origin.x + theme.finalR];
		const ys: number[] = [theme.origin.y - theme.finalR, theme.origin.y + theme.finalR];
		for (const sub of subs) {
			for (const c of sub.sentimentCircles) {
				xs.push(c.x - c.finalR, c.x + c.finalR);
				ys.push(c.y - c.finalR, c.y + c.finalR);
			}
			for (const kw of sub.keywordNodes) {
				// keyword label extends outward from the circle; estimate text width
				const dx = kw.x - sub.anchor.x;
				const dy = kw.y - sub.anchor.y;
				const dist = Math.hypot(dx, dy) || 1;
				const ux = dx / dist;
				const uy = dy / dist;
				const labelReach = kw.finalR + 64;
				xs.push(kw.x + ux * labelReach);
				ys.push(kw.y + uy * labelReach);
			}
			const lp = pt(sub.angle, R_LABEL);
			const isLeft = Math.cos(sub.angle) < 0;
			xs.push(lp.x + (isLeft ? -140 : 140));
			ys.push(lp.y);
		}
		const minX = Math.min(...xs);
		const maxX = Math.max(...xs);
		const minY = Math.min(...ys);
		const maxY = Math.max(...ys);
		const pad = 30;
		let bx = minX - pad;
		let by = minY - pad;
		let bw = maxX - minX + 2 * pad;
		let bh = maxY - minY + 2 * pad;
		// Match the source viewBox aspect so the tween doesn't distort.
		const target = W / H;
		if (bw / bh > target) {
			const newH = bw / target;
			by -= (newH - bh) / 2;
			bh = newH;
		} else {
			const newW = bh * target;
			bx -= (newW - bw) / 2;
			bw = newW;
		}
		return [bx, by, bw, bh];
	}

	$effect(() => {
		const id = pinnedThemeId;
		if (!id) {
			viewBox.target = [0, 0, W, H];
			return;
		}
		viewBox.target = computeFocusViewBox(id);
	});

	const hoveredSub = $derived(subsLaid.find((s) => s.id === hoveredSubId) ?? null);
	const hoveredKeyword = $derived.by(() => {
		if (!hoveredKeywordKey) return null;
		for (const sub of subsLaid) {
			for (const kw of sub.keywordNodes) {
				if (`${sub.id}:${kw.id}` === hoveredKeywordKey) {
					return { sub, kw };
				}
			}
		}
		return null;
	});

	function isSubDimmed(sub: SubNode): boolean {
		if (hoveredKeywordKey) {
			return !hoveredKeywordKey.startsWith(sub.id + ':');
		}
		if (hoveredSubId && hoveredSubId !== sub.id) return true;
		if (spotlightTheme && sub.themeId !== spotlightTheme) return true;
		return false;
	}

	function isSubHighlit(sub: SubNode): boolean {
		if (hoveredKeywordKey?.startsWith(sub.id + ':')) return true;
		if (hoveredSubId === sub.id) return true;
		if (activeId === sub.id) return true;
		if (spotlightTheme && sub.themeId === spotlightTheme) return true;
		return false;
	}

	function selectSub(s: SubNode) {
		const theme = themesLaid.find((t) => t.id === s.themeId);
		if (!theme) return;
		activeId = s.id;
		onselect?.({ kind: 'subtheme', theme, subtheme: s });
	}

	function selectKeyword(sub: SubNode, kw: KeywordNode) {
		const theme = themesLaid.find((t) => t.id === sub.themeId);
		if (!theme) return;
		activeId = kw.id;
		onselect?.({
			kind: 'keyword',
			theme,
			subtheme: sub,
			keyword: { id: kw.id, label: kw.label, count: kw.count }
		});
	}

	function toggleTheme(t: ThemeBand) {
		const next = pinnedThemeId === t.id ? null : t.id;
		pinnedThemeId = next;
		ontheme?.(next);
	}
</script>

<div class="rif-root">
	{#if title}
		<p class="rif-title">{title}</p>
		{#if subtitle}<p class="rif-subtitle">{subtitle}</p>{/if}
	{/if}

	<div class="rif-scroll-wrap">
		<svg
			class="rif-svg"
			viewBox="{viewBox.current[0].toFixed(1)} {viewBox.current[1].toFixed(1)} {viewBox.current[2].toFixed(1)} {viewBox.current[3].toFixed(1)}"
			preserveAspectRatio="xMidYMid meet"
			aria-label={title ?? 'Radial impact flow chart'}
			role="img"
		>
			<defs>
				{#each subsLaid as sub}
					<linearGradient
						id="rif-taper-{sub.id}"
						gradientUnits="userSpaceOnUse"
						x1={sub.origin.x}
						y1={sub.origin.y}
						x2={sub.anchor.x}
						y2={sub.anchor.y}
					>
						<stop offset="0" stop-color={sub.themeColor} stop-opacity="0.55" />
						<stop offset="1" stop-color={sub.themeColor} stop-opacity="0.05" />
					</linearGradient>
				{/each}
			</defs>

			<!-- Segment backgrounds — soft wedge fill highlights the hovered/pinned theme's whole slice -->
			<g aria-hidden="true">
				{#each themesLaid as theme}
					{@const visible = hoveredThemeId === theme.id || pinnedThemeId === theme.id}
					<path
						d={wedgePath(18, R_LABEL + 14, theme.wedgeStart, theme.wedgeEnd)}
						fill={theme.color}
						class="rif-segment-bg"
						opacity={visible ? 0.08 : 0}
					/>
				{/each}
			</g>

			<!-- Theme circles — primary interaction surface. Hover spotlights,
				click pins/unpins and drives the viewBox zoom. -->
			<g>
				{#each themesLaid as theme}
					{@const t = markT(introProgress, phases.themeCircle, theme.seed)}
					{@const dim = spotlightTheme && spotlightTheme !== theme.id}
					{@const active = pinnedThemeId === theme.id || hoveredThemeId === theme.id}
					<g
						class="rif-theme-hit"
						role="button"
						tabindex={0}
						aria-label="{theme.label}: {theme.total} tagged segments"
						aria-pressed={pinnedThemeId === theme.id}
						onmouseenter={() => (hoveredThemeId = theme.id)}
						onmouseleave={() => (hoveredThemeId = null)}
						onclick={() => toggleTheme(theme)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								toggleTheme(theme);
							}
						}}
					>
						<!-- Generous transparent hit area so the small theme circle is
							easy to land on; sized off the max circle radius. -->
						<circle
							cx={theme.origin.x}
							cy={theme.origin.y}
							r={THEME_MAX_R + 14}
							fill="transparent"
						/>
						<circle
							cx={theme.origin.x}
							cy={theme.origin.y}
							r={theme.finalR * t}
							fill={theme.color}
							opacity={dim ? 0.25 : active ? 0.95 : 0.78}
							class="rif-theme-node"
							class:rif-theme-node--active={active}
						/>
					</g>
				{/each}
			</g>

			<!-- Connector strands -->
			<g aria-hidden="true" style:opacity={connectorOpacity}>
				{#each subsLaid as sub}
					{@const highlit = isSubHighlit(sub)}
					{@const dim = isSubDimmed(sub)}
					<path
						d={sub.path}
						stroke="url(#rif-taper-{sub.id})"
						class="rif-strand"
						class:rif-strand--flow={introDone}
						class:rif-strand--dim={dim}
						style:--strand-delay="{(sub.seed * 6).toFixed(2)}s"
						opacity={dim ? 0.18 : highlit ? 1 : 0.7}
						stroke-width={highlit ? 1.6 : 1}
					/>
				{/each}
			</g>

			<!-- Keyword layer — gray, dimmed until subtheme/keyword is engaged -->
			<g>
				{#each subsLaid as sub}
					{@const subHighlit = isSubHighlit(sub)}
					{@const subDim = isSubDimmed(sub)}
					{#each sub.keywordNodes as kw (kw.id)}
						{@const t = markT(introProgress, phases.keyword, kw.seed)}
						{@const r = kw.finalR * t}
						{@const kwKey = sub.id + ':' + kw.id}
						{@const kwHovered = hoveredKeywordKey === kwKey}
						{@const opacity = kwHovered
							? 1
							: subHighlit
								? 0.6
								: subDim
									? 0.06
									: 0.22}
						<circle
							cx={kw.x}
							cy={kw.y}
							r={r}
							fill={C_KEYWORD}
							class="rif-keyword"
							class:rif-keyword--hovered={kwHovered}
							{opacity}
							role="button"
							tabindex={0}
							aria-label="{kw.label}: {kw.count} mentions in {sub.label}"
							onmouseenter={(e) => {
								hoveredKeywordKey = kwKey;
								tooltipPos = { x: e.clientX, y: e.clientY };
							}}
							onmouseleave={() => {
								hoveredKeywordKey = null;
								tooltipPos = null;
							}}
							onmousemove={(e) => {
								tooltipPos = { x: e.clientX, y: e.clientY };
							}}
							onclick={(e) => {
								e.stopPropagation();
								selectKeyword(sub, kw);
							}}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									selectKeyword(sub, kw);
								}
							}}
						/>
					{/each}
				{/each}
			</g>

			<!-- Sentiment circles — one per bucket per subtheme -->
			<g>
				{#each subsLaid as sub}
					{@const highlit = isSubHighlit(sub)}
					{@const dim = isSubDimmed(sub)}
					{@const groupOpacity = dim ? 0.2 : 1}
					<g
						class="rif-sub-group"
						role="button"
						tabindex={0}
						aria-label="{sub.label}: {sub.total} tagged segments"
						aria-pressed={activeId === sub.id}
						onmouseenter={(e) => {
							hoveredSubId = sub.id;
							tooltipPos = { x: e.clientX, y: e.clientY };
						}}
						onmouseleave={() => {
							hoveredSubId = null;
							tooltipPos = null;
						}}
						onmousemove={(e) => {
							tooltipPos = { x: e.clientX, y: e.clientY };
						}}
						onclick={() => selectSub(sub)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								selectSub(sub);
							}
						}}
						opacity={groupOpacity}
					>
						<!-- elongated hit area covering the tangential cluster spread -->
						<ellipse
							cx={sub.anchor.x}
							cy={sub.anchor.y}
							rx={SENTIMENT_SPACING * 2 + SENTIMENT_MAX_R + 4}
							ry={SENTIMENT_MAX_R + 6}
							transform="rotate({((sub.angle + Math.PI / 2) * 180) / Math.PI} {sub.anchor.x} {sub.anchor.y})"
							fill="transparent"
						/>
						{#each sub.sentimentCircles as c}
							{@const t = markT(introProgress, phases.sentiment, c.seed)}
							<circle
								cx={c.x}
								cy={c.y}
								r={c.finalR * t}
								fill={c.color}
								opacity="0.8"
								class="rif-sentiment"
								class:rif-sentiment--highlit={highlit}
							/>
						{/each}
					</g>
				{/each}
			</g>

			<!-- Theme labels — innermost layer, fade in first -->
			<g aria-hidden="true" style:opacity={themeLabelOpacity}>
				{#each themesLaid as theme}
					{@const dim = spotlightTheme && spotlightTheme !== theme.id}
					<text
						x={theme.labelPos.x}
						y={theme.labelPos.y}
						text-anchor="middle"
						dominant-baseline="middle"
						class="rif-theme-label"
						style:fill={theme.color}
						opacity={dim ? 0.25 : 0.85}
					>{theme.label}</text>
				{/each}
			</g>

			<!-- Keyword labels — only visible at theme focus; rotated radially so
				they fan out from chart centre instead of stacking horizontally. -->
			{#if pinnedThemeId}
				<g aria-hidden="true">
					{#each subsLaid as sub}
						{#if sub.themeId === pinnedThemeId}
							{#each sub.keywordNodes as kw, i}
								{@const dx = kw.x - sub.anchor.x}
								{@const dy = kw.y - sub.anchor.y}
								{@const dist = Math.hypot(dx, dy) || 1}
								{@const ux = dx / dist}
								{@const uy = dy / dist}
								{@const lx = kw.x + ux * (kw.finalR + 5)}
								{@const ly = kw.y + uy * (kw.finalR + 5)}
								{@const angleRad = Math.atan2(ly - CY, lx - CX)}
								{@const angleDeg = (angleRad * 180) / Math.PI}
								{@const flipped = Math.cos(angleRad) < 0}
								{@const rotateDeg = flipped ? angleDeg + 180 : angleDeg}
								<text
									transform="translate({lx.toFixed(1)},{ly.toFixed(1)}) rotate({rotateDeg.toFixed(1)})"
									text-anchor={flipped ? 'end' : 'start'}
									dominant-baseline="middle"
									class="rif-keyword-label"
									style:--kw-label-delay="{(i * 45 + sub.seed * 200).toFixed(0)}ms"
									style:fill={sub.themeColor}
								>{kw.label}</text>
							{/each}
						{/if}
					{/each}
				</g>
			{/if}

			<!-- Subtheme labels — outer ring by default; line-along when the parent
				theme is pinned (lets the focused view use the empty space along the
				connector strands instead of cramming labels past the keyword arc). -->
			<g aria-hidden="true" style:opacity={subLabelOpacity}>
				{#each subsLaid as sub}
					{#if pinnedThemeId === sub.themeId}
						{@const lp = lineLabelPlacement(sub.origin, sub.anchor, 12)}
						{@const highlit = isSubHighlit(sub)}
						<text
							transform="translate({lp.x.toFixed(1)},{lp.y.toFixed(1)}) rotate({lp.rotateDeg.toFixed(1)})"
							text-anchor="middle"
							dominant-baseline="middle"
							class="rif-sub-label rif-sub-label--line"
							class:rif-sub-label--active={highlit}
							style:fill={sub.themeColor}
						>{truncate(sub.label)}</text>
					{:else}
						{@const labelPos = pt(sub.angle, R_LABEL)}
						{@const isLeft = Math.cos(sub.angle) < -0.05}
						{@const highlit = isSubHighlit(sub)}
						{@const dim = isSubDimmed(sub)}
						<text
							x={labelPos.x}
							y={labelPos.y}
							text-anchor={isLeft ? 'end' : 'start'}
							dominant-baseline="middle"
							class="rif-sub-label"
							class:rif-sub-label--active={highlit}
							style:fill={sub.themeColor}
							opacity={dim ? 0.25 : 1}
						>{truncate(sub.label)}</text>
					{/if}
				{/each}
			</g>
		</svg>
	</div>

	<div class="rif-legend" aria-label="Sentiment colour legend">
		<span class="rif-legend-item">
			<span class="rif-swatch" style:background={C_VERY_NEG}></span>Very Negative
		</span>
		<span class="rif-legend-item">
			<span class="rif-swatch" style:background={C_NEG}></span>Negative
		</span>
		<span class="rif-legend-item">
			<span class="rif-swatch" style:background={C_NEU}></span>Neutral
		</span>
		<span class="rif-legend-item">
			<span class="rif-swatch" style:background={C_POS}></span>Positive
		</span>
		<span class="rif-legend-item">
			<span class="rif-swatch" style:background={C_VERY_POS}></span>Very Positive
		</span>
		<span class="rif-legend-item">
			<span class="rif-swatch rif-swatch--keyword" style:background={C_KEYWORD}></span>Keyword
		</span>
	</div>

	{#if hoveredKeyword && tooltipPos}
		<div
			class="rif-tooltip"
			role="tooltip"
			style:left="{tooltipPos.x + 14}px"
			style:top="{tooltipPos.y - 12}px"
		>
			<p class="rif-tt-label">{hoveredKeyword.kw.label}</p>
			<p class="rif-tt-sub" style:color={hoveredKeyword.sub.themeColor}>
				in {hoveredKeyword.sub.label}
			</p>
			<p class="rif-tt-total">{hoveredKeyword.kw.count} mentions</p>
		</div>
	{:else if hoveredSub && tooltipPos}
		<div
			class="rif-tooltip"
			role="tooltip"
			style:left="{tooltipPos.x + 14}px"
			style:top="{tooltipPos.y - 12}px"
		>
			<p class="rif-tt-label">{hoveredSub.label}</p>
			<p class="rif-tt-total">{hoveredSub.total} tagged segments</p>
			<div class="rif-tt-rows">
				{#if (hoveredSub.veryNegative ?? 0) > 0}
					<span class="rif-tt-very-neg"
						>{hoveredSub.veryNegative} very negative ({pct(
							hoveredSub.veryNegative ?? 0,
							hoveredSub.total
						)})</span
					>
				{/if}
				<span class="rif-tt-neg"
					>{hoveredSub.negative} negative ({pct(hoveredSub.negative, hoveredSub.total)})</span
				>
				<span class="rif-tt-neu"
					>{hoveredSub.neutral} neutral ({pct(hoveredSub.neutral, hoveredSub.total)})</span
				>
				<span class="rif-tt-pos"
					>{hoveredSub.positive} positive ({pct(hoveredSub.positive, hoveredSub.total)})</span
				>
				{#if (hoveredSub.veryPositive ?? 0) > 0}
					<span class="rif-tt-very-pos"
						>{hoveredSub.veryPositive} very positive ({pct(
							hoveredSub.veryPositive ?? 0,
							hoveredSub.total
						)})</span
					>
				{/if}
			</div>
			{#if hoveredSub.keywordNodes.length}
				<p class="rif-tt-kw-hint">{hoveredSub.keywordNodes.length} keywords nearby</p>
			{/if}
			{#if hoveredSub.description}
				<p class="rif-tt-desc">{hoveredSub.description}</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.rif-root {
		position: relative;
		width: 100%;
		font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
	}

	.rif-title {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 1rem;
		font-weight: 600;
		color: var(--ink, #312f28);
		margin: 0 0 0.2rem;
	}

	.rif-subtitle {
		font-size: 0.8125rem;
		color: var(--gray, #707070);
		margin: 0 0 0.75rem;
	}

	.rif-scroll-wrap {
		width: 100%;
		overflow-x: auto;
	}

	.rif-svg {
		width: 100%;
		min-width: 520px;
		display: block;
	}

	/* Connectors */
	.rif-strand {
		fill: none;
		transition: opacity 0.2s, stroke-width 0.2s;
	}

	.rif-strand--flow {
		stroke-dasharray: 2 9;
		animation: rif-flow 14s linear infinite;
		animation-delay: var(--strand-delay, 0s);
	}

	.rif-strand--dim {
		animation-play-state: paused;
	}

	@keyframes rif-flow {
		to {
			stroke-dashoffset: -220;
		}
	}

	/* Sentiment marks */
	.rif-sub-group {
		cursor: pointer;
		outline: none;
		transition: opacity 0.2s;
	}

	.rif-sentiment {
		transition: filter 0.18s;
	}

	.rif-sentiment--highlit {
		filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.08));
	}

	/* Keyword marks */
	.rif-keyword {
		cursor: pointer;
		outline: none;
		transition: opacity 0.18s;
	}

	.rif-keyword--hovered {
		filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.18));
	}

	/* Segment background — soft wedge fill that highlights the active theme */
	.rif-segment-bg {
		transition: opacity 0.25s ease-out;
	}

	/* Theme circles — small, central anchors for each theme group */
	.rif-theme-hit {
		cursor: pointer;
		outline: none;
	}

	.rif-theme-node {
		transition: opacity 0.18s, r 0.2s;
		pointer-events: none;
	}

	.rif-theme-node--active {
		filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.18));
	}

	/* Keyword labels — only mounted when a theme is pinned; fade in via CSS */
	.rif-keyword-label {
		font-size: 8.5px;
		font-weight: 500;
		opacity: 0;
		pointer-events: none;
		animation: rif-kw-label-in 0.4s ease-out var(--kw-label-delay, 0s) forwards;
	}

	@keyframes rif-kw-label-in {
		from { opacity: 0; }
		to { opacity: 0.9; }
	}

	/* Labels */
	.rif-theme-label {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 9.5px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		pointer-events: none;
		transition: opacity 0.18s;
	}

	.rif-sub-label {
		font-size: 10px;
		font-weight: 500;
		opacity: 0.85;
		transition: opacity 0.18s, font-weight 0.18s;
	}

	.rif-sub-label--active {
		opacity: 1;
		font-weight: 700;
	}

	/* Line-along variant — sits on the bezier strand at theme focus */
	.rif-sub-label--line {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.01em;
		paint-order: stroke fill;
		stroke: var(--paper, #faf7f2);
		stroke-width: 3.5px;
		stroke-linejoin: round;
	}

	/* Legend */
	.rif-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 1.5rem;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 0 0;
	}

	.rif-legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		color: var(--gray, #707070);
	}

	.rif-swatch {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.rif-swatch--keyword {
		width: 6px;
		height: 6px;
	}

	/* Tooltip */
	.rif-tooltip {
		position: fixed;
		z-index: 200;
		background: var(--card, #fff);
		border: 1px solid var(--panel-dark, #e7e5e2);
		border-radius: 6px;
		padding: 0.625rem 0.75rem;
		box-shadow: 0 2px 14px rgba(0, 0, 0, 0.08);
		pointer-events: none;
		min-width: 175px;
		max-width: 235px;
	}

	.rif-tt-label {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--ink, #312f28);
		margin: 0 0 0.25rem;
	}

	.rif-tt-sub {
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin: 0 0 0.4rem;
	}

	.rif-tt-total {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--ink, #312f28);
		margin: 0 0 0.4rem;
	}

	.rif-tt-rows {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.rif-tt-very-neg { font-size: 0.6875rem; color: #e11d48; }
	.rif-tt-neg     { font-size: 0.6875rem; color: #fb7185; }
	.rif-tt-neu     { font-size: 0.6875rem; color: var(--gray, #707070); }
	.rif-tt-pos     { font-size: 0.6875rem; color: #34d399; }
	.rif-tt-very-pos{ font-size: 0.6875rem; color: #059669; }

	.rif-tt-kw-hint {
		font-size: 0.6875rem;
		color: var(--gray, #707070);
		font-style: italic;
		margin: 0.4rem 0 0;
	}

	.rif-tt-desc {
		font-size: 0.6875rem;
		color: var(--gray, #707070);
		margin: 0.4rem 0 0;
		line-height: 1.45;
	}

	@media (prefers-reduced-motion: reduce) {
		.rif-strand,
		.rif-strand--flow,
		.rif-sub-group,
		.rif-sentiment,
		.rif-keyword,
		.rif-keyword-label,
		.rif-segment-bg,
		.rif-sub-label,
		.rif-theme-label {
			animation: none !important;
			transition: none;
		}
		.rif-keyword-label {
			opacity: 0.9;
		}
	}
</style>
