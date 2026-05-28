<!--
	Content Planner — picks content strategies (and concrete format ideas)
	that fit an audience snapshot. Left pane gathers the snapshot; right pane
	ranks every strategy and shows the top format archetypes underneath.

	Strategy scoring: rankStrategies() — weighted-mean coverage across journey
	stages, burdens, and topics.
	Format scoring:   rankFormatsForStrategy() — strategy fit first, then
	stage overlap, then production cost.

	Pure client-side rerank on every chip toggle. No API hop.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { rankStrategies } from '$lib/content/suggestor/mapping';
	import { rankFormatsForStrategy } from '$lib/content/suggestor/formats';
	import type {
		BurdenCategoryId,
		ContentStrategyId,
		IndicationId,
		LnJourneyStageId
	} from '$lib/content/registries/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Indication is owned by the topbar (patientlyiq layout drives ?indication=<id>
	// → slice.active_indication). Mirror it here so the planner re-ranks when the
	// user switches indication anywhere in the app.
	type SliceLike = { active_indication?: string };
	const indication = $derived(
		((data as unknown as { slice?: SliceLike }).slice?.active_indication ??
			'lupus_nephritis') as IndicationId
	);

	let stages = $state<LnJourneyStageId[]>([]);
	let burdens = $state<BurdenCategoryId[]>([]);
	let subthemes = $state<string[]>([]);

	async function selectIndication(id: IndicationId) {
		if (id === indication) return;
		const u = new URL(page.url);
		u.searchParams.set('indication', id);
		await goto(u, { invalidateAll: true, keepFocus: false, noScroll: true });
	}

	let stageWeight = $state(1.0);
	let burdenWeight = $state(1.0);
	let subthemeWeight = $state(0.7);
	let showAdvanced = $state(false);

	const ranked = $derived(
		rankStrategies(
			{ indication, stages, burdens, subthemes },
			{ weights: { stages: stageWeight, burdens: burdenWeight, subthemes: subthemeWeight } }
		)
	);

	function formatsFor(strategyId: ContentStrategyId) {
		return rankFormatsForStrategy({ strategyId, stages });
	}

	function toggle<T extends string>(arr: T[], id: T): T[] {
		return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
	}

	function fmtPct(n: number): string {
		if (!Number.isFinite(n) || n === 0) return '—';
		return `${Math.round(n * 100)}%`;
	}

	function reset() {
		stages = [];
		burdens = [];
		subthemes = [];
	}

	type Preset = {
		label: string;
		apply: () => void;
	};

	const presets: Preset[] = [
		{
			label: 'Lupus — considering a trial',
			apply: () => {
				stages = ['stable_maintenance', 'trial_consideration'];
				burdens = ['information_knowledge_gaps', 'emotional_uncertainty', 'logistical_travel'];
				subthemes = ['clinical_trial_awareness', 'trial_motivators', 'trial_barriers'];
				void selectIndication('lupus_nephritis');
			}
		},
		{
			label: 'Lupus — newly diagnosed',
			apply: () => {
				stages = ['diagnostic_odyssey', 'induction_treatment'];
				burdens = [
					'information_knowledge_gaps',
					'emotional_uncertainty',
					'emotional_fear',
					'regimen_monitoring'
				];
				subthemes = ['condition_knowledge_gaps', 'treatment_knowledge_gaps', 'diagnostic_odyssey'];
				void selectIndication('lupus_nephritis');
			}
		},
		{
			label: 'Weight loss — cost pressure',
			apply: () => {
				stages = ['stable_maintenance', 'flare_or_refractory_cycle'];
				burdens = [
					'financial_out_of_pocket',
					'financial_insurance',
					'information_navigation'
				];
				subthemes = ['treatment_barriers', 'treatment_decision_factors'];
				void selectIndication('obesity');
			}
		}
	];

	function applyPreset(p: Preset) {
		p.apply();
	}

	const COMPLEXITY_BADGE: Record<'low' | 'medium' | 'high', string> = {
		low: 'Quick to ship',
		medium: 'Moderate effort',
		high: 'Heavy production'
	};

	function complexityClass(c: 'low' | 'medium' | 'high'): string {
		return `complexity complexity-${c}`;
	}
</script>

<svelte:head>
	<title>Content Planner · PatientlyIQ</title>
</svelte:head>

<PageHeader
	eyebrow="Build"
	title="Content Planner"
	subtitle="Describe your audience — where they are in their journey, what's weighing on them, what they're talking about — and we'll match the content strategies (and concrete formats) most likely to land. Start with a preset, or build your own picture below."
>
	{#snippet actions()}
		<div class="action-row">
			{#each presets as p (p.label)}
				<button type="button" class="preset" onclick={() => applyPreset(p)}>{p.label}</button>
			{/each}
			<button type="button" class="preset preset-clear" onclick={reset}>Start over</button>
		</div>
	{/snippet}
</PageHeader>

<div class="layout">
	<aside class="signals">
		<section class="block">
			<header class="block-head">
				<span class="block-label">Where they are in the journey</span>
				<span class="block-count">{stages.length}</span>
			</header>
			<div class="chip-row">
				{#each data.stages as s (s.id)}
					<button
						type="button"
						class="chip"
						data-active={stages.includes(s.id)}
						onclick={() => (stages = toggle(stages, s.id))}
					>
						{s.label}
					</button>
				{/each}
			</div>
		</section>

		<section class="block">
			<header class="block-head">
				<span class="block-label">What's weighing on them</span>
				<span class="block-count">{burdens.length}</span>
			</header>
			{#each data.burdenGroups as group (group.id)}
				<div class="subgroup">
					<div class="subgroup-label">{group.label}</div>
					<div class="chip-row">
						<button
							type="button"
							class="chip chip-parent"
							data-active={burdens.includes(group.id)}
							onclick={() => (burdens = toggle(burdens, group.id))}
						>
							{group.label}
						</button>
						{#each group.children as c (c.id)}
							<button
								type="button"
								class="chip"
								data-active={burdens.includes(c.id)}
								onclick={() => (burdens = toggle(burdens, c.id))}
							>
								{c.label}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</section>

		<section class="block">
			<header class="block-head">
				<span class="block-label">What they're talking about</span>
				<span class="block-count">{subthemes.length}</span>
			</header>
			{#each data.subthemeGroups as group (group.theme_id)}
				<div class="subgroup">
					<div class="subgroup-label">{group.theme_label}</div>
					<div class="chip-row">
						{#each group.subthemes as s (s.id)}
							<button
								type="button"
								class="chip"
								data-active={subthemes.includes(s.id)}
								onclick={() => (subthemes = toggle(subthemes, s.id))}
							>
								{s.label}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</section>

		<section class="block">
			<button
				type="button"
				class="advanced-toggle"
				onclick={() => (showAdvanced = !showAdvanced)}
				aria-expanded={showAdvanced}
			>
				{showAdvanced ? '−' : '+'} Tune the match
			</button>
			{#if showAdvanced}
				<div class="weights">
					<p class="advanced-hint">
						Raise or lower how much each signal counts when scoring strategies. Defaults treat
						journey and burdens equally and discount topics a little.
					</p>
					<label class="weight-row">
						<span class="weight-label">Journey</span>
						<input type="range" min="0" max="2" step="0.1" bind:value={stageWeight} />
						<span class="weight-value">{stageWeight.toFixed(1)}</span>
					</label>
					<label class="weight-row">
						<span class="weight-label">Burdens</span>
						<input type="range" min="0" max="2" step="0.1" bind:value={burdenWeight} />
						<span class="weight-value">{burdenWeight.toFixed(1)}</span>
					</label>
					<label class="weight-row">
						<span class="weight-label">Topics</span>
						<input type="range" min="0" max="2" step="0.1" bind:value={subthemeWeight} />
						<span class="weight-value">{subthemeWeight.toFixed(1)}</span>
					</label>
				</div>
			{/if}
		</section>
	</aside>

	<main class="results">
		<header class="results-head">
			<h2 class="results-title">Recommended strategies</h2>
			<p class="results-sub">
				Ranked by how well each strategy fits the picture you've built. Open a strategy to see the
				concrete content formats it's anchored by.
			</p>
		</header>

		<ol class="strategy-list">
			{#each ranked as r, idx (r.strategy_id)}
				{@const isTop = idx === 0 && r.score > 0}
				{@const formats = formatsFor(r.strategy_id).slice(0, 5)}
				<li class="strategy" data-empty={r.score === 0} data-top={isTop}>
					<div class="strategy-head">
						<span class="strategy-rank">{String(idx + 1).padStart(2, '0')}</span>
						<div class="strategy-title-block">
							<h3 class="strategy-label">{r.strategy.label}</h3>
							<p class="strategy-desc">{r.strategy.description}</p>
						</div>
						<div class="score-block">
							<div class="score">{fmtPct(r.score)}</div>
							<div class="score-caption">fit</div>
						</div>
					</div>

					<div class="components">
						{#each [{ key: 'stages', label: 'Journey', c: r.components.stages }, { key: 'burdens', label: 'Burdens', c: r.components.burdens }, { key: 'subthemes', label: 'Topics', c: r.components.subthemes }] as row (row.key)}
							<div class="component">
								<div class="component-head">
									<span class="component-label">{row.label}</span>
									<span class="component-coverage">{fmtPct(row.c.coverage)}</span>
								</div>
								<div class="component-meta">
									{#if row.c.input_count === 0}
										<span class="dim">no signal yet</span>
									{:else}
										<span><strong>{row.c.matched.length}</strong> of {row.c.input_count} matched</span>
									{/if}
								</div>
								{#if row.c.matched.length > 0}
									<div class="matched-row">
										{#each row.c.matched as m (m)}
											<code class="matched-chip">{m}</code>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>

					<div class="formats">
						<header class="formats-head">
							<span class="formats-title">Content format ideas</span>
							<span class="formats-count">{formats.length}</span>
						</header>
						{#if formats.length === 0}
							<p class="formats-empty">No formats in the registry name this strategy yet.</p>
						{:else}
							<ul class="format-list">
								{#each formats as f (f.format.id)}
									<li class="format">
										<div class="format-head">
											<span class="format-label">{f.format.label}</span>
											<span class={complexityClass(f.format.production_complexity)}>
												{COMPLEXITY_BADGE[f.format.production_complexity]}
											</span>
										</div>
										<p class="format-desc">{f.format.description}</p>
										<div class="format-meta">
											<span class="format-class">{f.format.format_class}</span>
											<span class="dot">·</span>
											<span class="format-channels">{f.format.channels.slice(0, 4).join(', ')}{f.format.channels.length > 4 ? '…' : ''}</span>
											{#if f.stage_matches > 0}
												<span class="dot">·</span>
												<span class="format-stage-hit">
													fits {f.stage_matches} of your journey {f.stage_matches === 1 ? 'stage' : 'stages'}
												</span>
											{/if}
										</div>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</li>
			{/each}
		</ol>
	</main>
</div>

<style>
	.action-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.preset {
		font-family: var(--font-body);
		font-size: 0.78rem;
		padding: 0.45rem 0.85rem;
		background: var(--paper);
		border: 1px solid color-mix(in oklab, var(--ink) 20%, transparent);
		color: var(--ink);
		cursor: pointer;
		transition: background-color 0.14s ease, border-color 0.14s ease;
	}

	.preset:hover {
		background: color-mix(in oklab, var(--ink) 5%, var(--paper));
		border-color: color-mix(in oklab, var(--ink) 40%, transparent);
	}

	.preset-clear {
		background: transparent;
		color: color-mix(in oklab, var(--ink) 65%, transparent);
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(320px, 380px) 1fr;
		gap: 0;
		max-width: 90rem;
		margin: 0 auto;
		padding: 0 2rem 4rem;
	}

	@media (max-width: 1024px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	.signals {
		border-right: 1px solid color-mix(in oklab, var(--ink) 12%, transparent);
		padding: 2rem 1.5rem 2rem 0;
	}

	@media (max-width: 1024px) {
		.signals {
			border-right: none;
			border-bottom: 1px solid color-mix(in oklab, var(--ink) 12%, transparent);
			padding: 2rem 0;
		}
	}

	.block {
		margin-bottom: 2rem;
	}

	.block-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	.block-label {
		font-family: var(--font-heading);
		font-size: 0.8rem;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--ink);
		font-weight: 500;
	}

	.block-count {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--ink);
		background: color-mix(in oklab, var(--ink) 10%, transparent);
		padding: 0.05em 0.5em;
	}

	.subgroup {
		margin-bottom: 0.85rem;
	}

	.subgroup-label {
		font-family: var(--font-body);
		font-size: 0.72rem;
		color: color-mix(in oklab, var(--ink) 55%, transparent);
		margin-bottom: 0.35rem;
	}

	.chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.chip {
		font-family: var(--font-body);
		font-size: 0.78rem;
		padding: 0.32rem 0.65rem;
		background: var(--paper);
		border: 1px solid color-mix(in oklab, var(--ink) 15%, transparent);
		color: color-mix(in oklab, var(--ink) 75%, transparent);
		cursor: pointer;
		transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
		line-height: 1.2;
	}

	.chip:hover {
		border-color: color-mix(in oklab, var(--ink) 40%, transparent);
		color: var(--ink);
	}

	.chip[data-active='true'] {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}

	.chip-parent {
		font-weight: 600;
	}

	.advanced-toggle {
		font-family: var(--font-body);
		font-size: 0.8rem;
		color: color-mix(in oklab, var(--ink) 70%, transparent);
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.advanced-toggle:hover {
		color: var(--ink);
	}

	.weights {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.advanced-hint {
		margin: 0 0 0.5rem;
		font-size: 0.78rem;
		line-height: 1.45;
		color: color-mix(in oklab, var(--ink) 60%, transparent);
	}

	.weight-row {
		display: grid;
		grid-template-columns: 5.5rem 1fr 2rem;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.78rem;
	}

	.weight-label {
		font-family: var(--font-body);
		font-size: 0.78rem;
		color: color-mix(in oklab, var(--ink) 70%, transparent);
	}

	.weight-row input[type='range'] {
		width: 100%;
		accent-color: var(--ink);
	}

	.weight-value {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		text-align: right;
		color: var(--ink);
	}

	.results {
		padding: 2rem 0 2rem 2rem;
	}

	@media (max-width: 1024px) {
		.results {
			padding: 2rem 0;
		}
	}

	.results-head {
		margin-bottom: 1.5rem;
	}

	.results-title {
		font-family: var(--font-heading);
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: 1.1rem;
		margin: 0 0 0.35rem;
		color: var(--ink);
	}

	.results-sub {
		margin: 0;
		font-size: 0.88rem;
		color: color-mix(in oklab, var(--ink) 65%, transparent);
		line-height: 1.5;
	}

	.strategy-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.strategy {
		background: var(--paper);
		border: 1px solid color-mix(in oklab, var(--ink) 12%, transparent);
		padding: 1.1rem 1.25rem;
	}

	.strategy[data-empty='true'] {
		opacity: 0.55;
	}

	.strategy[data-top='true'] {
		border-color: color-mix(in oklab, var(--ink) 45%, transparent);
		background: color-mix(in oklab, var(--ink) 3%, var(--paper));
	}

	.strategy-head {
		display: grid;
		grid-template-columns: 2.5rem 1fr auto;
		gap: 1rem;
		align-items: start;
	}

	.strategy-rank {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: color-mix(in oklab, var(--ink) 45%, transparent);
		padding-top: 0.2rem;
	}

	.strategy-title-block {
		min-width: 0;
	}

	.strategy-label {
		margin: 0 0 0.25rem;
		font-family: var(--font-heading);
		font-size: 1.05rem;
		font-weight: 500;
		color: var(--ink);
	}

	.strategy-desc {
		margin: 0;
		font-size: 0.85rem;
		line-height: 1.5;
		color: color-mix(in oklab, var(--ink) 72%, transparent);
	}

	.score-block {
		text-align: right;
	}

	.score {
		font-family: var(--font-mono);
		font-size: 1.4rem;
		font-weight: 500;
		color: var(--ink);
		line-height: 1;
	}

	.score-caption {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: color-mix(in oklab, var(--ink) 55%, transparent);
		margin-top: 0.25rem;
	}

	.components {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
		margin-top: 1rem;
		padding-top: 0.9rem;
		border-top: 1px solid color-mix(in oklab, var(--ink) 10%, transparent);
	}

	@media (max-width: 720px) {
		.components {
			grid-template-columns: 1fr;
		}
	}

	.component {
		min-width: 0;
	}

	.component-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.25rem;
	}

	.component-label {
		font-family: var(--font-heading);
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: color-mix(in oklab, var(--ink) 60%, transparent);
		font-weight: 500;
	}

	.component-coverage {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--ink);
		font-weight: 500;
	}

	.component-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		font-size: 0.74rem;
		color: color-mix(in oklab, var(--ink) 65%, transparent);
		margin-bottom: 0.4rem;
	}

	.component-meta strong {
		color: var(--ink);
		font-weight: 600;
	}

	.dim {
		font-style: normal;
		color: color-mix(in oklab, var(--ink) 45%, transparent);
	}

	.dot {
		opacity: 0.45;
	}

	.matched-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.matched-chip {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		padding: 0.1em 0.4em;
		background: color-mix(in oklab, var(--ink) 8%, transparent);
		color: var(--ink);
		word-break: break-word;
	}

	.formats {
		margin-top: 1rem;
		padding-top: 0.9rem;
		border-top: 1px solid color-mix(in oklab, var(--ink) 10%, transparent);
	}

	.formats-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 0.6rem;
	}

	.formats-title {
		font-family: var(--font-heading);
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: color-mix(in oklab, var(--ink) 75%, transparent);
		font-weight: 500;
	}

	.formats-count {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: color-mix(in oklab, var(--ink) 60%, transparent);
	}

	.formats-empty {
		margin: 0;
		font-size: 0.78rem;
		color: color-mix(in oklab, var(--ink) 55%, transparent);
	}

	.format-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.format {
		padding: 0.65rem 0.8rem;
		background: color-mix(in oklab, var(--ink) 3%, var(--paper));
		border: 1px solid color-mix(in oklab, var(--ink) 8%, transparent);
	}

	.format-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
		margin-bottom: 0.25rem;
	}

	.format-label {
		font-family: var(--font-heading);
		font-size: 0.92rem;
		font-weight: 500;
		color: var(--ink);
	}

	.complexity {
		font-family: var(--font-body);
		font-size: 0.7rem;
		padding: 0.1em 0.5em;
		white-space: nowrap;
	}

	.complexity-low {
		background: color-mix(in oklab, #14b8a6 22%, var(--paper));
		color: color-mix(in oklab, #14b8a6 65%, var(--ink));
	}

	.complexity-medium {
		background: color-mix(in oklab, #f59e0b 22%, var(--paper));
		color: color-mix(in oklab, #f59e0b 65%, var(--ink));
	}

	.complexity-high {
		background: color-mix(in oklab, #dc2626 18%, var(--paper));
		color: color-mix(in oklab, #dc2626 60%, var(--ink));
	}

	.format-desc {
		margin: 0.1rem 0 0.35rem;
		font-size: 0.82rem;
		line-height: 1.45;
		color: color-mix(in oklab, var(--ink) 70%, transparent);
	}

	.format-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		font-size: 0.72rem;
		color: color-mix(in oklab, var(--ink) 55%, transparent);
	}

	.format-class {
		text-transform: capitalize;
		color: var(--ink);
		font-weight: 500;
	}

	.format-channels {
		word-break: break-word;
	}

	.format-stage-hit {
		color: color-mix(in oklab, var(--ink) 75%, transparent);
		font-style: normal;
	}
</style>
