
<!--
	CorpusGrid — persistent dot grid driven by a CorpusVizSpec.

	Designed to live OUTSIDE the keyed slide stage so that the same dots
	stay mounted across slide transitions and morph color smoothly via CSS
	`transition: background-color`. One dot = one unit (a tagged moment, a
	coded segment — whatever the corpus is counted in).

	Specs:
	  - uniform: every dot the same color (scene-setter, no signal yet)
	  - sentiment: dots split across the 5-band sentiment palette by count
	  - highlight: a subset of dot indices lit in a focus color, the rest
	    fade to a quieter base — used to pull a sub-theme out of the corpus

	The component is presentation-only. It does not pick which dot maps to
	which sentiment in the underlying data — for the sentiment mode the
	caller passes raw counts and the grid distributes colors deterministically
	by index so the layout is stable across spec changes.
-->
<script lang="ts">
	import type { CorpusVizSpec, SentimentBucket } from '$lib/story/types';

	let {
		total,
		spec,
		cellSize = 12,
		gap = 4,
		cols,
		visible = true,
		popWindowMs = 500
	}: {
		total: number;
		spec: CorpusVizSpec;
		cellSize?: number;
		gap?: number;
		cols?: number;
		visible?: boolean;
		/**
		 * The window inside which each dot picks its own pop-in / pop-out
		 * delay. Each dot's delay is deterministic per index, so the same
		 * dot lights up at the same offset every time `visible` flips —
		 * gives the sparkle effect without re-shuffling on each toggle.
		 */
		popWindowMs?: number;
	} = $props();

	// First-paint guard. The grid mounts with `visible` already true on slide
	// 1, which means without this flag the `.on` class would be applied in
	// the same paint as the initial `opacity: 0` — the browser collapses
	// both into a single state and no transition fires. We render once with
	// `.on` withheld so dots paint at opacity:0, then arm on the next frame
	// so the CSS transition has somewhere to animate from. Pop-out works
	// without this trick (it's a true state change), but the initial pop-in
	// needs it.
	let armed = $state(false);
	$effect(() => {
		const id = requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				armed = true;
			});
		});
		return () => cancelAnimationFrame(id);
	});

	const showOn = $derived(visible && armed);

	const SENTIMENT_PALETTE: Record<SentimentBucket, string> = {
		'-2': '#e11d48',
		'-1': '#fb7185',
		'0': '#cbd5e1',
		'1': '#34d399',
		'2': '#059669'
	};

	const c = $derived(Math.max(0, Math.floor(total)));
	const actualCols = $derived(cols ?? Math.max(1, Math.ceil(Math.sqrt(c))));

	// Per-dot pop delay — deterministic LCG so the same dot picks the same
	// offset every render (no SSR mismatch, no reshuffle on toggle). Values
	// are uniformly distributed across [0, popWindowMs).
	const delays = $derived.by(() => {
		const out: number[] = new Array(c);
		for (let i = 0; i < c; i++) {
			const r = ((i * 9301 + 49297) % 233280) / 233280;
			out[i] = Math.round(r * popWindowMs);
		}
		return out;
	});

	// Per-dot color, indexed by dot position. Deterministic so successive
	// specs only change *colors* on the same dots — never their position.
	const colors = $derived.by<string[]>(() => {
		if (spec.mode === 'uniform') {
			return new Array(c).fill(spec.color);
		}
		if (spec.mode === 'sentiment') {
			// Lay sentiment buckets out in reading order, strongly-negative first
			// so the diverging gradient is visually scannable. Round each bucket
			// to its share of `c` and absorb rounding error into the largest
			// bucket so totals match exactly.
			const order: SentimentBucket[] = ['-2', '-1', '0', '1', '2'];
			const totalCount = order.reduce((s, k) => s + (spec.counts[k] ?? 0), 0);
			if (totalCount <= 0) return new Array(c).fill('#cbd5e1');
			const sized = order.map((k) => ({
				k,
				n: Math.round(((spec.counts[k] ?? 0) / totalCount) * c)
			}));
			let drift = c - sized.reduce((s, x) => s + x.n, 0);
			if (drift !== 0) {
				const fattest = sized.reduce((a, b) => (a.n >= b.n ? a : b));
				fattest.n += drift;
			}
			const out: string[] = [];
			for (const { k, n } of sized) {
				const color = SENTIMENT_PALETTE[k];
				for (let i = 0; i < n; i++) out.push(color);
			}
			return out;
		}
		// highlight mode
		const out = new Array(c).fill(spec.baseColor);
		for (const i of spec.matchingIndices) {
			if (i >= 0 && i < c) out[i] = spec.highlightColor;
		}
		return out;
	});
</script>

<div class="corpus-grid-wrap">
	<div
		class="corpus-grid"
		style="grid-template-columns: repeat({actualCols}, {cellSize}px); gap: {gap}px;"
		role="img"
		aria-label="{c} units"
	>
		{#each { length: c } as _, i (i)}
			<span
				class="dot"
				class:on={showOn}
				style="width: {cellSize}px; height: {cellSize}px; background: {colors[i] ?? '#cbd5e1'}; --pop-delay: {delays[i] ?? 0}ms;"
			></span>
		{/each}
	</div>
</div>

<style>
	.corpus-grid-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.corpus-grid {
		display: grid;
		justify-content: center;
	}
	.dot {
		border-radius: 50%;
		opacity: 0;
		transform: scale(0.4);
		/* Color morphs while visible (no delay). Pop in/out are scoped to
		   opacity + transform and wear the per-dot --pop-delay. */
		transition:
			background-color 600ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,
			opacity 260ms cubic-bezier(0.19, 1, 0.22, 1) var(--pop-delay, 0ms),
			transform 260ms cubic-bezier(0.19, 1, 0.22, 1) var(--pop-delay, 0ms);
	}
	.dot.on {
		opacity: 1;
		transform: scale(1);
	}
	@media (prefers-reduced-motion: reduce) {
		.dot {
			transition: background-color 200ms linear 0ms;
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
