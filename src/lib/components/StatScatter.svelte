<!--
	StatScatter — variant of StatBlock that renders the count as N circles in a
	loose, jittered scatter. Each dot represents one underlying record (e.g. one
	tagged quote); dots are colored by sentiment using the corpus's positive /
	neutral / negative split. Reuses StatBlock's reveal + count-up choreography,
	then fades the dots in afterwards.

	Placement: a single cell of the headline stat grid in
	src/routes/patientlyiq/+page.svelte.
-->
<script lang="ts">
	import { reveal, animateProgress } from '$lib/charts/reveal';

	let {
		value,
		label,
		positive,
		neutral,
		negative,
		valueClass = 'text-accent-mint',
		labelClass = 'text-muted-foreground',
		class: klass = 'bg-(--paper)'
	}: {
		value: number;
		label: string;
		positive: number;
		neutral: number;
		negative: number;
		valueClass?: string;
		labelClass?: string;
		class?: string;
	} = $props();

	const POSITIVE = '#34d399';
	const NEUTRAL = '#cbd5e1';
	const NEGATIVE = '#fb7185';

	// Deterministic pseudo-random (linear congruential), seeded by `value` so SSR
	// markup and client markup agree and the layout is stable across renders.
	function makeRng(seed: number) {
		let s = (seed * 9301 + 49297) % 233280 || 1;
		return () => {
			s = (s * 9301 + 49297) % 233280;
			return s / 233280;
		};
	}

	type Dot = { x: number; y: number; color: string; r: number; delay: number };

	const SCATTER_W = 200;
	const SCATTER_H = 88;
	const DOT_R = 2.6;

	// Jittered-grid placement: divide the box into roughly-square cells, drop one
	// dot per cell with random offset. Gives even coverage without overlaps, with
	// the organic feel of the green-bg reference gif.
	const dots = $derived.by<Dot[]>(() => {
		const total = positive + neutral + negative;
		const n = total > 0 ? total : value;
		if (n <= 0) return [];

		const aspect = SCATTER_W / SCATTER_H;
		const cols = Math.max(1, Math.ceil(Math.sqrt(n * aspect)));
		const rows = Math.max(1, Math.ceil(n / cols));
		const cellW = SCATTER_W / cols;
		const cellH = SCATTER_H / rows;

		const rng = makeRng(n);
		const margin = DOT_R + 0.5;

		// Build a shuffled color pool so the three sentiment buckets interleave
		// across the scatter rather than clumping into solid bands.
		const colors: string[] = [
			...Array(positive).fill(POSITIVE),
			...Array(neutral).fill(NEUTRAL),
			...Array(negative).fill(NEGATIVE)
		];
		while (colors.length < n) colors.push(NEUTRAL);
		for (let i = colors.length - 1; i > 0; i--) {
			const j = Math.floor(rng() * (i + 1));
			[colors[i], colors[j]] = [colors[j], colors[i]];
		}

		const out: Dot[] = [];
		for (let i = 0; i < n; i++) {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const jitterX = (rng() - 0.5) * cellW * 0.85;
			const jitterY = (rng() - 0.5) * cellH * 0.85;
			const cx = col * cellW + cellW / 2 + jitterX;
			const cy = row * cellH + cellH / 2 + jitterY;
			out.push({
				x: Math.min(SCATTER_W - margin, Math.max(margin, cx)),
				y: Math.min(SCATTER_H - margin, Math.max(margin, cy)),
				color: colors[i] ?? NEUTRAL,
				r: DOT_R,
				delay: rng()
			});
		}
		return out;
	});

	let displayed = $state(0);
	let dotProgress = $state(0);

	function start() {
		const countDur = Math.min(1400, Math.max(500, value * 3));
		animateProgress(countDur, (t) => {
			displayed = Math.round(t * value);
		});
		animateProgress(900, (t) => {
			dotProgress = t;
		});
	}
</script>

<div
	class="relative flex flex-col gap-1 overflow-hidden p-5 {klass}"
	use:reveal={{ onReveal: start, once: true }}
>
	<span class="font-heading text-3xl font-bold {valueClass}">{displayed}</span>
	<span class="text-xs uppercase tracking-wide text-accent-foreground {labelClass}">{label}</span>

	<svg
		viewBox="0 0 {SCATTER_W} {SCATTER_H}"
		preserveAspectRatio="xMidYMid meet"
		role="img"
		aria-label="{value} dots, one per record, colored by sentiment"
		class="mt-2 w-full"
		style="height: {SCATTER_H}px;"
	>
		{#each dots as d, i (i)}
			{@const local = Math.max(0, Math.min(1, (dotProgress - d.delay * 0.6) / 0.4))}
			<circle
				cx={d.x}
				cy={d.y}
				r={d.r}
				fill={d.color}
				opacity={local}
			/>
		{/each}
	</svg>
</div>
