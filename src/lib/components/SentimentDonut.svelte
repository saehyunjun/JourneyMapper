<!--
	SentimentDonut — a small three-band donut for one finding's segment mix:
	positive / neutral / negative coded segments. Sized for a card corner; a
	self-contained SVG so it carries no chart-library dependency.
-->
<script lang="ts">
	let {
		positive = 0,
		neutral = 0,
		negative = 0,
		size = 56
	}: { positive?: number; neutral?: number; negative?: number; size?: number } = $props();

	const COLORS = { positive: '#34d399', neutral: '#e2e8f0', negative: '#fb7185' };

	const stroke = $derived(Math.max(4, Math.round(size / 7)));
	const radius = $derived((size - stroke) / 2);
	const circumference = $derived(2 * Math.PI * radius);
	const total = $derived(positive + neutral + negative);

	// One arc per non-empty band, laid head-to-tail from twelve o'clock.
	const arcs = $derived.by(() => {
		if (total === 0) return [];
		let offset = 0;
		const out: { color: string; dash: number; gap: number; offset: number }[] = [];
		for (const [key, value] of [
			['positive', positive],
			['neutral', neutral],
			['negative', negative]
		] as const) {
			if (value === 0) continue;
			const dash = (value / total) * circumference;
			out.push({ color: COLORS[key], dash, gap: circumference - dash, offset });
			offset += dash;
		}
		return out;
	});
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 {size} {size}"
	role="img"
	aria-label="{positive} positive, {neutral} neutral, {negative} negative segments"
>
	<g transform="rotate(-90 {size / 2} {size / 2})">
		{#if total === 0}
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				stroke={COLORS.neutral}
				stroke-width={stroke}
			/>
		{:else}
			{#each arcs as arc, i (i)}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={arc.color}
					stroke-width={stroke}
					stroke-dasharray="{arc.dash} {arc.gap}"
					stroke-dashoffset={-arc.offset}
				/>
			{/each}
		{/if}
	</g>
</svg>
