<script lang="ts">
	import DashboardTag from '../DashboardTag.svelte';

	const filterClauses = [
		{ label: 'Indication', value: 'Lupus nephritis', color: 'green' as const },
		{ label: 'Role', value: 'Patient', color: 'blue' as const },
		{ label: 'Stage', value: 'Decision', color: 'amber' as const },
		{ label: 'Subtheme', value: 'Trial hesitation', color: 'orange' as const },
		{ label: 'Sentiment', value: '−0.6 to 0', color: 'neutral' as const }
	];

	const themeBars = [
		{ label: 'Provider trust', pct: 78, tone: '#7DBFA7' },
		{ label: 'Travel burden', pct: 64, tone: '#D4A93A' },
		{ label: 'Side-effect fear', pct: 52, tone: '#FF8341' },
		{ label: 'Caregiver weight', pct: 41, tone: '#6a99c2' },
		{ label: 'Insurance friction', pct: 29, tone: '#6a99c2' }
	];

	const speakers = [
		{ id: 'P-014', tag: 'Curious patient' },
		{ id: 'P-022', tag: 'Curious patient' },
		{ id: 'P-031', tag: 'Curious patient' },
		{ id: 'P-047', tag: 'Curious patient' },
		{ id: 'P-052', tag: 'Curious patient' }
	];
</script>

<div class="mock">
	<div class="mock-head">
		<div>
			<span class="persona-id">Persona</span>
			<h3>Curious patient</h3>
			<p>Indication-aware, weighing a trial against current SoC.</p>
		</div>
		<div class="counter">
			<span class="counter-num">38</span>
			<span class="counter-label">Speakers matched</span>
		</div>
	</div>

	<div class="grid">
		<div class="card filter-card">
			<div class="card-head">
				<DashboardTag label="Definition" value="5 clauses" color="amber" size="sm" />
			</div>
			<div class="clauses">
				{#each filterClauses as f}
					<div class="clause">
						<DashboardTag label={f.label} value={f.value} color={f.color} size="sm" />
					</div>
				{/each}
			</div>
		</div>

		<div class="card themes-card">
			<div class="card-head">
				<DashboardTag label="Themes" value="Top 5" color="green" size="sm" />
				<span class="card-meta">% of matched fragments</span>
			</div>
			<div class="themes">
				{#each themeBars as bar}
					<div class="theme-row">
						<span class="theme-label">{bar.label}</span>
						<div class="theme-track">
							<div class="theme-bar" style="width: {bar.pct}%; background: {bar.tone}"></div>
						</div>
						<span class="theme-pct">{bar.pct}%</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="card speakers-card">
			<div class="card-head">
				<DashboardTag label="Speakers" value="38 total" color="blue" size="sm" />
				<span class="card-meta">Showing 5</span>
			</div>
			<ul class="speakers">
				{#each speakers as s}
					<li>
						<span class="dot"></span>
						<span class="sp-id">{s.id}</span>
						<span class="sp-tag">{s.tag}</span>
					</li>
				{/each}
			</ul>
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
		align-items: flex-end;
		gap: 1.4rem;
		flex-wrap: wrap;
	}

	.persona-id {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.4);
	}

	.mock-head h3 {
		font-family: var(--font-heading-alt);
		font-size: 1.7rem;
		font-weight: 500;
		letter-spacing: -0.02em;
		color: rgba(232, 233, 235, 0.96);
		margin: 0.2rem 0 0.4rem;
	}

	.mock-head p {
		font-family: var(--font-body);
		font-size: 0.92rem;
		color: rgba(232, 233, 235, 0.62);
		max-width: 32rem;
	}

	.counter {
		text-align: right;
	}

	.counter-num {
		display: block;
		font-family: var(--font-heading-alt);
		font-size: 3rem;
		line-height: 1;
		font-weight: 300;
		color: var(--brightorange, #FF8341);
	}

	.counter-label {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.46);
	}

	.grid {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.3fr) minmax(0, 0.8fr);
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

	.clauses {
		display: grid;
		gap: 0.4rem;
	}

	.clause {
		padding: 0.05rem 0;
	}

	.themes {
		display: grid;
		gap: 0.55rem;
	}

	.theme-row {
		display: grid;
		grid-template-columns: minmax(8rem, 1fr) minmax(0, 2.4fr) auto;
		gap: 0.7rem;
		align-items: center;
	}

	.theme-label {
		font-family: var(--font-body);
		font-size: 0.86rem;
		color: rgba(232, 233, 235, 0.85);
	}

	.theme-track {
		height: 5px;
		background: rgba(232, 233, 235, 0.08);
		border-radius: 2px;
		overflow: hidden;
	}

	.theme-bar {
		height: 100%;
		border-radius: 2px;
		opacity: 0.85;
	}

	.theme-pct {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: rgba(232, 233, 235, 0.68);
	}

	.speakers {
		display: grid;
		gap: 0.45rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.speakers li {
		display: grid;
		grid-template-columns: 0.5rem auto 1fr;
		gap: 0.5rem;
		align-items: center;
	}

	.dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 999px;
		background: var(--brightorange, #FF8341);
		opacity: 0.7;
	}

	.sp-id {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: rgba(232, 233, 235, 0.88);
	}

	.sp-tag {
		font-family: var(--font-body);
		font-size: 0.78rem;
		color: rgba(232, 233, 235, 0.52);
	}

	@media (max-width: 960px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
