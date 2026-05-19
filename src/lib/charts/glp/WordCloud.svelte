<script lang="ts" module>
	/** Minimum shape WordCloud needs; callers may carry extra fields through. */
	export type WordCloudDatum = {
		/** The word to render. */
		text: string;
		/** Drives the font size — larger value, larger word. */
		value: number;
		/** Optional average sentiment (-2..2), e.g. for a `color` callback. */
		sentiment?: number;
		[key: string]: unknown;
	};
</script>

<script lang="ts">
	import cloud from 'd3-cloud';
	import { scaleSqrt } from 'd3-scale';

	let {
		words = [],
		width = 820,
		height = 625,
		minFontSize = 16,
		maxFontSize = 64,
		padding = 9,
		rotate = () => 0,
		// A concrete font stack — d3-cloud measures words on a canvas, where a
		// CSS variable is invalid and silently collapses every word to 10px,
		// breaking collision detection. Keep this resolvable by the canvas.
		fontFamily = "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
		color,
		onpick,
		seed = 1
	}: {
		/** Ranked words to lay out; `value` sizes each one. */
		words?: WordCloudDatum[];
		width?: number;
		height?: number;
		minFontSize?: number;
		maxFontSize?: number;
		/** Pixels of breathing room between words. */
		padding?: number;
		/** Degrees to rotate each word. Default: all horizontal. */
		rotate?: (d: WordCloudDatum, i: number) => number;
		fontFamily?: string;
		/** Fill per word. Defaults to `--ink`, fading lighter for smaller words. */
		color?: (d: WordCloudDatum, i: number) => string;
		/** When set, words become clickable and call this with the clicked datum. */
		onpick?: (d: WordCloudDatum) => void;
		/** Layout seed — change it to reshuffle the arrangement deterministically. */
		seed?: number;
	} = $props();

	type PlacedWord = WordCloudDatum & { x: number; y: number; rotate: number; size: number };

	let placed = $state<PlacedWord[]>([]);
	let laidOut = $state(false);

	/** Seeded PRNG (mulberry32) so a given word set lays out the same way every render. */
	function mulberry32(s: number): () => number {
		return () => {
			s |= 0;
			s = (s + 0x6d2b79f5) | 0;
			let t = Math.imul(s ^ (s >>> 15), 1 | s);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	// d3-cloud places words asynchronously; re-run whenever the inputs change
	// and cancel any layout still in flight so a stale `end` can't overwrite.
	$effect(() => {
		const items = words;
		const w = width;
		const h = height;
		const layoutSeed = seed;

		if (!items.length) {
			placed = [];
			laidOut = true;
			return;
		}

		laidOut = false;

		const values = items.map((d) => d.value);
		const lo = Math.min(...values);
		const hi = Math.max(...values);
		const sizeScale = scaleSqrt()
			.domain(lo === hi ? [0, hi || 1] : [lo, hi])
			.range([minFontSize, maxFontSize]);

		const layoutWords = items.map((d, i) => ({
			...d,
			__index: i,
			size: sizeScale(d.value)
		}));

		let cancelled = false;
		const layout = cloud<(typeof layoutWords)[number]>()
			.size([w, h])
			.words(layoutWords)
			.padding(padding)
			.rotate((d) => rotate(d, d.__index))
			.font(fontFamily)
			.fontSize((d) => d.size ?? minFontSize)
			.spiral('archimedean')
			.random(mulberry32(layoutSeed))
			.on('end', (out) => {
				if (cancelled) return;
				// d3-cloud has added x/y/rotate to each word in place.
				placed = out as unknown as PlacedWord[];
				laidOut = true;
			});
		layout.start();

		return () => {
			cancelled = true;
			layout.stop();
		};
	});

	// Default colour ramp: bigger words sit darker, smaller ones fade back.
	const valueExtent = $derived.by(() => {
		if (!placed.length) return [0, 1] as const;
		const vs = placed.map((d) => d.value);
		return [Math.min(...vs), Math.max(...vs)] as const;
	});

	function fillFor(d: PlacedWord, i: number): string {
		if (color) return color(d, i);
		const [lo, hi] = valueExtent;
		const t = hi === lo ? 1 : (d.value - lo) / (hi - lo);
		const opacity = 0.45 + 0.55 * t;
		return `color-mix(in srgb, var(--ink, #1a1a1a) ${Math.round(opacity * 100)}%, transparent)`;
	}
</script>

<div class="word-cloud" class:is-empty={!words.length}>
	{#if words.length}
		<svg
			{width}
			{height}
			viewBox="0 0 {width} {height}"
			role="img"
			aria-label="Word cloud of {words.length} words"
		>
			<g transform="translate({width / 2}, {height / 2})">
				{#each placed as d, i (d.text)}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<text
						transform="translate({d.x}, {d.y}) rotate({d.rotate})"
						text-anchor="middle"
						dominant-baseline="middle"
						font-size="{d.size}px"
						font-family={fontFamily}
						fill={fillFor(d, i)}
						class:clickable={!!onpick}
						role={onpick ? 'button' : undefined}
						tabindex={onpick ? 0 : undefined}
						aria-label={onpick ? `${d.text}, ${d.value}` : undefined}
						onclick={() => onpick?.(d)}
						onkeydown={(e) => {
							if (onpick && (e.key === 'Enter' || e.key === ' ')) {
								e.preventDefault();
								onpick(d);
							}
						}}
					>
						{d.text}
					</text>
				{/each}
			</g>
		</svg>

		{#if !laidOut}
			<div class="word-cloud__status">Building word cloud…</div>
		{/if}
	{:else}
		<p class="word-cloud__status">No words to show for this selection.</p>
	{/if}
</div>

<style>
	.word-cloud {
		position: relative;
		width: 100%;
	}

	.word-cloud.is-empty {
		display: grid;
		place-items: center;
		min-height: 8rem;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
	}

	text {
		transition: fill-opacity 150ms ease;
	}

	text.clickable {
		cursor: pointer;
	}

	text.clickable:hover {
		fill: var(--accent-mint, #4f9d8a);
	}

	text.clickable:focus-visible {
		outline: 2px solid var(--accent-mint, #4f9d8a);
		outline-offset: 2px;
	}

	.word-cloud__status {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 0.9rem;
		color: var(--muted-foreground, #6b7280);
	}

	.is-empty .word-cloud__status {
		position: static;
		background: none;
	}
</style>
