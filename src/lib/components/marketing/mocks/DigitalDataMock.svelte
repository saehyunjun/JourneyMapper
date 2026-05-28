<script lang="ts">
	import DashboardTag from '../DashboardTag.svelte';

	function seeded(n: number) {
		const x = Math.sin(n) * 10000;
		return x - Math.floor(x);
	}

	const searchSeries = Array.from({ length: 24 }, (_, i) => {
		const base = 0.55 + Math.sin(i * 0.5) * 0.15 + seeded(i) * 0.18;
		return Math.max(0.18, Math.min(0.95, base));
	});

	const trials = [
		{ region: 'US', count: 38, pct: 100 },
		{ region: 'EU', count: 24, pct: 63 },
		{ region: 'UK', count: 11, pct: 29 },
		{ region: 'JP', count: 7, pct: 18 },
		{ region: 'AU', count: 4, pct: 10 }
	];

	const adSpend = [
		{ sponsor: 'Sponsor A', value: 84 },
		{ sponsor: 'Sponsor B', value: 52 },
		{ sponsor: 'Sponsor C', value: 38 },
		{ sponsor: 'Sponsor D', value: 22 }
	];

	const W = 100;
	const H = 100;
	const STEP = W / (searchSeries.length - 1);
	const searchPath = `M0,${H} L${searchSeries
		.map((v, i) => `${i * STEP},${H - v * H * 0.85 - 4}`)
		.join(' L')} L${W},${H} Z`;
	const searchLine = searchSeries
		.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * STEP},${H - v * H * 0.85 - 4}`)
		.join(' ');
</script>

<div class="mock">
	<div class="mock-head">
		<div class="mock-filters">
			<DashboardTag label="Indication" value="LN" color="green" size="sm" />
			<DashboardTag label="Window" value="Jan – Dec 2026" color="neutral" size="sm" />
			<DashboardTag label="Region" value="Global" color="blue" size="sm" />
		</div>
		<span class="mock-meta">5 datasets active</span>
	</div>

	<div class="grid">
		<div class="card search-card">
			<div class="card-head">
				<DashboardTag label="Search" value="Volume" color="orange" size="sm" />
				<span class="card-meta">+18% YoY</span>
			</div>
			<div class="chart">
				<svg viewBox="0 0 100 100" preserveAspectRatio="none">
					<defs>
						<linearGradient id="area-grad" x1="0" x2="0" y1="0" y2="1">
							<stop offset="0%" stop-color="#FF8341" stop-opacity="0.35" />
							<stop offset="100%" stop-color="#FF8341" stop-opacity="0" />
						</linearGradient>
					</defs>
					{#each [20, 40, 60, 80] as gy}
						<line x1="0" y1={gy} x2="100" y2={gy} stroke="rgba(232,233,235,0.05)" stroke-width="0.2" />
					{/each}
					<path d={searchPath} fill="url(#area-grad)" />
					<path d={searchLine} fill="none" stroke="#FF8341" stroke-width="0.5" />
				</svg>
				<div class="x-axis">
					<span>Jan</span><span>Apr</span><span>Jul</span><span>Oct</span><span>Dec</span>
				</div>
			</div>
		</div>

		<div class="card trials-card">
			<div class="card-head">
				<DashboardTag label="Trials" value="Active" color="green" size="sm" />
				<span class="card-meta">84 total</span>
			</div>
			<div class="trials">
				{#each trials as t}
					<div class="trial-row">
						<span class="trial-region">{t.region}</span>
						<div class="trial-track">
							<div class="trial-bar" style="width: {t.pct}%"></div>
						</div>
						<span class="trial-count">{t.count}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="card ad-card">
			<div class="card-head">
				<DashboardTag label="Ad spend" value="Q4 est" color="amber" size="sm" />
				<span class="card-meta">$ / month, normalized</span>
			</div>
			<div class="ad-bars">
				{#each adSpend as a}
					<div class="ad-col">
						<div class="ad-bar" style="height: {a.value}%"></div>
						<span class="ad-label">{a.sponsor}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.mock {
		display: grid;
		gap: 1.4rem;
	}

	.mock-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.mock-filters {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.mock-meta {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.4);
	}

	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr);
		gap: 0.8rem;
	}

	.card {
		display: grid;
		gap: 0.9rem;
		padding: 1rem;
		background: rgba(232, 233, 235, 0.03);
		border: 1px solid rgba(232, 233, 235, 0.08);
		border-radius: 6px;
	}

	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.card-meta {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.36);
	}

	.chart {
		display: grid;
		gap: 0.4rem;
	}

	.chart svg {
		width: 100%;
		aspect-ratio: 3 / 1;
		min-height: 6rem;
	}

	.x-axis {
		display: flex;
		justify-content: space-between;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.36);
	}

	.trials {
		display: grid;
		gap: 0.45rem;
	}

	.trial-row {
		display: grid;
		grid-template-columns: 1.6rem 1fr auto;
		gap: 0.6rem;
		align-items: center;
	}

	.trial-region {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.1em;
		color: rgba(232, 233, 235, 0.7);
	}

	.trial-track {
		height: 4px;
		background: rgba(232, 233, 235, 0.08);
		border-radius: 2px;
		overflow: hidden;
	}

	.trial-bar {
		height: 100%;
		background: #7DBFA7;
		opacity: 0.85;
		border-radius: 2px;
	}

	.trial-count {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: rgba(232, 233, 235, 0.78);
	}

	.ad-bars {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		align-items: end;
		height: 6.5rem;
	}

	.ad-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		height: 100%;
		justify-content: flex-end;
	}

	.ad-bar {
		width: 100%;
		background: linear-gradient(180deg, #D4A93A, rgba(212, 169, 58, 0.3));
		border-radius: 2px 2px 0 0;
		min-height: 0.4rem;
	}

	.ad-label {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.46);
	}

	@media (max-width: 900px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
