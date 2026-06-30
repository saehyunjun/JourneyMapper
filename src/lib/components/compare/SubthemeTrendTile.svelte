<!--
	SubthemeTrendTile — one cell in the /compare small-multiples grid.

	Shows a single subtheme's year-over-year volume + mean sentiment. The
	sparkline runs left-to-right across the displayed years; each point's fill
	is the sentiment color for that year (uses the diverging −2..+2 palette
	shared with SentimentRing/SentimentBar). Years where the cell falls under
	the min-N gate render with a faded dot + dashed stroke so the reader can
	see "we didn't have enough data here" without us hiding the bucket.

	Clicking the tile opens the evidence drawer at /compare. Click handling is
	owned by the parent so a single drawer state can be reused across tiles.
-->
<script lang="ts" module>
	const SENTIMENT_COLORS: Record<number, string> = {
		[-2]: '#e11d48',
		[-1]: '#fb7185',
		0: '#cbd5e1',
		1: '#34d399',
		2: '#059669'
	};

	function sentimentColor(score: number | null): string {
		if (score === null) return '#cbd5e1';
		const rounded = Math.max(-2, Math.min(2, Math.round(score)));
		return SENTIMENT_COLORS[rounded];
	}

	function fmtSentiment(s: number | null): string {
		if (s === null) return '—';
		const sign = s > 0 ? '+' : '';
		return `${sign}${s.toFixed(1)}`;
	}

	function pctDelta(from: number, to: number): string {
		if (from === 0) return to === 0 ? '0%' : '+∞';
		const d = ((to - from) / from) * 100;
		const sign = d > 0 ? '+' : '';
		return `${sign}${Math.round(d)}%`;
	}
</script>

<script lang="ts">
	import type { CompareTile } from '../../../routes/compare/+page.server';

	let {
		tile,
		minN,
		onclick
	}: {
		tile: CompareTile;
		minN: number;
		onclick: () => void;
	} = $props();

	const years = $derived(tile.per_year.map((c) => c.year));
	const counts = $derived(tile.per_year.map((c) => c.count));
	const maxCount = $derived(Math.max(1, ...counts));

	// Sparkline geometry — fixed inner box, points evenly spaced.
	const W = 220;
	const H = 56;
	const PAD_X = 10;
	const PAD_Y = 8;
	const points = $derived(
		tile.per_year.map((cell, i) => {
			const x =
				tile.per_year.length === 1
					? W / 2
					: PAD_X + ((W - 2 * PAD_X) * i) / (tile.per_year.length - 1);
			const y = PAD_Y + (H - 2 * PAD_Y) * (1 - cell.count / maxCount);
			return { ...cell, x, y, belowGate: cell.count < minN };
		})
	);
	const pathD = $derived(points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' '));

	const first = $derived(tile.per_year[0]);
	const last = $derived(tile.per_year[tile.per_year.length - 1]);
	const volDelta = $derived(first && last ? pctDelta(first.count, last.count) : '—');
	const sentDelta = $derived(
		first && last && first.sentiment_mean !== null && last.sentiment_mean !== null
			? (() => {
					const d = last.sentiment_mean! - first.sentiment_mean!;
					const sign = d > 0 ? '+' : '';
					return `${sign}${d.toFixed(1)}`;
			  })()
			: '—'
	);
</script>

<button
	type="button"
	{onclick}
	class="group flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-mint-background/40"
>
	<div class="flex items-start justify-between gap-2">
		<div class="min-w-0 flex-1">
			<div class="truncate text-sm font-medium text-zinc-900">{tile.label}</div>
			<div class="mt-0.5 text-[11px] text-zinc-500">
				{tile.total_count} fragments · vol {volDelta} · sent {sentDelta}
			</div>
		</div>
	</div>

	<svg viewBox="0 0 {W} {H}" class="block w-full" aria-hidden="true">
		<!-- baseline -->
		<line
			x1={PAD_X}
			x2={W - PAD_X}
			y1={H - PAD_Y}
			y2={H - PAD_Y}
			stroke="#e5e7eb"
			stroke-width="1"
		/>
		<!-- sparkline path -->
		<path
			d={pathD}
			fill="none"
			stroke="#a1a1aa"
			stroke-width="1.5"
			stroke-dasharray={points.some((p) => p.belowGate) ? '3 3' : ''}
		/>
		<!-- per-year dots -->
		{#each points as p (p.year)}
			<g>
				<circle
					cx={p.x}
					cy={p.y}
					r={p.belowGate ? 3 : 5}
					fill={sentimentColor(p.sentiment_mean)}
					stroke={p.belowGate ? '#cbd5e1' : '#ffffff'}
					stroke-width={p.belowGate ? 1 : 2}
					opacity={p.belowGate ? 0.55 : 1}
				>
					<title
						>{p.year} · {p.count} fragments · sentiment {fmtSentiment(p.sentiment_mean)}</title
					>
				</circle>
			</g>
		{/each}
	</svg>

	<div class="flex justify-between text-[10px] text-zinc-500">
		{#each tile.per_year as cell (cell.year)}
			<span class={cell.count < minN ? 'opacity-50' : ''}>{cell.year}</span>
		{/each}
	</div>
</button>
