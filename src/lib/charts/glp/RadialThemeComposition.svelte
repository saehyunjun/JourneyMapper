<script lang="ts" module>
	export type RadialThemeCompositionDatum = {
		id: string;
		label: string;
		group?: string;
		description?: string;
		total: number;
		veryNegative?: number;
		negative: number;
		neutral: number;
		positive: number;
		veryPositive?: number;
		categories?: { id: string; label: string; value: number; color?: string }[];
		sentimentScore?: number;
		intensity?: number;
		color?: string;
		meta?: Record<string, unknown>;
	};
</script>

<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { cubicOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { resolveMotionMode, getVizMotionPreset, type VizMotionMode } from '$lib/motion/viz';

	// ── props ──────────────────────────────────────────────────────────────────
	let {
		data = [],
		title,
		subtitle,
		centerLabel,
		centerValue,
		sortBy = 'total',
		maxItems = 60,
		radiusMode = 'total',
		showOuterBubbles = true,
		selectedId = null,
		motionMode = 'dashboard',
		replayKey = 0,
		onselect
	}: {
		data: RadialThemeCompositionDatum[];
		title?: string;
		subtitle?: string;
		centerLabel?: string;
		centerValue?: string | number;
		sortBy?: 'total' | 'sentiment' | 'negative' | 'positive' | 'label';
		maxItems?: number;
		radiusMode?: 'fixed' | 'total' | 'intensity';
		showOuterBubbles?: boolean;
		selectedId?: string | null;
		motionMode?: VizMotionMode;
		replayKey?: number;
		onselect?: (datum: RadialThemeCompositionDatum) => void;
	} = $props();

	// ── layout constants ───────────────────────────────────────────────────────
	const W = 900;
	const H = 560;
	const CX = W / 2;      // 450
	const CY = H - 60;     // 500 — centre near bottom
	const R_INNER = 32;
	const R_BAR_MAX = 190;
	const R_GRID = [55, 95, 135, 175] as const;
	const R_TICK = 200;
	const R_LABEL = 218;
	const R_BUBBLE = 200;
	const BUBBLE_MAX = 20;
	const ANG_START = Math.PI;      // 180° left
	const ANG_END = 2 * Math.PI;    // 360° right

	// ── sentiment colours ──────────────────────────────────────────────────────
	const C_VERY_NEG = '#e11d48';
	const C_NEG = '#fb7185';
	const C_NEU = '#cbd5e1';
	const C_POS = '#34d399';
	const C_VERY_POS = '#059669';

	// ── group colour palette ───────────────────────────────────────────────────
	const GROUP_PALETTE = [
		'#6366f1', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899',
		'#f97316', '#3b82f6', '#84cc16', '#e11d48', '#14b8a6'
	];

	// ── resolved motion ────────────────────────────────────────────────────────
	const effectiveMode = $derived(resolveMotionMode(motionMode));

	// ── sorted + sliced data ───────────────────────────────────────────────────
	const sorted = $derived.by((): RadialThemeCompositionDatum[] => {
		const slice = [...data].slice(0, maxItems);
		switch (sortBy) {
			case 'label':
				return slice.sort((a, b) => a.label.localeCompare(b.label));
			case 'negative':
				return slice.sort(
					(a, b) => b.negative / Math.max(1, b.total) - a.negative / Math.max(1, a.total)
				);
			case 'positive':
				return slice.sort(
					(a, b) => b.positive / Math.max(1, b.total) - a.positive / Math.max(1, a.total)
				);
			case 'sentiment':
				return slice.sort(
					(a, b) =>
						(b.positive - b.negative) / Math.max(1, b.total) -
						(a.positive - a.negative) / Math.max(1, a.total)
				);
			default:
				return slice.sort((a, b) => b.total - a.total);
		}
	});

	const maxTotal = $derived(Math.max(...sorted.map((d) => d.total), 1));
	const rScale = $derived(scaleLinear([0, maxTotal], [0, R_BAR_MAX - R_INNER]));
	const minTotal = $derived(Math.min(...sorted.map((d) => d.total)));
	const bubbleRScale = $derived(scaleLinear([Math.max(0, minTotal * 0.4), maxTotal], [4, BUBBLE_MAX]));

	type ItemDatum = RadialThemeCompositionDatum & {
		angle: number;
		idx: number;
		sentScore: number;
		spokeLen: number;
		storyBucket: number; // 0=neg, 1=neutral, 2=pos — for story reveal order
	};

	const items = $derived.by((): ItemDatum[] => {
		const n = sorted.length;
		if (n === 0) return [];
		return sorted.map((d, i): ItemDatum => {
			const t = n === 1 ? 0.5 : i / (n - 1);
			const angle = ANG_START + t * (ANG_END - ANG_START);
			const sentScore =
				((d.veryPositive ?? 0) + d.positive - d.negative - (d.veryNegative ?? 0)) /
				Math.max(1, d.total);
			const spokeLen =
				radiusMode === 'fixed'
					? R_BAR_MAX - R_INNER
					: radiusMode === 'intensity'
						? (R_BAR_MAX - R_INNER) * Math.abs(sentScore)
						: rScale(d.total);
			const storyBucket = sentScore < -0.1 ? 0 : sentScore > 0.1 ? 2 : 1;
			return { ...d, angle, idx: i, sentScore, spokeLen, storyBucket };
		});
	});

	// ── group color map ────────────────────────────────────────────────────────
	const groupColorMap = $derived.by((): Map<string, string> => {
		const map = new Map<string, string>();
		let idx = 0;
		for (const item of items) {
			const g = item.group ?? '';
			if (g && !map.has(g)) {
				map.set(g, GROUP_PALETTE[idx % GROUP_PALETTE.length]);
				idx++;
			}
		}
		return map;
	});

	// ── animation: single introProgress drives all derived t values ────────────
	let introProgress = $state(0); // ms elapsed

	// Per-item sequence index for story mode (sentiment-ordered reveal)
	const storySeq = $derived.by((): number[] => {
		if (effectiveMode !== 'story') return items.map((_, i) => i);
		// Assign sequence index sorted by storyBucket then original index
		const ranked = items
			.map((item, i) => ({ i, key: item.storyBucket * 1000 + i }))
			.sort((a, b) => a.key - b.key);
		const seq = new Array(items.length);
		ranked.forEach(({ i }, s) => (seq[i] = s));
		return seq;
	});

	const itemTs = $derived(
		items.map((_, i) => {
			if (effectiveMode === 'none') return 1;
			const preset = getVizMotionPreset(effectiveMode);
			const s = effectiveMode === 'story' ? (storySeq[i] ?? i) : i;
			const start = preset.leadIn + s * preset.stagger;
			const end = start + preset.duration;
			if (introProgress <= start) return 0;
			if (introProgress >= end) return 1;
			return preset.ease((introProgress - start) / preset.duration);
		})
	);

	const labelOpacity = $derived.by(() => {
		if (effectiveMode === 'none') return 1;
		const preset = getVizMotionPreset(effectiveMode);
		const n = items.length;
		const lastSeq = n - 1;
		const lastMarkEnd = preset.leadIn + lastSeq * preset.stagger + preset.duration;
		const labelStart = lastMarkEnd + preset.labelDelay;
		const labelEnd = labelStart + preset.labelDuration;
		if (introProgress < labelStart) return 0;
		if (introProgress >= labelEnd) return 1;
		return cubicOut((introProgress - labelStart) / preset.labelDuration);
	});

	$effect(() => {
		// Track replayKey and effectiveMode for restarts; read items with untrack
		void replayKey;
		const mode = effectiveMode;
		const n = untrack(() => items.length);

		if (mode === 'none') {
			introProgress = 1e9;
			return;
		}

		introProgress = 0;

		const preset = getVizMotionPreset(mode);
		const totalMs =
			preset.leadIn +
			Math.max(0, n - 1) * preset.stagger +
			preset.duration +
			preset.labelDelay +
			preset.labelDuration +
			80;

		let t0 = 0;
		let rafId = 0;

		const tick = (now: number) => {
			if (t0 === 0) t0 = now;
			const elapsed = now - t0;
			introProgress = elapsed;
			if (elapsed < totalMs) rafId = requestAnimationFrame(tick);
		};

		rafId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafId);
	});

	// ── interaction state ──────────────────────────────────────────────────────
	let hoveredId = $state<string | null>(null);
	let tooltipPos = $state<{ x: number; y: number } | null>(null);
	let activeId = $state<string | null>(null);

	$effect(() => {
		activeId = selectedId;
	});

	const hoveredItem = $derived(items.find((d) => d.id === hoveredId) ?? null);

	// ── geometry helpers ───────────────────────────────────────────────────────
	function pt(angle: number, r: number) {
		return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
	}

	function arcPath(r: number, a1: number, a2: number): string {
		const s = pt(a1, r);
		const e = pt(a2, r);
		const large = a2 - a1 > Math.PI ? 1 : 0;
		return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
	}

	function labelTransform(angle: number): string {
		const { x, y } = pt(angle, R_LABEL);
		const deg = (angle * 180) / Math.PI;
		// Left half (180°–270°): flip so text reads from inner to outer without inverting
		const isLeft = deg >= 180 && deg <= 270;
		const rotate = isLeft ? deg + 180 : deg;
		return `translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${rotate.toFixed(1)})`;
	}

	function labelAnchor(angle: number): 'start' | 'end' {
		const deg = (angle * 180) / Math.PI;
		return deg >= 180 && deg <= 270 ? 'end' : 'start';
	}

	type Seg = { x1: number; y1: number; x2: number; y2: number; color: string };

	function buildSpoke(item: ItemDatum, t: number): Seg[] {
		const { angle, positive, neutral, negative, total } = item;
		const veryNeg = item.veryNegative ?? 0;
		const veryPos = item.veryPositive ?? 0;
		const count = veryNeg + negative + neutral + positive + veryPos || total;
		const animLen = item.spokeLen * t;
		if (animLen < 0.5 || count === 0) return [];

		const vNegR = (veryNeg / count) * animLen;
		const negR = (negative / count) * animLen;
		const neuR = (neutral / count) * animLen;
		const posR = (positive / count) * animLen;
		const vPosR = animLen - vNegR - negR - neuR - posR;

		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const segs: Seg[] = [];
		let r = R_INNER;

		if (vNegR > 0.5) {
			segs.push({
				x1: CX + r * cos, y1: CY + r * sin,
				x2: CX + (r + vNegR) * cos, y2: CY + (r + vNegR) * sin,
				color: C_VERY_NEG
			});
			r += vNegR;
		}
		if (negR > 0.5) {
			segs.push({
				x1: CX + r * cos, y1: CY + r * sin,
				x2: CX + (r + negR) * cos, y2: CY + (r + negR) * sin,
				color: C_NEG
			});
			r += negR;
		}
		if (neuR > 0.5) {
			segs.push({
				x1: CX + r * cos, y1: CY + r * sin,
				x2: CX + (r + neuR) * cos, y2: CY + (r + neuR) * sin,
				color: C_NEU
			});
			r += neuR;
		}
		if (posR > 0.5) {
			segs.push({
				x1: CX + r * cos, y1: CY + r * sin,
				x2: CX + (r + posR) * cos, y2: CY + (r + posR) * sin,
				color: C_POS
			});
			r += posR;
		}
		if (vPosR > 0.5) {
			segs.push({
				x1: CX + r * cos, y1: CY + r * sin,
				x2: CX + (r + vPosR) * cos, y2: CY + (r + vPosR) * sin,
				color: C_VERY_POS
			});
		}
		return segs;
	}

	function truncate(s: string, n = 22): string {
		return s.length > n ? s.slice(0, n - 1) + '…' : s;
	}

	function pct(n: number, total: number): string {
		return total === 0 ? '0%' : Math.round((n / total) * 100) + '%';
	}

	// ── percentage scale ticks ─────────────────────────────────────────────────
	const PCT_TICKS = [20, 40, 60, 80, 100] as const;
</script>

<div class="rtc-root">
	{#if title}
		<p class="rtc-title">{title}</p>
		{#if subtitle}<p class="rtc-subtitle">{subtitle}</p>{/if}
	{/if}

	<div class="rtc-scroll-wrap">
		<svg
			class="rtc-svg"
			viewBox="0 0 {W} {H}"
			aria-label={title ?? 'Radial theme composition chart'}
			role="img"
		>
			<!-- Decorative grid arcs -->
			<g aria-hidden="true">
				{#each R_GRID as r}
					<path d={arcPath(r, ANG_START, ANG_END)} class="rtc-grid-arc" />
				{/each}
				<line
					x1={CX + R_LABEL * Math.cos(ANG_START)}
					y1={CY + R_LABEL * Math.sin(ANG_START)}
					x2={CX}
					y2={CY}
					class="rtc-axis-line"
				/>
				<line
					x1={CX + R_LABEL * Math.cos(ANG_END)}
					y1={CY + R_LABEL * Math.sin(ANG_END)}
					x2={CX}
					y2={CY}
					class="rtc-axis-line"
				/>
			</g>

			<!-- Percentage scale labels below axis -->
			<g aria-hidden="true">
				{#each PCT_TICKS as pctVal}
					{@const r = R_INNER + (pctVal / 100) * (R_BAR_MAX - R_INNER)}
					<text x={CX + r} y={CY + 14} text-anchor="middle" class="rtc-pct-label">{pctVal}%</text>
					<text x={CX - r} y={CY + 14} text-anchor="middle" class="rtc-pct-label">{pctVal}%</text>
				{/each}
			</g>

			<!-- Spokes -->
			<g>
				{#each items as item, i}
					{@const t = itemTs[i] ?? 0}
					{@const segs = buildSpoke(item, t)}
					{@const active = hoveredId === item.id || activeId === item.id}
					{@const tickPts = t > 0.4 ? { a: pt(item.angle, R_BAR_MAX + 2), b: pt(item.angle, R_TICK) } : null}
					{@const hitA = pt(item.angle, R_INNER)}
					{@const hitB = pt(item.angle, R_TICK)}
					<g
						class="rtc-spoke-group"
						role="button"
						tabindex={0}
						aria-label="{item.label}: {item.total} tagged quotes — {item.negative} negative, {item.neutral} neutral, {item.positive} positive"
						aria-pressed={activeId === item.id}
						onmouseenter={(e) => {
							hoveredId = item.id;
							tooltipPos = { x: e.clientX, y: e.clientY };
						}}
						onmouseleave={() => {
							hoveredId = null;
							tooltipPos = null;
						}}
						onmousemove={(e) => {
							tooltipPos = { x: e.clientX, y: e.clientY };
						}}
						onclick={() => {
							activeId = item.id;
							onselect?.(item);
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								activeId = item.id;
								onselect?.(item);
							}
						}}
					>
						<!-- Transparent hit-line so pointer events register across the full spoke width -->
						<line x1={hitA.x} y1={hitA.y} x2={hitB.x} y2={hitB.y} stroke="transparent" stroke-width="16" />
						{#each segs as seg}
							<line
								x1={seg.x1}
								y1={seg.y1}
								x2={seg.x2}
								y2={seg.y2}
								stroke={seg.color}
								stroke-width={active ? 4 : 2.5}
								stroke-linecap="round"
							/>
						{/each}
						{#if tickPts}
							<line
								x1={tickPts.a.x}
								y1={tickPts.a.y}
								x2={tickPts.b.x}
								y2={tickPts.b.y}
								class="rtc-tick"
								stroke-width={active ? 1.5 : 0.75}
								opacity={Math.min(1, (t - 0.4) / 0.6)}
							/>
						{/if}
					</g>
				{/each}
			</g>

			<!-- Outer bubbles -->
			{#if showOuterBubbles}
				<g aria-hidden="true">
					{#each items as item, i}
						{@const t = itemTs[i] ?? 0}
						{#if t > 0.75}
							{@const pos = pt(item.angle, R_BUBBLE)}
							<circle
								cx={pos.x}
								cy={pos.y}
								r={bubbleRScale(item.total)}
								class="rtc-bubble"
								class:rtc-bubble--active={hoveredId === item.id || activeId === item.id}
								opacity={(t - 0.75) / 0.25}
							/>
						{/if}
					{/each}
				</g>
			{/if}

			<!-- Outer labels -->
			<g aria-hidden="true" style:opacity={labelOpacity}>
				{#each items as item}
					{@const active = hoveredId === item.id || activeId === item.id}
					{@const groupColor = item.group ? (groupColorMap.get(item.group) ?? null) : null}
					<text
						transform={labelTransform(item.angle)}
						text-anchor={labelAnchor(item.angle)}
						dominant-baseline="middle"
						class="rtc-label"
						class:rtc-label--active={active}
						style:fill={groupColor ?? 'var(--ink, #312f28)'}
					>{truncate(item.label)}</text>
				{/each}
			</g>

			<!-- Centre label -->
			{#if centerValue != null || centerLabel}
				<g aria-hidden="true">
					{#if centerValue != null}
						<text x={CX} y={CY - 20} text-anchor="middle" class="rtc-centre-value"
							>{centerValue}</text
						>
					{/if}
					{#if centerLabel}
						<text x={CX} y={CY - 4} text-anchor="middle" class="rtc-centre-label"
							>{centerLabel}</text
						>
					{/if}
				</g>
			{/if}
		</svg>
	</div>

	<!-- Legend -->
	<div class="rtc-legend" aria-label="Sentiment colour legend">
		<span class="rtc-legend-item">
			<span class="rtc-swatch" style:background={C_VERY_NEG}></span>Very Negative
		</span>
		<span class="rtc-legend-item">
			<span class="rtc-swatch" style:background={C_NEG}></span>Negative
		</span>
		<span class="rtc-legend-item">
			<span class="rtc-swatch" style:background={C_NEU}></span>Neutral
		</span>
		<span class="rtc-legend-item">
			<span class="rtc-swatch" style:background={C_POS}></span>Positive
		</span>
		<span class="rtc-legend-item">
			<span class="rtc-swatch" style:background={C_VERY_POS}></span>Very Positive
		</span>
		<span class="rtc-legend-item rtc-legend-bubble">
			<span class="rtc-bubble-legend"></span>Segment volume
		</span>
	</div>

	<!-- Tooltip (fixed to viewport) -->
	{#if hoveredItem && tooltipPos}
		<div
			class="rtc-tooltip"
			role="tooltip"
			style:left="{tooltipPos.x + 14}px"
			style:top="{tooltipPos.y - 12}px"
		>
			<p class="rtc-tt-label">{hoveredItem.label}</p>
			{#if hoveredItem.group}<p class="rtc-tt-group">{hoveredItem.group}</p>{/if}
			<p class="rtc-tt-total">{hoveredItem.total} tagged quotes</p>
			<div class="rtc-tt-rows">
				{#if (hoveredItem.veryNegative ?? 0) > 0}
					<span class="rtc-tt-very-neg">{hoveredItem.veryNegative} very negative ({pct(hoveredItem.veryNegative ?? 0, hoveredItem.total)})</span>
				{/if}
				<span class="rtc-tt-neg"
					>{hoveredItem.negative} negative ({pct(hoveredItem.negative, hoveredItem.total)})</span
				>
				<span class="rtc-tt-neu"
					>{hoveredItem.neutral} neutral ({pct(hoveredItem.neutral, hoveredItem.total)})</span
				>
				<span class="rtc-tt-pos"
					>{hoveredItem.positive} positive ({pct(hoveredItem.positive, hoveredItem.total)})</span
				>
				{#if (hoveredItem.veryPositive ?? 0) > 0}
					<span class="rtc-tt-very-pos">{hoveredItem.veryPositive} very positive ({pct(hoveredItem.veryPositive ?? 0, hoveredItem.total)})</span>
				{/if}
			</div>
			{#if hoveredItem.description}
				<p class="rtc-tt-desc">{hoveredItem.description}</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.rtc-root {
		position: relative;
		width: 100%;
		font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
	}

	.rtc-title {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 1rem;
		font-weight: 600;
		color: var(--ink, #312f28);
		margin: 0 0 0.2rem;
	}

	.rtc-subtitle {
		font-size: 0.8125rem;
		color: var(--gray, #707070);
		margin: 0 0 0.75rem;
	}

	.rtc-scroll-wrap {
		width: 100%;
		overflow-x: auto;
	}

	.rtc-svg {
		width: 100%;
		min-width: 480px;
		display: block;
	}

	/* Grid */
	.rtc-grid-arc {
		fill: none;
		stroke: var(--panel-mid, #d9dacf);
		stroke-width: 0.5;
		stroke-dasharray: 2 4;
	}

	.rtc-axis-line {
		stroke: var(--panel-mid, #d9dacf);
		stroke-width: 0.5;
	}

	/* Spokes */
	.rtc-spoke-group {
		cursor: pointer;
		outline: none;
	}

	.rtc-spoke-group:focus-visible line {
		stroke-width: 4;
	}

	.rtc-tick {
		stroke: var(--panel-mid, #d9dacf);
	}

	/* Labels */
	.rtc-label {
		font-size: 9.5px;
		opacity: 0.65;
		transition: opacity 0.12s;
	}

	.rtc-label--active {
		opacity: 1;
		font-weight: 600;
	}

	/* Percentage scale labels */
	.rtc-pct-label {
		font-size: 8px;
		fill: var(--gray, #707070);
		opacity: 0.7;
	}

	/* Outer bubbles */
	.rtc-bubble {
		fill: none;
		stroke: var(--ink, #312f28);
		stroke-width: 0.75;
		transition: stroke-width 0.12s;
	}

	.rtc-bubble--active {
		stroke-width: 1.5;
	}

	/* Centre */
	.rtc-centre-value {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 13px;
		font-weight: 600;
		fill: var(--ink, #312f28);
		letter-spacing: 0.02em;
	}

	.rtc-centre-label {
		font-size: 10px;
		fill: var(--gray, #707070);
		letter-spacing: 0.04em;
	}

	/* Legend */
	.rtc-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 1.5rem;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 0 0;
	}

	.rtc-legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		color: var(--gray, #707070);
	}

	.rtc-swatch {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.rtc-bubble-legend {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 0.75px solid var(--ink, #312f28);
		flex-shrink: 0;
	}

	/* Tooltip */
	.rtc-tooltip {
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

	.rtc-tt-label {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--ink, #312f28);
		margin: 0 0 0.1rem;
	}

	.rtc-tt-group {
		font-size: 0.6875rem;
		color: var(--gray, #707070);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin: 0 0 0.4rem;
	}

	.rtc-tt-total {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--ink, #312f28);
		margin: 0 0 0.4rem;
	}

	.rtc-tt-rows {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.rtc-tt-very-neg {
		font-size: 0.6875rem;
		color: #e11d48;
	}
	.rtc-tt-neg {
		font-size: 0.6875rem;
		color: #fb7185;
	}
	.rtc-tt-neu {
		font-size: 0.6875rem;
		color: var(--gray, #707070);
	}
	.rtc-tt-pos {
		font-size: 0.6875rem;
		color: #34d399;
	}
	.rtc-tt-very-pos {
		font-size: 0.6875rem;
		color: #059669;
	}

	.rtc-tt-desc {
		font-size: 0.6875rem;
		color: var(--gray, #707070);
		margin: 0.4rem 0 0;
		line-height: 1.45;
	}

	@media (prefers-reduced-motion: reduce) {
		.rtc-label {
			transition: none;
		}
		.rtc-bubble {
			transition: none;
		}
	}
</style>
