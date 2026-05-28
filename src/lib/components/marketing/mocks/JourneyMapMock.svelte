<script lang="ts">
	import DashboardTag from '../DashboardTag.svelte';

	const stages = [
		{
			name: 'Awareness',
			color: 'green' as const,
			emotion: 'Anticipation',
			sentiment: 0.42,
			steps: ['Symptom onset', 'Self-search', 'First mention']
		},
		{
			name: 'Decision',
			color: 'amber' as const,
			emotion: 'Ambivalence',
			sentiment: -0.18,
			steps: ['Eligibility', 'Site selection', 'Consent']
		},
		{
			name: 'Participation',
			color: 'orange' as const,
			emotion: 'Apprehension',
			sentiment: -0.36,
			steps: ['Onboarding', 'Visit cadence', 'Side effects']
		},
		{
			name: 'Follow-up',
			color: 'blue' as const,
			emotion: 'Relief',
			sentiment: 0.21,
			steps: ['Outcome read', 'Continuation', 'Reflection']
		}
	];
</script>

<div class="mock">
	<div class="mock-head">
		<div class="mock-filters">
			<DashboardTag label="Indication" value="LN / SLE" color="green" size="sm" />
			<DashboardTag label="Persona" value="Curious patient" color="amber" size="sm" />
			<DashboardTag label="Sources" value="Interviews + Reddit" color="neutral" size="sm" />
		</div>
		<span class="mock-meta">N = 248 fragments</span>
	</div>

	<div class="rail">
		<div class="rail-line"></div>
		{#each stages as stage, i}
			<div class="stage">
				<div class="stage-head">
					<span class="stage-num">{(i + 1).toString().padStart(2, '0')}</span>
					<DashboardTag label={stage.name} color={stage.color} size="sm" />
				</div>
				<div class="stage-card">
					<span class="emotion">{stage.emotion}</span>
					<div class="sentiment">
						<div class="sentiment-track">
							<div
								class="sentiment-bar"
								style="--pct: {Math.abs(stage.sentiment) * 100}%; --tone: {stage.sentiment >= 0 ? '#7DBFA7' : '#FF8341'}"
							></div>
						</div>
						<span class="sentiment-val">{stage.sentiment > 0 ? '+' : ''}{stage.sentiment.toFixed(2)}</span>
					</div>
					<ul class="steps">
						{#each stage.steps as step}
							<li>{step}</li>
						{/each}
					</ul>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.mock {
		display: grid;
		gap: 1.5rem;
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

	.rail {
		position: relative;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		padding-top: 1.2rem;
	}

	.rail-line {
		position: absolute;
		top: 1.85rem;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, rgba(125, 191, 167, 0.5), rgba(212, 169, 58, 0.5), rgba(255, 131, 65, 0.5), rgba(106, 153, 194, 0.5));
	}

	.stage {
		display: grid;
		gap: 0.7rem;
	}

	.stage-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.stage-num {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.14em;
		color: rgba(232, 233, 235, 0.36);
	}

	.stage-card {
		padding: 0.85rem 0.9rem;
		background: rgba(232, 233, 235, 0.035);
		border: 1px solid rgba(232, 233, 235, 0.08);
		border-radius: 6px;
		display: grid;
		gap: 0.7rem;
		min-height: 9rem;
	}

	.emotion {
		font-family: var(--font-heading-alt);
		font-size: 0.96rem;
		font-weight: 500;
		color: rgba(232, 233, 235, 0.92);
	}

	.sentiment {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem;
		align-items: center;
	}

	.sentiment-track {
		position: relative;
		height: 4px;
		background: rgba(232, 233, 235, 0.08);
		border-radius: 2px;
		overflow: hidden;
	}

	.sentiment-bar {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		width: var(--pct);
		background: var(--tone);
		border-radius: 2px;
	}

	.sentiment-val {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.06em;
		color: rgba(232, 233, 235, 0.7);
	}

	.steps {
		display: grid;
		gap: 0.25rem;
		padding-left: 0.8rem;
		margin: 0;
	}

	.steps li {
		font-family: var(--font-body);
		font-size: 0.78rem;
		line-height: 1.4;
		color: rgba(232, 233, 235, 0.55);
		list-style: square;
	}

	.steps li::marker {
		color: rgba(232, 233, 235, 0.25);
	}

	@media (max-width: 760px) {
		.rail {
			grid-template-columns: 1fr 1fr;
		}
		.rail-line {
			display: none;
		}
	}
</style>
