<script lang="ts">
	import RadialThemeComposition, {
		type RadialThemeCompositionDatum
	} from '$lib/charts/glp/RadialThemeComposition.svelte';
	import type { VizMotionMode } from '$lib/motion/viz';
	import PageHeader from '$lib/components/PageHeader.svelte';

	const themeData: RadialThemeCompositionDatum[] = [
		{
			id: 'disease_activity_flares',
			label: 'Disease activity & flares',
			group: 'Clinical experience',
			total: 28,
			veryNegative: 5,
			negative: 9,
			neutral: 8,
			positive: 4,
			veryPositive: 2
		},
		{
			id: 'treatment_medication',
			label: 'Treatment & medication',
			group: 'Treatment',
			total: 42,
			veryNegative: 3,
			negative: 9,
			neutral: 6,
			positive: 14,
			veryPositive: 10
		},
		{
			id: 'side_effects',
			label: 'Side effects',
			group: 'Treatment',
			total: 26,
			veryNegative: 8,
			negative: 10,
			neutral: 5,
			positive: 2,
			veryPositive: 1
		},
		{
			id: 'renal_function',
			label: 'Renal function',
			group: 'Disease monitoring',
			total: 38,
			veryNegative: 1,
			negative: 3,
			neutral: 6,
			positive: 16,
			veryPositive: 12
		},
		{
			id: 'quality_of_life',
			label: 'Quality of life',
			group: 'Daily life',
			total: 20,
			veryNegative: 2,
			negative: 10,
			neutral: 5,
			positive: 2,
			veryPositive: 1
		},
		{
			id: 'clinical_trials',
			label: 'Clinical trials',
			group: 'Research participation',
			total: 30,
			veryNegative: 4,
			negative: 10,
			neutral: 8,
			positive: 6,
			veryPositive: 2
		},
		{
			id: 'disease_monitoring',
			label: 'Disease monitoring',
			group: 'Disease monitoring',
			total: 15,
			veryNegative: 2,
			negative: 5,
			neutral: 6,
			positive: 1,
			veryPositive: 1
		},
		{
			id: 'mental_health_stress',
			label: 'Mental health & stress',
			group: 'Daily life',
			total: 24,
			veryNegative: 6,
			negative: 10,
			neutral: 6,
			positive: 1,
			veryPositive: 1
		},
		{
			id: 'social_lifestyle_impact',
			label: 'Social & lifestyle impact',
			group: 'Daily life',
			total: 18,
			veryNegative: 2,
			negative: 8,
			neutral: 6,
			positive: 1,
			veryPositive: 1
		},
		{
			id: 'healthcare_support',
			label: 'Healthcare support',
			group: 'Care system',
			total: 35,
			veryNegative: 1,
			negative: 5,
			neutral: 6,
			positive: 16,
			veryPositive: 7
		},
		{
			id: 'future_outlook',
			label: 'Future outlook',
			group: 'Future orientation',
			total: 22,
			veryNegative: 1,
			negative: 5,
			neutral: 8,
			positive: 5,
			veryPositive: 3
		}
	];

	let motionMode = $state<VizMotionMode>('dashboard');
	let sortBy = $state<'total' | 'sentiment' | 'negative' | 'positive' | 'label'>('total');
	let showBubbles = $state(true);
	let replayKey = $state(0);
	let selectedId = $state<string | null>(null);

	function handleSelect(d: RadialThemeCompositionDatum) {
		selectedId = selectedId === d.id ? null : d.id;
	}
</script>

<PageHeader
	eyebrow="Dev preview"
	title="RadialThemeComposition"
/>

<div class="preview-page">
	<div class="preview-controls">
		<label>
			Motion
			<select bind:value={motionMode}>
				<option value="none">none</option>
				<option value="dashboard">dashboard</option>
				<option value="story">story</option>
			</select>
		</label>
		<label>
			Sort by
			<select bind:value={sortBy}>
				<option value="total">total</option>
				<option value="sentiment">sentiment</option>
				<option value="negative">negative %</option>
				<option value="positive">positive %</option>
				<option value="label">label</option>
			</select>
		</label>
		<label class="check-label">
			<input type="checkbox" bind:checked={showBubbles} />
			Outer bubbles
		</label>
		<button onclick={() => replayKey++}>Replay</button>
	</div>

	<div class="preview-chart">
		<RadialThemeComposition
			data={themeData}
			title="Theme sentiment composition"
			subtitle="Tagged quote distribution across patient interview themes"
			centerLabel="Lupus Nephritis"
			centerValue="187 tagged quotes"
			{sortBy}
			showOuterBubbles={showBubbles}
			{motionMode}
			{replayKey}
			{selectedId}
			onselect={handleSelect}
		/>
	</div>

	{#if selectedId}
		{@const sel = themeData.find((d) => d.id === selectedId)}
		{#if sel}
			<div class="preview-selected">
				<strong>{sel.label}</strong> — {sel.total} segments ·
				{sel.negative} negative · {sel.neutral} neutral · {sel.positive} positive
				<button onclick={() => (selectedId = null)}>Clear</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.preview-page {
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
		font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
	}

	.preview-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		margin-bottom: 1.5rem;
		padding: 0.75rem 1rem;
		background: var(--panel, #f4f5f3);
		border-radius: 8px;
		font-size: 0.8125rem;
	}

	.preview-controls label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--gray, #707070);
	}

	.check-label {
		gap: 0.3rem;
	}

	.preview-controls select,
	.preview-controls button {
		font-size: 0.8125rem;
		padding: 0.2rem 0.5rem;
		border: 1px solid var(--panel-dark, #e7e5e2);
		border-radius: 4px;
		background: white;
		cursor: pointer;
	}

	.preview-chart {
		background: var(--card, #fff);
		border: 1px solid var(--panel-dark, #e7e5e2);
		border-radius: 10px;
		padding: 1.5rem 1rem 1rem;
	}

	.preview-selected {
		margin-top: 1rem;
		padding: 0.6rem 0.875rem;
		background: var(--panel, #f4f5f3);
		border-radius: 6px;
		font-size: 0.8125rem;
		color: var(--ink, #312f28);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.preview-selected button {
		margin-left: auto;
		font-size: 0.75rem;
		padding: 0.15rem 0.5rem;
		border: 1px solid var(--panel-mid, #d9dacf);
		border-radius: 4px;
		background: white;
		cursor: pointer;
	}
</style>
