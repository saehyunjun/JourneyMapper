
<!--
	RingSphere — single-percent composition: a thin outer ring, three
	horizontal guide lines, and a gradient sphere that rises into the ring
	from below (clipped by the ring so it appears contained). The percentage
	counts up beneath the chart, divider line above it.

	Self-contained card: SVG above, count-up value + caption below. Both
	the value and the caption are optional — pass `showValue={false}` /
	`showCaption={false}` to drop them when the surrounding slide template
	already owns those.

	Sequenced reveal:
	  1. Outer ring traces in
	  2. Guide lines extend left → right
	  3. Sphere rises from below the frame
	  4. Percentage counts up
	  5. Caption fades in

	All animations honour `prefers-reduced-motion`.
-->
<script lang="ts" module>
	// Stable, SSR-friendly id per component instance. Increments deterministically
	// in tree order on both server and client so the clipPath / gradient
	// `url(#…)` references match across hydration.
	let _counter = 0;
	function nextId(): string {
		_counter += 1;
		return `rs-${_counter}`;
	}
</script>

<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { animateProgress } from '$lib/charts/reveal';

	let {
		value,
		caption = '',
		frameColor = 'var(--ink, #312f28)',
		sphereCore = '#FFE0CC',
		sphereMid = '#FF8341',
		sphereEdge = '#E66525',
		valueColor = 'var(--ink, #312f28)',
		captionColor = '#475569',
		showValue = true,
		showCaption = true,
		replayKey = 0,
		delay = 200
	}: {
		value: number;
		caption?: string;
		frameColor?: string;
		sphereCore?: string;
		sphereMid?: string;
		sphereEdge?: string;
		valueColor?: string;
		captionColor?: string;
		showValue?: boolean;
		showCaption?: boolean;
		replayKey?: number;
		delay?: number;
	} = $props();

	// --- Geometry (viewBox units; SVG scales responsively) ----------------
	const VB_W = 360;
	const VB_H = 420;
	const cx = VB_W / 2; // 180
	const cy = 175;       // ring center
	const r = 125;        // outer ring radius
	const innerR = 55;    // sphere radius
	const settledSphereY = cy + 50;        // sphere settles slightly below centre
	const sphereStartY = VB_H + innerR + 30; // start fully below the canvas
	const ringCirc = 2 * Math.PI * r;

	// Three guide lines: through-centre, sphere-baseline, divider-above-text.
	const lines = [
		{ y: cy },                          // through ring centre
		{ y: settledSphereY + innerR },     // below sphere baseline
		{ y: VB_H - 36 }                    // divider above text
	];
	const LINE_X1 = 40;
	const LINE_X2 = VB_W - 40;
	const lineLen = LINE_X2 - LINE_X1;

	// --- Stable IDs for clipPath + gradient -------------------------------
	const id = nextId();
	const clipId = `${id}-clip`;
	const gradId = `${id}-grad`;

	// --- Animation state ---------------------------------------------------
	let ringProgress = $state(0);     // 0 = unwound, 1 = fully traced
	let lineProgress = $state(0);     // 0 = hidden, 1 = fully drawn
	let sphereY = $state(sphereStartY);
	let displayed = $state(0);
	let valueOpacity = $state(0);
	let captionOpacity = $state(0);

	function play() {
		ringProgress = 0;
		lineProgress = 0;
		sphereY = sphereStartY;
		displayed = 0;
		valueOpacity = 0;
		captionOpacity = 0;

		// 1. Ring traces in (≈800ms)
		setTimeout(() => {
			animateProgress(800, (t) => {
				ringProgress = t;
			});
		}, delay);

		// 2. Guide lines extend (≈700ms, starting partway through ring trace)
		setTimeout(() => {
			animateProgress(700, (t) => {
				lineProgress = t;
			});
		}, delay + 400);

		// 3. Sphere rises into the frame (≈1200ms ease-out)
		setTimeout(() => {
			const start = sphereStartY;
			const target = settledSphereY;
			animateProgress(1200, (t) => {
				const eased = 1 - Math.pow(1 - t, 3);
				sphereY = start + (target - start) * eased;
			});
		}, delay + 700);

		// 4. Percentage counts up (≈900ms)
		setTimeout(() => {
			valueOpacity = 1;
			animateProgress(900, (t) => {
				displayed = Math.round(value * t);
			});
		}, delay + 1400);

		// 5. Caption fades in
		setTimeout(() => {
			captionOpacity = 1;
		}, delay + 1800);
	}

	onMount(play);

	$effect(() => {
		void replayKey;
		void value;
		untrack(play);
	});
</script>

<div class="ring-sphere-card">
	<svg
		viewBox="0 0 {VB_W} {VB_H}"
		preserveAspectRatio="xMidYMid meet"
		role="img"
		aria-label="{value}%"
	>
		<defs>
			<clipPath id={clipId}>
				<circle cx={cx} cy={cy} r={r} />
			</clipPath>
			<radialGradient id={gradId} cx="50%" cy="32%" r="70%">
				<stop offset="0%" stop-color={sphereCore} />
				<stop offset="68%" stop-color={sphereMid} />
				<stop offset="100%" stop-color={sphereEdge} />
			</radialGradient>
		</defs>

		<!-- frame: outer ring (traces in) -->
		<circle
			cx={cx}
			cy={cy}
			r={r}
			fill="none"
			stroke={frameColor}
			stroke-width="1.5"
			stroke-dasharray={ringCirc}
			stroke-dashoffset={ringCirc * (1 - ringProgress)}
			transform="rotate(-90 {cx} {cy})"
		/>

		<!-- guide lines (draw in left → right) -->
		{#each lines as line, i (i)}
			<line
				x1={LINE_X1}
				x2={LINE_X1 + lineLen * lineProgress}
				y1={line.y}
				y2={line.y}
				stroke={frameColor}
				stroke-width="1"
				opacity="0.55"
			/>
		{/each}

		<!-- clipped sphere -->
		<g clip-path="url(#{clipId})">
			<circle cx={cx} cy={sphereY} r={innerR} fill="url(#{gradId})" />
		</g>
	</svg>

	{#if showValue || (showCaption && caption)}
		<div class="ring-sphere-text">
			{#if showValue}
				<div
					class="font-heading text-5xl font-bold tabular-nums leading-none md:text-6xl"
					style="color: {valueColor}; opacity: {valueOpacity}; transition: opacity 300ms ease;"
				>
					{displayed}%
				</div>
			{/if}
			{#if showCaption && caption}
				<p
					class="text-pretty text-sm leading-relaxed md:text-base"
					style="color: {captionColor}; opacity: {captionOpacity}; transition: opacity 500ms ease;"
				>
					{caption}
				</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.ring-sphere-card {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 360px;
	}
	.ring-sphere-card svg {
		width: 100%;
		height: auto;
		display: block;
	}
	.ring-sphere-text {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.25rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.ring-sphere-text > * {
			opacity: 1 !important;
			transition: none !important;
		}
	}
</style>
