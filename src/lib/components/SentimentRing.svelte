<!--
	SentimentRing — a donut chart of one participant's sentiment mix, sized to
	ring an avatar. Each tagged segment contributes a slice on the −2..+2 scale;
	drop it behind a centred avatar to frame them with their sentiment.
-->
<script lang="ts" module>
	// -2..2 diverging scale, matching SentimentBar / the keyword constellation.
	const SENTIMENT_COLORS: Record<number, string> = {
		[-2]: '#e11d48',
		[-1]: '#fb7185',
		0: '#cbd5e1',
		1: '#34d399',
		2: '#059669'
	};
	const SENTIMENT_LABELS: Record<number, string> = {
		[-2]: 'Strongly negative',
		[-1]: 'Negative',
		0: 'Neutral / mixed',
		1: 'Positive',
		2: 'Strongly positive'
	};
	// Slice order — the ring reads negative → positive, clockwise from the top.
	const ORDER = [-2, -1, 0, 1, 2];
</script>

<script lang="ts">
	type Block = { sentiment: number };

	let {
		blocks,
		size = 112,
		thickness = 8,
		class: className = ''
	}: {
		/** Contributing segment annotations — one slice per entry. */
		blocks: Block[];
		/** SVG width/height in px. */
		size?: number;
		/** Ring stroke width in px. */
		thickness?: number;
		class?: string;
	} = $props();

	const total = $derived(blocks.length);

	// Slices in negative → positive order, each with its start offset (0–100).
	const slices = $derived.by(() => {
		const counts = new Map<number, number>();
		for (const b of blocks) {
			const v = Math.max(-2, Math.min(2, Math.round(b.sentiment)));
			counts.set(v, (counts.get(v) ?? 0) + 1);
		}
		let cum = 0;
		const out: { v: number; count: number; pct: number; offset: number }[] = [];
		for (const v of ORDER) {
			const count = counts.get(v) ?? 0;
			if (!count) continue;
			const pct = (count / Math.max(1, total)) * 100;
			out.push({ v, count, pct, offset: cum });
			cum += pct;
		}
		return out;
	});

	const center = $derived(size / 2);
	// Ring centreline — inset so the stroke clears the container edge.
	const radius = $derived(size / 2 - thickness / 2 - 2);
</script>

<svg class={className} width={size} height={size} viewBox="0 0 {size} {size}" aria-hidden="true">
	<!-- Track — a faint full ring behind the slices -->
	<circle cx={center} cy={center} r={radius} fill="none" stroke="#e2e8f0" stroke-width={thickness} />
	<g transform="rotate(-90 {center} {center})">
		{#each slices as s (s.v)}
			<circle
				cx={center}
				cy={center}
				r={radius}
				fill="none"
				stroke={SENTIMENT_COLORS[s.v]}
				stroke-width={thickness}
				pathLength="100"
				stroke-dasharray="{s.pct} 100"
				stroke-dashoffset={-s.offset}
			>
				<title>{SENTIMENT_LABELS[s.v]} · {s.count} segment{s.count === 1 ? '' : 's'}</title>
			</circle>
		{/each}
	</g>
</svg>
