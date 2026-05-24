<!--
	BubbleChart — editorial proportional-bubble chart for 3–5 categories.

	Built for PatientlyIQ-style "what matters most" callouts: a single SVG with
	four layout variants (horizontal, vertical, packed cluster, center-emphasis).
	Layout is normally chosen from the host `context` so a key-finding card,
	export card, and profile page each get the right shape automatically; the
	`variant` prop forces a specific layout, and `allowUserOverride` adds a
	small in-chart toggle for the user to cycle through them.

	Self-contained: no chart library, no d3. Bubble area scales linearly to
	value; per-bubble labeling follows the editorial rules (inside for big,
	leader-line out for small). Motion reuses `$lib/motion/viz` so the entrance
	choreography matches SentimentDonut and other vizzes in the project.
-->
<script lang="ts" module>
	export type BubbleVariant = 'horizontal' | 'vertical' | 'cluster' | 'center';
	export type BubbleContext = 'auto' | 'finding' | 'export' | 'profile' | 'card';

	// Past ~0.55 the tinted bubble reads dark enough that white text wins; under
	// that, the project ink stays legible on the lighter tint.
	export function contrastText(opacity: number): string {
		return opacity >= 0.55 ? '#FFFFFF' : 'var(--ink, #312F28)';
	}
</script>

<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import {
		getArcTweenConfig,
		getLabelRevealConfig,
		getIntroTotalDuration,
		resolveMotionMode,
		type VizMotionMode
	} from '$lib/motion/viz';

	let {
		items,
		values,
		labels = undefined,
		title = undefined,
		units = '%',
		context = 'auto',
		variant: variantProp = undefined,
		allowUserOverride = true,
		width = 480,
		height = 320,
		palette = undefined,
		motionMode = 'dashboard',
		replayKey = 0,
		reducedMotion = undefined,
		onintrocomplete
	}: {
		items: string[];
		values: number[];
		labels?: string[];
		title?: string;
		/** Suffix appended to numeric value text. '%' by default. Pass '' to hide. */
		units?: string;
		/** Caller's surface — drives auto-variant when `variant` is undefined. */
		context?: BubbleContext;
		/** Force a layout. Wins over `context`. */
		variant?: BubbleVariant;
		/** Show the inline variant cycler in the top-right. */
		allowUserOverride?: boolean;
		width?: number;
		height?: number;
		/** Override the default monochrome ramp. One color per item; rank-ordered. */
		palette?: string[];
		motionMode?: VizMotionMode;
		replayKey?: number;
		reducedMotion?: boolean;
		onintrocomplete?: () => void;
	} = $props();

	// ------- variant resolution -------------------------------------------------

	function autoVariantFor(ctx: BubbleContext, vals: number[]): BubbleVariant {
		if (ctx === 'finding') return 'horizontal';
		if (ctx === 'export') return 'center';
		if (ctx === 'profile') return 'vertical';
		if (ctx === 'card') return 'cluster';
		const n = vals.length;
		const max = Math.max(...vals, 1);
		const positives = vals.filter((v) => v > 0);
		const min = positives.length ? Math.min(...positives) : max;
		if (max / Math.max(min, 1) >= 3.2) return 'center';
		if (n <= 3) return 'horizontal';
		return 'cluster';
	}

	let userVariant = $state<BubbleVariant | null>(null);

	const resolvedVariant = $derived<BubbleVariant>(
		userVariant ?? variantProp ?? autoVariantFor(context, values)
	);

	// ------- data + layout (single derived pass) --------------------------------

	type Placement = {
		index: number;
		cx: number;
		cy: number;
		r: number;
		rank: number;
		item: string;
		label: string;
		value: number;
		valueText: string;
		fill: string;
		opacity: number;
		labelMode: 'in' | 'below' | 'right' | 'leader';
		anchor?: { x: number; y: number; side: 'left' | 'right' | 'below' };
	};

	const PADDING = { top: 24, right: 28, bottom: 32, left: 28 };
	const MIN_R = 14;
	const DEFAULT_OPACITY_RAMP = [0.92, 0.78, 0.62, 0.48, 0.36];
	const DEFAULT_FILL = 'var(--darkgrayblue, #294457)';

	function formatValue(v: number, u: string): string {
		const isInt = Number.isInteger(v);
		const num = isInt ? v.toString() : v.toFixed(1);
		return u ? `${num}${u}` : num;
	}

	const charWidth = (fontSize: number) => fontSize * 0.55;
	const labelFitsInside = (text: string, fontSize: number, diameter: number) =>
		text.length * charWidth(fontSize) + 14 <= diameter;
	const valueFitsInside = (text: string, fontSize: number, diameter: number) =>
		text.length * charWidth(fontSize) + 8 <= diameter;

	const placements = $derived.by<Placement[]>(() => {
		const n = items.length;
		if (n === 0) return [];

		// Rank → style mapping (largest gets fullest opacity / first palette slot).
		const order = items.map((_, i) => i).sort((a, b) => (values[b] ?? 0) - (values[a] ?? 0));
		const rankOf = new Map<number, number>();
		order.forEach((idx, rank) => rankOf.set(idx, rank));

		const base = items.map((item, i) => {
			const value = values[i] ?? 0;
			const rank = rankOf.get(i) ?? 0;
			const fill = palette?.[rank] ?? DEFAULT_FILL;
			const opacity = palette
				? 1
				: DEFAULT_OPACITY_RAMP[Math.min(rank, DEFAULT_OPACITY_RAMP.length - 1)];
			return {
				index: i,
				rank,
				item,
				label: labels?.[i] ?? item,
				value,
				valueText: formatValue(value, units),
				fill,
				opacity
			};
		});

		const maxV = Math.max(...values, 1);
		const innerW = width - PADDING.left - PADDING.right;
		const innerH = height - PADDING.top - PADDING.bottom;

		switch (resolvedVariant) {
			case 'horizontal':
				return layoutHorizontal(base, maxV, innerW, innerH);
			case 'vertical':
				return layoutVertical(base, maxV, innerW, innerH);
			case 'center':
				return layoutCenter(base, maxV, innerW, innerH);
			case 'cluster':
			default:
				return layoutCluster(base, maxV, innerW, innerH);
		}
	});

	type BaseDatum = ReturnType<typeof makeBaseDatum>;
	function makeBaseDatum() {
		return {
			index: 0,
			rank: 0,
			item: '',
			label: '',
			value: 0,
			valueText: '',
			fill: '',
			opacity: 1
		};
	}

	function radiiFor(vals: number[], maxV: number, maxR: number): number[] {
		return vals.map((v) => Math.max(MIN_R, Math.sqrt(Math.max(v, 0) / maxV) * maxR));
	}

	function layoutHorizontal(
		base: BaseDatum[],
		maxV: number,
		innerW: number,
		innerH: number
	): Placement[] {
		const n = base.length;
		const gap = 14;
		const sumRoots = values.reduce((s, v) => s + Math.sqrt(Math.max(v, 0) / maxV), 0);
		const candidate = (innerW - (n - 1) * gap) / (2 * Math.max(sumRoots, 0.0001));
		const maxR = Math.max(MIN_R, Math.min(candidate, innerH * 0.55));
		const rs = radiiFor(values, maxV, maxR);
		const totalW = rs.reduce((s, r) => s + 2 * r, 0) + (n - 1) * gap;
		const startX = PADDING.left + (innerW - totalW) / 2;
		const baselineY = PADDING.top + innerH * 0.5;

		let cursor = startX;
		return base.map((d, i) => {
			const r = rs[i];
			const cx = cursor + r;
			cursor += 2 * r + gap;
			const fontInside = Math.max(11, Math.min(18, r * 0.36));
			const labelMode: Placement['labelMode'] = labelFitsInside(d.label, fontInside, 2 * r)
				? 'in'
				: 'below';
			return {
				...d,
				cx,
				cy: baselineY,
				r,
				labelMode,
				anchor:
					labelMode === 'below' ? { x: cx, y: baselineY + r + 14, side: 'below' as const } : undefined
			};
		});
	}

	function layoutVertical(
		base: BaseDatum[],
		maxV: number,
		innerW: number,
		innerH: number
	): Placement[] {
		const n = base.length;
		const rowGap = 10;
		const colW = Math.min(innerW * 0.32, innerH / 1.2);
		const maxR = Math.min(colW / 2, (innerH - (n - 1) * rowGap) / (2 * n));
		const rs = radiiFor(values, maxV, maxR);
		const rowH = (innerH - (n - 1) * rowGap) / n;

		const sorted = base.map((d) => d.index).sort((a, b) => values[b] - values[a]);
		const out: Placement[] = new Array(n);
		sorted.forEach((i, row) => {
			const r = rs[i];
			const cx = PADDING.left + maxR;
			const cy = PADDING.top + rowH * row + rowH / 2;
			out[i] = {
				...base[i],
				cx,
				cy,
				r,
				labelMode: 'right',
				anchor: { x: cx + maxR + 16, y: cy, side: 'right' as const }
			};
		});
		return out;
	}

	function layoutCenter(
		base: BaseDatum[],
		maxV: number,
		innerW: number,
		innerH: number
	): Placement[] {
		const cx0 = width / 2;
		const cy0 = height / 2;
		const innerR = Math.min(innerW, innerH) / 2;
		const heroR = innerR * 0.58;

		const sorted = base.map((d) => d.index).sort((a, b) => values[b] - values[a]);
		const heroIdx = sorted[0];
		const satellites = sorted.slice(1);

		const rs = values.map((v, i) =>
			i === heroIdx ? heroR : Math.max(MIN_R, Math.sqrt(v / maxV) * heroR * 0.78)
		);

		const out: Placement[] = new Array(base.length);
		out[heroIdx] = {
			...base[heroIdx],
			cx: cx0,
			cy: cy0,
			r: rs[heroIdx],
			labelMode: 'in'
		};

		const maxSatR = satellites.length ? Math.max(...satellites.map((i) => rs[i])) : MIN_R;
		const ringR = heroR + maxSatR + 18;
		const start = -Math.PI / 2 - Math.PI / Math.max(satellites.length, 2);
		satellites.forEach((i, k) => {
			const angle = start + ((Math.PI * 2) / Math.max(satellites.length, 1)) * k;
			const cx = cx0 + Math.cos(angle) * ringR;
			const cy = cy0 + Math.sin(angle) * ringR;
			const r = rs[i];
			const fontInside = Math.max(10, Math.min(14, r * 0.34));
			const fits = labelFitsInside(base[i].label, fontInside, 2 * r);
			const side: 'left' | 'right' | 'below' =
				cx < cx0 - 4 ? 'left' : cx > cx0 + 4 ? 'right' : 'below';
			out[i] = {
				...base[i],
				cx,
				cy,
				r,
				labelMode: fits ? 'in' : 'leader',
				anchor: fits
					? undefined
					: {
							x: side === 'left' ? cx - r - 10 : side === 'right' ? cx + r + 10 : cx,
							y: side === 'below' ? cy + r + 14 : cy,
							side
						}
			};
		});
		return out;
	}

	function layoutCluster(
		base: BaseDatum[],
		maxV: number,
		innerW: number,
		innerH: number
	): Placement[] {
		const n = base.length;
		const cx0 = width / 2;
		const cy0 = height / 2 + 4;
		const inner = Math.min(innerW, innerH);
		const maxR = inner * 0.27;
		const rs = radiiFor(values, maxV, maxR);

		const templates: Record<number, Array<[number, number]>> = {
			3: [
				[0, -0.32],
				[-0.32, 0.22],
				[0.32, 0.22]
			],
			4: [
				[-0.28, -0.22],
				[0.28, -0.22],
				[-0.28, 0.24],
				[0.28, 0.24]
			],
			5: [
				[0, 0],
				[-0.36, -0.22],
				[0.36, -0.22],
				[-0.32, 0.28],
				[0.32, 0.28]
			]
		};
		const tpl = templates[n];
		const sorted = base.map((d) => d.index).sort((a, b) => values[b] - values[a]);

		const out: Placement[] = new Array(n);
		const place = (idx: number, ox: number, oy: number) => {
			const r = rs[idx];
			const cx = cx0 + ox * inner;
			const cy = cy0 + oy * inner;
			const fontInside = Math.max(10, Math.min(15, r * 0.32));
			const fits = labelFitsInside(base[idx].label, fontInside, 2 * r);
			out[idx] = {
				...base[idx],
				cx,
				cy,
				r,
				labelMode: fits ? 'in' : 'below',
				anchor: fits ? undefined : { x: cx, y: cy + r + 14, side: 'below' as const }
			};
		};

		if (tpl) {
			sorted.forEach((i, rank) => {
				const [ox, oy] = tpl[rank];
				place(i, ox, oy);
			});
		} else {
			sorted.forEach((i, rank) => {
				const angle = (Math.PI * 2 * rank) / n - Math.PI / 2;
				place(i, Math.cos(angle) * 0.32, Math.sin(angle) * 0.32);
			});
		}
		return out;
	}

	// ------- motion -------------------------------------------------------------

	const effectiveMode = $derived(resolveMotionMode(motionMode, reducedMotion));

	let mounted = $state(false);
	let revealTick = $state(0);
	let introTimer: ReturnType<typeof setTimeout> | null = null;

	function bubbleDelay(rank: number): number {
		return getArcTweenConfig(effectiveMode, rank).delay;
	}
	const bubbleDuration = $derived(getArcTweenConfig(effectiveMode, 0).duration);
	const labelCfg = $derived(getLabelRevealConfig(effectiveMode, items.length));

	function startIntro() {
		if (introTimer) clearTimeout(introTimer);
		revealTick++;
		if (effectiveMode === 'none') return;
		if (onintrocomplete) {
			introTimer = setTimeout(
				() => onintrocomplete?.(),
				getIntroTotalDuration(effectiveMode, items.length)
			);
		}
	}

	onMount(() => {
		mounted = true;
		startIntro();
		return () => {
			if (introTimer) clearTimeout(introTimer);
		};
	});

	$effect(() => {
		void replayKey;
		void effectiveMode;
		void resolvedVariant;
		if (!mounted) return;
		untrack(() => startIntro());
	});

	// ------- variant cycler UI --------------------------------------------------

	const VARIANT_ORDER: BubbleVariant[] = ['horizontal', 'vertical', 'cluster', 'center'];
	const VARIANT_LABEL: Record<BubbleVariant, string> = {
		horizontal: 'Row',
		vertical: 'Stack',
		cluster: 'Cluster',
		center: 'Hero'
	};

	function selectVariant(v: BubbleVariant) {
		userVariant = v;
	}
	function resetVariant() {
		userVariant = null;
	}
</script>

<figure
	class="bubble-chart"
	style="width: {width}px;"
	aria-label={title ?? `Bubble chart of ${items.join(', ')}`}
>
	{#if title || allowUserOverride}
		<header class="head">
			{#if title}
				<h3 class="title">{title}</h3>
			{:else}
				<span></span>
			{/if}
			{#if allowUserOverride}
				<div class="cycler" role="group" aria-label="Layout variant">
					{#each VARIANT_ORDER as v (v)}
						<button
							type="button"
							class="chip"
							class:active={resolvedVariant === v}
							aria-pressed={resolvedVariant === v}
							onclick={() => selectVariant(v)}
						>
							{VARIANT_LABEL[v]}
						</button>
					{/each}
					{#if userVariant}
						<button
							type="button"
							class="chip reset"
							onclick={resetVariant}
							title="Return to auto layout">Auto</button
						>
					{/if}
				</div>
			{/if}
		</header>
	{/if}

	<svg
		class="canvas"
		width={width}
		height={height}
		viewBox="0 0 {width} {height}"
		role="img"
		aria-label={title ?? 'Proportional bubble chart'}
	>
		<!-- Leader lines drawn under bubbles so they tuck behind the stroke. -->
		<g class="leaders" data-key={revealTick}>
			{#each placements as p (p.index + '-' + resolvedVariant)}
				{#if p.labelMode === 'leader' && p.anchor}
					{@const dx = p.anchor.x - p.cx}
					{@const dy = p.anchor.y - p.cy}
					{@const len = Math.max(Math.hypot(dx, dy), 0.0001)}
					{@const ux = dx / len}
					{@const uy = dy / len}
					{@const x1 = p.cx + ux * p.r}
					{@const y1 = p.cy + uy * p.r}
					{@const x2 = p.anchor.x - ux * 4}
					{@const y2 = p.anchor.y - uy * 4}
					{@const segLen = Math.hypot(x2 - x1, y2 - y1)}
					<line
						class="leader"
						x1={x1}
						y1={y1}
						x2={x2}
						y2={y2}
						style="--seg: {segLen}; animation-delay: {bubbleDelay(p.rank) + bubbleDuration * 0.55}ms;"
					/>
					<circle class="leader-dot" cx={x1} cy={y1} r="1.4" />
				{/if}
			{/each}
		</g>

		<!-- Bubbles -->
		<g class="bubbles" data-key={revealTick}>
			{#each placements as p (p.index + '-' + resolvedVariant)}
				<g
					class="bubble"
					class:no-anim={effectiveMode === 'none'}
					style="transform-box: fill-box; transform-origin: center; animation-delay: {bubbleDelay(
						p.rank
					)}ms; animation-duration: {bubbleDuration}ms;"
				>
					<circle
						cx={p.cx}
						cy={p.cy}
						r={p.r}
						fill={p.fill}
						fill-opacity={p.opacity}
						stroke="var(--darkgrayblue, #294457)"
						stroke-opacity={p.rank === 0 ? 0.35 : 0.18}
						stroke-width="0.75"
					/>
				</g>
			{/each}
		</g>

		<!-- In-bubble labels / values -->
		<g class="in-labels" data-key={revealTick}>
			{#each placements as p (p.index + '-' + resolvedVariant)}
				{@const valueFont = Math.max(11, Math.min(p.r * 0.42, 28))}
				{@const labelFont = Math.max(10, Math.min(p.r * 0.26, 14))}
				{@const showValueInside = valueFitsInside(p.valueText, valueFont, 2 * p.r)}
				{@const showLabelInside =
					p.labelMode === 'in' && labelFitsInside(p.label, labelFont, 2 * p.r)}
				<g
					class="label-group"
					class:no-anim={effectiveMode === 'none'}
					style="animation-delay: {labelCfg.delay}ms; animation-duration: {labelCfg.duration}ms;"
				>
					{#if showValueInside}
						<text
							class="value-in"
							x={p.cx}
							y={showLabelInside ? p.cy - 2 : p.cy + valueFont * 0.35}
							text-anchor="middle"
							style="font-size: {valueFont}px;"
							fill={contrastText(p.opacity)}
						>
							{p.valueText}
						</text>
					{/if}
					{#if showLabelInside}
						<text
							class="label-in"
							x={p.cx}
							y={p.cy + valueFont * 0.55}
							text-anchor="middle"
							style="font-size: {labelFont}px;"
							fill={contrastText(p.opacity)}
							fill-opacity="0.78"
						>
							{p.label}
						</text>
					{/if}
				</g>
			{/each}
		</g>

		<!-- Outside labels (below / right / leader) -->
		<g class="out-labels" data-key={revealTick}>
			{#each placements as p (p.index + '-' + resolvedVariant)}
				{@const valueFont = Math.max(11, Math.min(p.r * 0.42, 28))}
				{@const showValueInside = valueFitsInside(p.valueText, valueFont, 2 * p.r)}
				{#if p.labelMode !== 'in' && p.anchor}
					<g
						class="label-group"
						class:no-anim={effectiveMode === 'none'}
						style="animation-delay: {labelCfg.delay}ms; animation-duration: {labelCfg.duration}ms;"
					>
						{#if p.labelMode === 'below'}
							<text class="label-out" x={p.anchor.x} y={p.anchor.y} text-anchor="middle">
								{p.label}
							</text>
							{#if !showValueInside}
								<text
									class="value-out"
									x={p.anchor.x}
									y={p.anchor.y + 13}
									text-anchor="middle"
								>
									{p.valueText}
								</text>
							{/if}
						{:else if p.labelMode === 'right'}
							<text
								class="label-out"
								x={p.anchor.x}
								y={p.anchor.y - 3}
								text-anchor="start"
							>
								{p.label}
							</text>
							<text
								class="value-out"
								x={p.anchor.x}
								y={p.anchor.y + 12}
								text-anchor="start"
							>
								{p.valueText}
							</text>
						{:else if p.labelMode === 'leader'}
							{@const anchorAt =
								p.anchor.side === 'left'
									? ('end' as const)
									: p.anchor.side === 'right'
										? ('start' as const)
										: ('middle' as const)}
							<text
								class="label-out"
								x={p.anchor.x}
								y={p.anchor.side === 'below' ? p.anchor.y + 10 : p.anchor.y - 2}
								text-anchor={anchorAt}
							>
								{p.label}
							</text>
							{#if !showValueInside}
								<text
									class="value-out"
									x={p.anchor.x}
									y={p.anchor.side === 'below' ? p.anchor.y + 24 : p.anchor.y + 11}
									text-anchor={anchorAt}
								>
									{p.valueText}
								</text>
							{/if}
						{/if}
					</g>
				{/if}
			{/each}
		</g>
	</svg>
</figure>

<style>
	.bubble-chart {
		display: inline-block;
		font-family: 'IBM Plex Sans', 'Inter', system-ui, sans-serif;
		color: var(--ink, #312f28);
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 8px;
		padding: 0 4px;
	}

	.title {
		font-family: 'IBM Plex Sans', 'Inter', system-ui, sans-serif;
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--grayblue, #446079);
		margin: 0;
	}

	.cycler {
		display: inline-flex;
		gap: 2px;
		align-items: center;
	}

	.chip {
		appearance: none;
		background: transparent;
		border: none;
		font-family: inherit;
		font-size: 0.68rem;
		font-weight: 500;
		letter-spacing: 0.04em;
		color: var(--gray, #707070);
		padding: 3px 7px;
		border-radius: 3px;
		cursor: pointer;
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}
	.chip:hover {
		color: var(--darkgrayblue, #294457);
		background: rgba(106, 153, 194, 0.08);
	}
	.chip.active {
		color: var(--darkgrayblue, #294457);
		background: rgba(106, 153, 194, 0.16);
	}
	.chip.reset {
		margin-left: 4px;
		font-style: italic;
		opacity: 0.7;
	}

	.canvas {
		display: block;
		overflow: visible;
	}

	.bubble {
		animation-name: bubble-pop;
		animation-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
		animation-fill-mode: backwards;
	}
	.bubble.no-anim {
		animation: none;
	}
	@keyframes bubble-pop {
		from {
			transform: scale(0);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	.value-in {
		font-family: 'IBM Plex Sans', 'Inter', system-ui, sans-serif;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
	}
	.label-in {
		font-family: 'IBM Plex Sans', 'Inter', system-ui, sans-serif;
		font-weight: 500;
		letter-spacing: 0.01em;
	}
	.label-out {
		font-family: 'IBM Plex Sans', 'Inter', system-ui, sans-serif;
		font-size: 12px;
		font-weight: 500;
		fill: var(--ink, #312f28);
		letter-spacing: 0.01em;
	}
	.value-out {
		font-family: 'IBM Plex Sans', 'Inter', system-ui, sans-serif;
		font-size: 11px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		fill: var(--grayblue, #446079);
		letter-spacing: 0.01em;
	}

	.label-group {
		animation-name: label-fade;
		animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
		animation-fill-mode: backwards;
	}
	.label-group.no-anim {
		animation: none;
	}
	@keyframes label-fade {
		from {
			opacity: 0;
			transform: translateY(2px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.leader {
		stroke: var(--grayblue, #446079);
		stroke-opacity: 0.45;
		stroke-width: 0.6;
		fill: none;
		stroke-dasharray: var(--seg);
		stroke-dashoffset: var(--seg);
		animation: leader-draw 380ms cubic-bezier(0.25, 0.46, 0.45, 0.94) backwards forwards;
	}
	@keyframes leader-draw {
		to {
			stroke-dashoffset: 0;
		}
	}
	.leader-dot {
		fill: var(--grayblue, #446079);
		fill-opacity: 0.5;
	}

	@media (prefers-reduced-motion: reduce) {
		.bubble,
		.label-group,
		.leader {
			animation: none !important;
			opacity: 1 !important;
			transform: none !important;
			stroke-dashoffset: 0 !important;
		}
	}
</style>
