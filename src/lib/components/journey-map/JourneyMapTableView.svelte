<!--
	Journey-map artifact render — expandable-table layout.

	Hierarchical table inspired by initiatives/projects tables: top-level
	row per stage, expandable to step rows, which expand to observation +
	research rows. Click a leaf row to open the same RightDrawer as the
	sidebar view.

	Same data, same drawer, same keyword auto-linking — different surface.
-->
<script lang="ts">
	import type { Fragment } from '$lib/content/corpora/types';
	import type {
		Observation,
		ExternalObservation,
		DecisionPanelItem,
		StageMap,
		StepMap,
		JourneyMapArtifact
	} from './types';
	import type { JourneyMap } from '$lib/content/journeys/types';
	import EmotionDyadChip from '$lib/components/EmotionDyadChip.svelte';
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import TertiaryDrawer from '$lib/components/TertiaryDrawer.svelte';
	import {
		Activity,
		AlertCircle,
		ArrowDown,
		ArrowUp,
		BookOpen,
		Briefcase,
		ChevronRight,
		ChevronsUp,
		ClipboardList,
		DollarSign,
		FlaskConical,
		Info,
		Minus,
		Pill,
		Search,
		Shield,
		Sparkles,
		Stethoscope,
		Users
	} from '@lucide/svelte';

	type Profile = { first_name?: string; last_initial?: string };

	type Props = {
		artifact: JourneyMapArtifact;
		fragmentsById: Record<string, Fragment>;
		journey: JourneyMap | null;
		profiles: Record<string, Profile>;
		showHeader?: boolean;
		showFooter?: boolean;
	};

	let {
		artifact,
		fragmentsById,
		journey,
		profiles,
		showHeader = true,
		showFooter = true
	}: Props = $props();

	const personaColor = $derived(artifact.meta.persona_color ?? '#446079');
	const indicationLabel = $derived(
		artifact.meta.journey_indication.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
	);

	// ---------------- Tabs ----------------

	type Tab = 'stages' | 'decisions' | 'research';
	let activeTab = $state<Tab>('stages');

	const decisionPanelByStageId = $derived(
		new Map(artifact.decision_panels.map((p) => [p.stage_id, p]))
	);

	const stagesWithExternal = $derived(
		artifact.stages.filter((s) => s.steps.some((st) => st.external_observations.length > 0))
	);

	// ---------------- Expansion state ----------------
	//
	// Default to "first stage expanded with its first step open" so the
	// table arrives with content visible (the reference screenshot opens
	// to a populated, multi-row state).

	const firstStage = $derived(artifact.stages[0]);
	const firstStepKey = $derived(
		firstStage && firstStage.steps[0]
			? stepKey(firstStage.stage_id, firstStage.steps[0], 0)
			: null
	);

	let expandedStages = $state<Record<string, boolean>>({});
	let expandedSteps = $state<Record<string, boolean>>({});

	$effect(() => {
		if (firstStage && !(firstStage.stage_id in expandedStages)) {
			expandedStages[firstStage.stage_id] = true;
		}
		if (firstStepKey && !(firstStepKey in expandedSteps)) {
			expandedSteps[firstStepKey] = true;
		}
	});

	function stepKey(stageId: string, step: StepMap, idx: number): string {
		return `${stageId}::${step.step_id ?? `__general_${idx}`}`;
	}

	function toggleStage(id: string) {
		expandedStages[id] = !expandedStages[id];
	}
	function toggleStep(key: string) {
		expandedSteps[key] = !expandedSteps[key];
	}

	function expandAll() {
		for (const s of artifact.stages) {
			expandedStages[s.stage_id] = true;
			s.steps.forEach((st, i) => {
				expandedSteps[stepKey(s.stage_id, st, i)] = true;
			});
		}
	}
	function collapseAll() {
		expandedStages = {};
		expandedSteps = {};
	}

	// ---------------- Drawer state ----------------

	type PrimaryDrawerEntry =
		| { kind: 'observation'; obs: Observation; stageLabel: string; stepLabel: string | null }
		| { kind: 'external'; ext: ExternalObservation; stageLabel: string; stepLabel: string | null }
		| {
				kind: 'decision_item';
				item: DecisionPanelItem;
				variant: 'driver' | 'barrier' | 'mixed';
				panelLabel: string;
		  }
		| { kind: 'stage'; stage: StageMap };

	let primaryDrawerOpen = $state(false);
	let primaryDrawer = $state<PrimaryDrawerEntry | null>(null);
	let keywordDrawerKw = $state<string | null>(null);

	function openPrimaryDrawer(entry: PrimaryDrawerEntry) {
		primaryDrawer = entry;
		primaryDrawerOpen = true;
	}
	function openKeywordDrawer(keyword: string) {
		keywordDrawerKw = keyword;
	}
	function closeKeywordDrawer() {
		keywordDrawerKw = null;
	}

	$effect(() => {
		if (!primaryDrawerOpen) {
			primaryDrawer = null;
			keywordDrawerKw = null;
		}
	});

	// ---------------- Speaker resolution ----------------

	function speakerLabel(f: Fragment): string {
		const id =
			f.source_ref.kind === 'interview'
				? f.source_ref.interview_id
				: ((f.source_ref as { author_handle_hash?: string }).author_handle_hash ?? '?');
		const p = profiles[id];
		if (p?.first_name) {
			return [p.first_name, p.last_initial ? `${p.last_initial}.` : ''].filter(Boolean).join(' ');
		}
		return id;
	}

	// ---------------- Sentiment band ----------------

	type Band = { label: string; dot: string; text: string };

	function sentimentBand(avg: number | null): Band {
		if (avg == null) return { label: 'Neutral', dot: '#A8A8A0', text: '#6E6E64' };
		if (avg >= 1.5) return { label: 'Very positive', dot: '#599077', text: '#3F6B58' };
		if (avg >= 0.5) return { label: 'Positive', dot: '#7DBFA7', text: '#3F6B58' };
		if (avg > -0.5) return { label: 'Neutral', dot: '#A8A8A0', text: '#6E6E64' };
		if (avg > -1.5) return { label: 'Negative', dot: '#CC6324', text: '#8A3F12' };
		return { label: 'Very negative', dot: '#8A3F12', text: '#5A2A0E' };
	}

	function polaritySwatch(p: Observation['polarity']): string {
		if (p === 'positive') return '#7DBFA7';
		if (p === 'negative') return '#CC6324';
		return '#6a99c2';
	}

	function polarityLabel(p: Observation['polarity']): string {
		if (p === 'positive') return 'Positive';
		if (p === 'negative') return 'Negative';
		return 'Mixed';
	}

	// ---------------- Polarity mix for a step ----------------

	function polarityMix(step: StepMap): { positive: number; mixed: number; negative: number } {
		const mix = { positive: 0, mixed: 0, negative: 0 };
		for (const o of step.observations) mix[o.polarity]++;
		return mix;
	}

	function stagePolarityMix(stage: StageMap): { positive: number; mixed: number; negative: number } {
		const mix = { positive: 0, mixed: 0, negative: 0 };
		for (const st of stage.steps) {
			for (const o of st.observations) mix[o.polarity]++;
		}
		return mix;
	}

	// ---------------- Step aggregate sentiment ----------------

	function stepAvgPolarity(step: StepMap): number {
		if (step.observations.length === 0) return 0;
		let sum = 0;
		for (const o of step.observations) {
			sum += o.polarity === 'positive' ? 1 : o.polarity === 'negative' ? -1 : 0;
		}
		return sum / step.observations.length;
	}

	function stepBand(step: StepMap): Band {
		return sentimentBand(stepAvgPolarity(step));
	}

	// ---------------- Confidence indicator ----------------
	//
	// 0–1 confidence value → 1, 2, or 3 chevrons (mirror the "Activity"
	// column in the reference).

	function confidenceChevrons(conf: number): 0 | 1 | 2 | 3 {
		if (conf >= 0.85) return 3;
		if (conf >= 0.65) return 2;
		if (conf >= 0.4) return 1;
		return 0;
	}

	function stepAvgConfidence(step: StepMap): number {
		if (step.observations.length === 0) return 0;
		let sum = 0;
		for (const o of step.observations) sum += o.confidence;
		return sum / step.observations.length;
	}

	function stageAvgConfidence(stage: StageMap): number {
		let n = 0;
		let sum = 0;
		for (const st of stage.steps) {
			for (const o of st.observations) {
				sum += o.confidence;
				n++;
			}
		}
		return n === 0 ? 0 : sum / n;
	}

	// ---------------- Icon classifier (shared with sidebar view) ----------------

	const ICON_RULES: { match: RegExp; Icon: typeof Stethoscope }[] = [
		{ match: /\b(specialist|doctor|nurse|physician|rheumatolog|nephrolog|PCP|clinic|hospital|admission)\b/i, Icon: Stethoscope },
		{ match: /\b(biopsy|scan|ultrasound|MRI|CT|x-ray|imaging|ANA|lab|panel|test|workup|creatinine|eGFR|proteinuria|albumin)\b/i, Icon: FlaskConical },
		{ match: /\b(drug|medication|Lupkynis|Saphnelo|Gazyva|mycophenolate|prednisone|steroid|rituximab|belimumab|biologic|infusion|chemo|fludarabine|cyclophosphamide)\b/i, Icon: Pill },
		{ match: /\b(fatigue|pain|flare|symptom|exercise|diet|lifestyle|sleep|moon face|weight)\b/i, Icon: Activity },
		{ match: /\b(work|job|career|employment|leave|disability|FMLA)\b/i, Icon: Briefcase },
		{ match: /\b(family|caregiver|parent|child|spouse|sibling|partner|husband|wife|daughter|son|mother|father)\b/i, Icon: Users },
		{ match: /\b(trial|study|enroll|screen|eligib|consent|protocol|CAR-T|registry)\b/i, Icon: ClipboardList },
		{ match: /\b(cost|insurance|afford|expensive|money|copay|coverage|financial|out-of-pocket)\b/i, Icon: DollarSign },
		{ match: /\b(search|google|online|internet|forum|reddit|facebook|community|info|information)\b/i, Icon: Search },
		{ match: /\b(hope|cure|remission|breakthrough|optimism|grateful|excited)\b/i, Icon: Sparkles },
		{ match: /\b(rejection|denied|disqualif|ineligibl|excluded|barrier|risk|fear|worry|anxiety|complication|toxicity)\b/i, Icon: AlertCircle }
	];

	function iconFor(text: string, polarity: Observation['polarity']): typeof Stethoscope {
		for (const rule of ICON_RULES) {
			if (rule.match.test(text)) return rule.Icon;
		}
		if (polarity === 'positive') return ArrowUp;
		if (polarity === 'negative') return ArrowDown;
		return Minus;
	}

	function stageIcon(stage: StageMap): typeof Stethoscope {
		return iconFor(stage.label + ' ' + stage.description, 'mixed');
	}

	function stepIcon(step: StepMap): typeof Stethoscope {
		const txt = (step.label ?? '') + ' ' + step.observations.map((o) => o.title).join(' ');
		return iconFor(txt, 'mixed');
	}

	// ---------------- Keyword auto-linking ----------------

	const SUPPLEMENTAL_KEYWORDS = [
		'specialist', 'biopsy', 'infusion', 'flare', 'fatigue', 'exercise',
		'dialysis', 'remission', 'eligibility', 'caregiver', 'prednisone',
		'mycophenolate', 'CAR-T', 'kidney', 'lupus', 'trial', 'consent'
	];

	const keywordList = $derived.by(() => {
		const set = new Set<string>(SUPPLEMENTAL_KEYWORDS.map((k) => k.toLowerCase()));
		if (journey) {
			for (const stage of journey.stages) {
				set.add(stage.label.toLowerCase());
				for (const step of stage.steps) set.add(step.label.toLowerCase());
			}
		}
		return [...set].sort((a, b) => b.length - a.length);
	});

	type Segment = { text: string; keyword?: string };

	function segmentWithKeywords(text: string): Segment[] {
		if (!text) return [{ text: '' }];
		const escaped = keywordList.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
		if (!escaped) return [{ text }];
		const re = new RegExp(`\\b(${escaped})\\b`, 'gi');
		const out: Segment[] = [];
		let lastIdx = 0;
		for (const m of text.matchAll(re)) {
			const idx = m.index ?? 0;
			if (idx > lastIdx) out.push({ text: text.slice(lastIdx, idx) });
			out.push({ text: m[0], keyword: m[0].toLowerCase() });
			lastIdx = idx + m[0].length;
		}
		if (lastIdx < text.length) out.push({ text: text.slice(lastIdx) });
		return out;
	}

	function fragmentsForKeyword(keyword: string): Fragment[] {
		const k = keyword.toLowerCase();
		const out: Fragment[] = [];
		for (const f of Object.values(fragmentsById)) {
			if (typeof f.text === 'string' && f.text.toLowerCase().includes(k)) {
				out.push(f);
				if (out.length >= 25) break;
			}
		}
		return out;
	}

	const decisionVariantLabel = {
		driver: 'Driver',
		barrier: 'Barrier',
		mixed: 'Knowledge gap'
	};

	const decisionVariantColor = {
		driver: '#7DBFA7',
		barrier: '#CC6324',
		mixed: '#6a99c2'
	};

	// ---------------- Counts for tab badges ----------------

	const totalObservations = $derived(
		artifact.stages.reduce(
			(n, s) => n + s.steps.reduce((m, st) => m + st.observations.length, 0),
			0
		)
	);
	const totalExternal = $derived(
		artifact.stages.reduce(
			(n, s) => n + s.steps.reduce((m, st) => m + st.external_observations.length, 0),
			0
		)
	);
	const totalDecisionItems = $derived(
		artifact.decision_panels.reduce(
			(n, p) => n + p.drivers.length + p.barriers.length + p.mixed.length,
			0
		)
	);
</script>

<svelte:head>
	<title>{artifact.meta.persona_label} — journey map (table)</title>
</svelte:head>

<div class="journey-map-table-page">
	{#if showHeader}
		<header class="page-header">
			<div class="header-eyebrow">
				<span class="persona-swatch" style="background-color: {personaColor}" aria-hidden="true"
				></span>
				<span class="eyebrow-text">Journey map · {indicationLabel}</span>
			</div>
			<h1 class="header-title">{artifact.meta.persona_label}</h1>
			<div class="header-meta">
				<span class="meta-chip">{artifact.meta.corpus_id}</span>
				<span>·</span>
				<span>{artifact.meta.fragment_count_total} fragments</span>
				<span>·</span>
				<span>{artifact.meta.stage_count} stages</span>
				<span>·</span>
				<span>{totalObservations} observations</span>
				{#if totalExternal > 0}
					<span>·</span>
					<span>{totalExternal} research pills</span>
				{/if}
			</div>
		</header>
	{/if}

	<!-- ====================== TAB BAR ====================== -->

	<div class="tab-bar">
		<div class="tabs">
			<button
				type="button"
				class="tab"
				class:tab-active={activeTab === 'stages'}
				onclick={() => (activeTab = 'stages')}
			>
				<span class="tab-label">Stages</span>
				<span class="tab-count">{artifact.stages.length}</span>
			</button>
			<button
				type="button"
				class="tab"
				class:tab-active={activeTab === 'decisions'}
				disabled={artifact.decision_panels.length === 0}
				onclick={() => (activeTab = 'decisions')}
			>
				<span class="tab-label">Decision points</span>
				<span class="tab-count">{totalDecisionItems}</span>
			</button>
			<button
				type="button"
				class="tab"
				class:tab-active={activeTab === 'research'}
				disabled={stagesWithExternal.length === 0}
				onclick={() => (activeTab = 'research')}
			>
				<span class="tab-label">Research</span>
				<span class="tab-count">{totalExternal}</span>
			</button>
		</div>
		{#if activeTab === 'stages'}
			<div class="bulk-controls">
				<button type="button" class="bulk-btn" onclick={expandAll}>Expand all</button>
				<button type="button" class="bulk-btn" onclick={collapseAll}>Collapse all</button>
			</div>
		{/if}
	</div>

	<!-- ====================== TABLE ====================== -->

	<div class="table" role="table" aria-label="Journey map stages">
		<!-- column headers -->
		<div class="row row-head" role="row">
			<div class="cell cell-name" role="columnheader">Name</div>
			<div class="cell cell-decision" role="columnheader">Decision point</div>
			<div class="cell cell-sentiment" role="columnheader">Sentiment</div>
			<div class="cell cell-frags" role="columnheader">Fragments</div>
			<div class="cell cell-mix" role="columnheader">Polarity mix</div>
			<div class="cell cell-conf" role="columnheader">Confidence</div>
		</div>

		{#if activeTab === 'stages'}
			{#each artifact.stages as stage, stageIdx (stage.stage_id)}
				{@const band = sentimentBand(stage.avg_sentiment)}
				{@const SIcon = stageIcon(stage)}
				{@const expanded = !!expandedStages[stage.stage_id]}
				{@const mix = stagePolarityMix(stage)}
				{@const conf = stageAvgConfidence(stage)}
				{@const lvl = confidenceChevrons(conf)}
				{@const decPanel = decisionPanelByStageId.get(stage.stage_id)}

				<div class="row row-stage" role="row" style="--stage-accent: {band.dot}">
					<!-- Name -->
					<div class="cell cell-name" role="cell">
						<button
							type="button"
							class="chevron-btn"
							aria-expanded={expanded}
							aria-label={expanded ? 'Collapse stage' : 'Expand stage'}
							onclick={() => toggleStage(stage.stage_id)}
						>
							<ChevronRight
								size={16}
								strokeWidth={2}
								class={expanded ? 'chev-rot' : ''}
							/>
						</button>
						<span class="row-icon row-icon-stage" style="--accent: {band.dot}">
							<SIcon size={16} strokeWidth={1.7} />
						</span>
						<button
							type="button"
							class="row-title-btn"
							onclick={() => openPrimaryDrawer({ kind: 'stage', stage })}
						>
							<span class="row-num">{String(stageIdx + 1).padStart(2, '0')}</span>
							<span class="row-title">{stage.label}</span>
						</button>
					</div>

					<!-- Decision point -->
					<div class="cell cell-decision" role="cell">
						{#if decPanel}
							<span class="chip chip-decision">{decPanel.label}</span>
						{:else}
							<span class="cell-em">—</span>
						{/if}
					</div>

					<!-- Sentiment -->
					<div class="cell cell-sentiment" role="cell">
						<span class="sentiment" style="color: {band.text}">
							<span class="sentiment-dot" style="background-color: {band.dot}"></span>
							<span>{band.label}</span>
						</span>
					</div>

					<!-- Fragments -->
					<div class="cell cell-frags" role="cell">
						<Shield size={13} strokeWidth={1.7} class="frags-icon" />
						<span class="num">{stage.fragment_count}</span>
						<span class="num-sep">/</span>
						<span class="num num-dim">
							{stage.steps.reduce((m, st) => m + st.observations.length, 0)}
						</span>
					</div>

					<!-- Polarity mix -->
					<div class="cell cell-mix" role="cell">
						{#if mix.positive > 0}
							<span class="mix-dot" style="background-color: #7DBFA7"></span>
							<span class="mix-count">{mix.positive}</span>
						{/if}
						{#if mix.mixed > 0}
							<span class="mix-dot" style="background-color: #6a99c2"></span>
							<span class="mix-count">{mix.mixed}</span>
						{/if}
						{#if mix.negative > 0}
							<span class="mix-dot" style="background-color: #CC6324"></span>
							<span class="mix-count">{mix.negative}</span>
						{/if}
						{#if mix.positive + mix.mixed + mix.negative === 0}
							<span class="cell-em">—</span>
						{/if}
					</div>

					<!-- Confidence -->
					<div class="cell cell-conf" role="cell">
						{#if lvl === 0}
							<span class="cell-em">—</span>
						{:else}
							<span class="conf-chevs" data-level={lvl}>
								{#each Array(lvl) as _, i (i)}
									<ChevronsUp size={14} strokeWidth={2} />
								{/each}
							</span>
						{/if}
					</div>
				</div>

				<!-- Description sub-row, only when expanded -->
				{#if expanded}
					<div class="row row-stage-desc" role="row">
						<div class="cell cell-name cell-desc" role="cell">
							<span class="tree-stub tree-stub-stage"></span>
							<p class="stage-desc">{stage.description}</p>
						</div>
					</div>
				{/if}

				<!-- Step rows -->
				{#if expanded}
					{#each stage.steps as step, stepIdx (step.step_id ?? `_g_${stepIdx}`)}
						{@const sKey = stepKey(stage.stage_id, step, stepIdx)}
						{@const sExpanded = !!expandedSteps[sKey]}
						{@const StIcon = stepIcon(step)}
						{@const sBand = stepBand(step)}
						{@const sMix = polarityMix(step)}
						{@const sConf = stepAvgConfidence(step)}
						{@const sLvl = confidenceChevrons(sConf)}
						{@const obsTotal = step.observations.length + step.external_observations.length}

						<div class="row row-step" role="row">
							<div class="cell cell-name" role="cell">
								<span class="tree-stub"></span>
								<button
									type="button"
									class="chevron-btn"
									aria-expanded={sExpanded}
									aria-label={sExpanded ? 'Collapse step' : 'Expand step'}
									disabled={obsTotal === 0}
									onclick={() => toggleStep(sKey)}
								>
									<ChevronRight
										size={14}
										strokeWidth={2}
										class={sExpanded ? 'chev-rot' : ''}
									/>
								</button>
								<span class="row-icon row-icon-step">
									<StIcon size={14} strokeWidth={1.7} />
								</span>
								<span class="row-title row-title-step">
									{step.label ?? 'General'}
								</span>
							</div>

							<div class="cell cell-decision" role="cell">
								<span class="cell-em">—</span>
							</div>

							<div class="cell cell-sentiment" role="cell">
								{#if step.observations.length > 0}
									<span class="sentiment sentiment-sm" style="color: {sBand.text}">
										<span class="sentiment-dot" style="background-color: {sBand.dot}"></span>
										<span>{sBand.label}</span>
									</span>
								{:else}
									<span class="cell-em">—</span>
								{/if}
							</div>

							<div class="cell cell-frags" role="cell">
								<span class="num num-sm">
									{step.observations.length + step.external_observations.length}
								</span>
								<span class="num-label">pills</span>
							</div>

							<div class="cell cell-mix" role="cell">
								{#if sMix.positive > 0}
									<span class="mix-dot" style="background-color: #7DBFA7"></span>
									<span class="mix-count">{sMix.positive}</span>
								{/if}
								{#if sMix.mixed > 0}
									<span class="mix-dot" style="background-color: #6a99c2"></span>
									<span class="mix-count">{sMix.mixed}</span>
								{/if}
								{#if sMix.negative > 0}
									<span class="mix-dot" style="background-color: #CC6324"></span>
									<span class="mix-count">{sMix.negative}</span>
								{/if}
								{#if step.external_observations.length > 0}
									<span class="mix-dot" style="background-color: #6469A6"></span>
									<span class="mix-count">{step.external_observations.length}</span>
								{/if}
								{#if obsTotal === 0}
									<span class="cell-em">—</span>
								{/if}
							</div>

							<div class="cell cell-conf" role="cell">
								{#if sLvl === 0}
									<span class="cell-em">—</span>
								{:else}
									<span class="conf-chevs" data-level={sLvl}>
										{#each Array(sLvl) as _, i (i)}
											<ChevronsUp size={12} strokeWidth={2} />
										{/each}
									</span>
								{/if}
							</div>
						</div>

						<!-- Observation rows (deepest level) -->
						{#if sExpanded}
							{#each step.observations as obs, obsIdx (obsIdx)}
								{@const OIcon = iconFor(obs.title + ' ' + obs.body, obs.polarity)}
								{@const oLvl = confidenceChevrons(obs.confidence)}
								<button
									type="button"
									class="row row-obs"
									onclick={() =>
										openPrimaryDrawer({
											kind: 'observation',
											obs,
											stageLabel: stage.label,
											stepLabel: step.label
										})}
								>
									<div class="cell cell-name">
										<span class="tree-stub tree-stub-deep"></span>
										<span
											class="row-icon row-icon-obs"
											style="--accent: {polaritySwatch(obs.polarity)}"
										>
											<OIcon size={13} strokeWidth={1.7} />
										</span>
										<span class="row-title row-title-obs">{obs.title}</span>
									</div>
									<div class="cell cell-decision">
										<span class="cell-em">—</span>
									</div>
									<div class="cell cell-sentiment">
										<span
											class="sentiment sentiment-sm"
											style="color: {sentimentBand(
												obs.polarity === 'positive'
													? 1
													: obs.polarity === 'negative'
														? -1
														: 0
											).text}"
										>
											<span
												class="sentiment-dot"
												style="background-color: {polaritySwatch(obs.polarity)}"
											></span>
											<span>{polarityLabel(obs.polarity)}</span>
										</span>
									</div>
									<div class="cell cell-frags">
										<span class="num num-sm">{obs.supporting_fragment_ids.length}</span>
										<span class="num-label">quotes</span>
									</div>
									<div class="cell cell-mix">
										<span class="cell-em">—</span>
									</div>
									<div class="cell cell-conf">
										{#if oLvl === 0}
											<span class="num num-sm">{Math.round(obs.confidence * 100)}%</span>
										{:else}
											<span class="conf-chevs" data-level={oLvl}>
												{#each Array(oLvl) as _, i (i)}
													<ChevronsUp size={12} strokeWidth={2} />
												{/each}
											</span>
											<span class="num num-sm num-dim conf-pct">
												{Math.round(obs.confidence * 100)}%
											</span>
										{/if}
									</div>
								</button>
							{/each}

							{#each step.external_observations as ext, extIdx (extIdx)}
								<button
									type="button"
									class="row row-obs row-obs-ext"
									onclick={() =>
										openPrimaryDrawer({
											kind: 'external',
											ext,
											stageLabel: stage.label,
											stepLabel: step.label
										})}
								>
									<div class="cell cell-name">
										<span class="tree-stub tree-stub-deep"></span>
										<span class="row-icon row-icon-obs" style="--accent: #6469A6">
											<BookOpen size={13} strokeWidth={1.7} />
										</span>
										<span class="row-title row-title-obs">{ext.title}</span>
									</div>
									<div class="cell cell-decision">
										<span class="chip chip-research">Research</span>
									</div>
									<div class="cell cell-sentiment">
										<span class="sentiment sentiment-sm" style="color: #3F4A85">
											<span class="sentiment-dot" style="background-color: #6469A6"></span>
											<span>External</span>
										</span>
									</div>
									<div class="cell cell-frags">
										<span class="num num-sm">
											{ext.source_dataset_ids?.length ?? 0}
										</span>
										<span class="num-label">sources</span>
									</div>
									<div class="cell cell-mix">
										<span class="cell-em">—</span>
									</div>
									<div class="cell cell-conf">
										{#if ext.confidence != null}
											{@const eLvl = confidenceChevrons(ext.confidence)}
											{#if eLvl > 0}
												<span class="conf-chevs" data-level={eLvl}>
													{#each Array(eLvl) as _, i (i)}
														<ChevronsUp size={12} strokeWidth={2} />
													{/each}
												</span>
											{/if}
											<span class="num num-sm num-dim conf-pct">
												{Math.round(ext.confidence * 100)}%
											</span>
										{:else}
											<span class="cell-em">—</span>
										{/if}
									</div>
								</button>
							{/each}

							{#if step.observations.length === 0 && step.external_observations.length === 0}
								<div class="row row-empty" role="row">
									<div class="cell cell-name">
										<span class="tree-stub tree-stub-deep"></span>
										<span class="row-empty-text">No observations synthesized</span>
									</div>
								</div>
							{/if}
						{/if}
					{/each}

					{#if stage.steps.length === 0}
						<div class="row row-empty" role="row">
							<div class="cell cell-name">
								<span class="tree-stub"></span>
								<span class="row-empty-text">No steps synthesized for this stage.</span>
							</div>
						</div>
					{/if}

					{#if stage.emotion_label || stage.stage_summary}
						<div class="row row-stage-foot" role="row">
							<div class="cell cell-name cell-foot" role="cell">
								<span class="tree-stub tree-stub-stage"></span>
								<div class="stage-foot-inner">
									{#if stage.emotion_label}
										<EmotionDyadChip id={stage.emotion_label} showConstituents />
									{/if}
									<button
										type="button"
										class="stage-details-btn"
										onclick={() => openPrimaryDrawer({ kind: 'stage', stage })}
									>
										<Info size={13} />
										<span>Open stage details</span>
									</button>
								</div>
							</div>
						</div>
					{/if}
				{/if}
			{/each}

		{:else if activeTab === 'decisions'}
			{#each artifact.decision_panels as panel (panel.stage_id)}
				<div class="row row-stage" role="row" style="--stage-accent: #6a99c2">
					<div class="cell cell-name">
						<span class="chevron-btn chevron-static">
							<Info size={14} strokeWidth={2} />
						</span>
						<span class="row-icon row-icon-stage" style="--accent: #6a99c2">
							<ClipboardList size={16} strokeWidth={1.7} />
						</span>
						<span class="row-num">D</span>
						<span class="row-title">{panel.label}</span>
					</div>
					<div class="cell cell-decision">
						<span class="chip chip-decision">Decision point</span>
					</div>
					<div class="cell cell-sentiment">
						<span class="cell-em">—</span>
					</div>
					<div class="cell cell-frags">
						<span class="num">
							{panel.drivers.length + panel.barriers.length + panel.mixed.length}
						</span>
						<span class="num-label">items</span>
					</div>
					<div class="cell cell-mix">
						{#if panel.drivers.length > 0}
							<span class="mix-dot" style="background-color: #7DBFA7"></span>
							<span class="mix-count">{panel.drivers.length}</span>
						{/if}
						{#if panel.mixed.length > 0}
							<span class="mix-dot" style="background-color: #6a99c2"></span>
							<span class="mix-count">{panel.mixed.length}</span>
						{/if}
						{#if panel.barriers.length > 0}
							<span class="mix-dot" style="background-color: #CC6324"></span>
							<span class="mix-count">{panel.barriers.length}</span>
						{/if}
					</div>
					<div class="cell cell-conf">
						<span class="cell-em">—</span>
					</div>
				</div>

				{#each [{ items: panel.drivers, variant: 'driver' as const, label: 'Drivers' }, { items: panel.mixed, variant: 'mixed' as const, label: 'Knowledge gaps' }, { items: panel.barriers, variant: 'barrier' as const, label: 'Barriers' }] as group, gi (gi)}
					{#each group.items as item, ii (ii)}
						{@const Ic = iconFor(
							item.title + ' ' + item.body,
							group.variant === 'driver'
								? 'positive'
								: group.variant === 'barrier'
									? 'negative'
									: 'mixed'
						)}
						{@const iLvl = confidenceChevrons(item.confidence)}
						<button
							type="button"
							class="row row-obs"
							onclick={() =>
								openPrimaryDrawer({
									kind: 'decision_item',
									item,
									variant: group.variant,
									panelLabel: panel.label
								})}
						>
							<div class="cell cell-name">
								<span class="tree-stub tree-stub-deep"></span>
								<span
									class="row-icon row-icon-obs"
									style="--accent: {decisionVariantColor[group.variant]}"
								>
									<Ic size={13} strokeWidth={1.7} />
								</span>
								<span class="row-title row-title-obs">{item.title}</span>
							</div>
							<div class="cell cell-decision">
								<span class="chip chip-{group.variant}">{group.label}</span>
							</div>
							<div class="cell cell-sentiment">
								<span
									class="sentiment sentiment-sm"
									style="color: {decisionVariantColor[group.variant]}"
								>
									<span
										class="sentiment-dot"
										style="background-color: {decisionVariantColor[group.variant]}"
									></span>
									<span>{decisionVariantLabel[group.variant]}</span>
								</span>
							</div>
							<div class="cell cell-frags">
								<span class="num num-sm">{item.supporting_fragment_ids.length}</span>
								<span class="num-label">quotes</span>
							</div>
							<div class="cell cell-mix">
								<span class="cell-em">—</span>
							</div>
							<div class="cell cell-conf">
								{#if iLvl > 0}
									<span class="conf-chevs" data-level={iLvl}>
										{#each Array(iLvl) as _, i (i)}
											<ChevronsUp size={12} strokeWidth={2} />
										{/each}
									</span>
								{/if}
								<span class="num num-sm num-dim conf-pct">
									{Math.round(item.confidence * 100)}%
								</span>
							</div>
						</button>
					{/each}
				{/each}
			{/each}

		{:else if activeTab === 'research'}
			{#each stagesWithExternal as stage (stage.stage_id)}
				{@const band = sentimentBand(stage.avg_sentiment)}
				{@const SIcon = stageIcon(stage)}
				<div class="row row-stage" role="row" style="--stage-accent: {band.dot}">
					<div class="cell cell-name">
						<span class="chevron-btn chevron-static">
							<ChevronRight size={16} strokeWidth={2} class="chev-rot" />
						</span>
						<span class="row-icon row-icon-stage" style="--accent: {band.dot}">
							<SIcon size={16} strokeWidth={1.7} />
						</span>
						<span class="row-title">{stage.label}</span>
					</div>
					<div class="cell cell-decision">
						<span class="cell-em">—</span>
					</div>
					<div class="cell cell-sentiment">
						<span class="cell-em">—</span>
					</div>
					<div class="cell cell-frags">
						<span class="num">
							{stage.steps.reduce((n, st) => n + st.external_observations.length, 0)}
						</span>
						<span class="num-label">pills</span>
					</div>
					<div class="cell cell-mix">
						<span class="cell-em">—</span>
					</div>
					<div class="cell cell-conf">
						<span class="cell-em">—</span>
					</div>
				</div>

				{#each stage.steps as step, stepIdx (step.step_id ?? `_r_${stepIdx}`)}
					{#each step.external_observations as ext, extIdx (extIdx)}
						<button
							type="button"
							class="row row-obs row-obs-ext"
							onclick={() =>
								openPrimaryDrawer({
									kind: 'external',
									ext,
									stageLabel: stage.label,
									stepLabel: step.label
								})}
						>
							<div class="cell cell-name">
								<span class="tree-stub tree-stub-deep"></span>
								<span class="row-icon row-icon-obs" style="--accent: #6469A6">
									<BookOpen size={13} strokeWidth={1.7} />
								</span>
								<span class="row-title row-title-obs">{ext.title}</span>
							</div>
							<div class="cell cell-decision">
								<span class="chip chip-research">{step.label ?? 'General'}</span>
							</div>
							<div class="cell cell-sentiment">
								<span class="sentiment sentiment-sm" style="color: #3F4A85">
									<span class="sentiment-dot" style="background-color: #6469A6"></span>
									<span>External</span>
								</span>
							</div>
							<div class="cell cell-frags">
								<span class="num num-sm">{ext.source_dataset_ids?.length ?? 0}</span>
								<span class="num-label">sources</span>
							</div>
							<div class="cell cell-mix">
								<span class="cell-em">—</span>
							</div>
							<div class="cell cell-conf">
								{#if ext.confidence != null}
									{@const eLvl = confidenceChevrons(ext.confidence)}
									{#if eLvl > 0}
										<span class="conf-chevs" data-level={eLvl}>
											{#each Array(eLvl) as _, i (i)}
												<ChevronsUp size={12} strokeWidth={2} />
											{/each}
										</span>
									{/if}
									<span class="num num-sm num-dim conf-pct">
										{Math.round(ext.confidence * 100)}%
									</span>
								{:else}
									<span class="cell-em">—</span>
								{/if}
							</div>
						</button>
					{/each}
				{/each}
			{/each}
		{/if}
	</div>

	{#if showFooter}
		<footer class="page-footer">
			<p>Generated {artifact.meta.generated_at} · {artifact.meta.generator} · {artifact.meta.model}</p>
			<p>
				Click a stage row to expand its steps; click a step to expand its observations. Leaf
				rows open the drawer with supporting quotes; keywords inside drawer text open related
				fragments.
			</p>
		</footer>
	{/if}
</div>

<!-- ====================== PRIMARY DRAWER ====================== -->

<RightDrawer bind:open={primaryDrawerOpen}>
	<div class="flex h-full flex-col">
		<header class="drawer-header">
			<div class="drawer-header-eyebrow">
				{#if primaryDrawer?.kind === 'observation'}
					{primaryDrawer.stageLabel}{primaryDrawer.stepLabel ? ` · ${primaryDrawer.stepLabel}` : ''}
				{:else if primaryDrawer?.kind === 'external'}
					Research · {primaryDrawer.stageLabel}{primaryDrawer.stepLabel ? ` · ${primaryDrawer.stepLabel}` : ''}
				{:else if primaryDrawer?.kind === 'decision_item'}
					{decisionVariantLabel[primaryDrawer.variant]} · {primaryDrawer.panelLabel}
				{:else if primaryDrawer?.kind === 'stage'}
					Stage details
				{/if}
			</div>
		</header>

		<div class="drawer-body">
			{#if primaryDrawer?.kind === 'observation'}
				{@const obs = primaryDrawer.obs}
				{@const swatch = polaritySwatch(obs.polarity)}
				<div class="drawer-pill-strip" style="--strip: {swatch}">
					<span class="drawer-polarity">{obs.polarity}</span>
					<span class="drawer-confidence">
						confidence {(obs.confidence * 100).toFixed(0)}%
					</span>
				</div>
				<h2 class="drawer-title">{obs.title}</h2>
				{#if obs.body}
					<p class="drawer-text">
						{#each segmentWithKeywords(obs.body) as seg, i (i)}
							{#if seg.keyword}
								<button
									type="button"
									class="kw-link"
									onclick={() => openKeywordDrawer(seg.keyword!)}
								>{seg.text}</button>
							{:else}
								{seg.text}
							{/if}
						{/each}
					</p>
				{/if}
				{#if obs.supporting_fragment_ids.length > 0}
					<div class="drawer-quote-block">
						<h3 class="drawer-section-title">Supporting quotes</h3>
						{#each obs.supporting_fragment_ids as fid (fid)}
							{@const f = fragmentsById[fid]}
							{#if f}
								<div class="drawer-quote">
									<div class="drawer-quote-speaker">{speakerLabel(f)}</div>
									<div class="drawer-quote-text">"{f.text}"</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			{:else if primaryDrawer?.kind === 'external'}
				{@const ext = primaryDrawer.ext}
				<div class="drawer-pill-strip" style="--strip: #6469A6">
					<span class="drawer-polarity">external research</span>
					{#if ext.confidence != null}
						<span class="drawer-confidence">
							confidence {(ext.confidence * 100).toFixed(0)}%
						</span>
					{/if}
				</div>
				<h2 class="drawer-title">{ext.title}</h2>
				{#if ext.body}
					<p class="drawer-text">
						{#each segmentWithKeywords(ext.body) as seg, i (i)}
							{#if seg.keyword}
								<button
									type="button"
									class="kw-link"
									onclick={() => openKeywordDrawer(seg.keyword!)}
								>{seg.text}</button>
							{:else}
								{seg.text}
							{/if}
						{/each}
					</p>
				{/if}
				{#if ext.citation}
					<div class="drawer-citation">{ext.citation}</div>
				{/if}
				{#if ext.source_dataset_ids && ext.source_dataset_ids.length > 0}
					<div class="drawer-source-list">
						<h3 class="drawer-section-title">Source datasets</h3>
						{#each ext.source_dataset_ids as ds (ds)}
							<code class="drawer-source-id">{ds}</code>
						{/each}
					</div>
				{/if}
			{:else if primaryDrawer?.kind === 'decision_item'}
				{@const item = primaryDrawer.item}
				{@const swatch = decisionVariantColor[primaryDrawer.variant]}
				<div class="drawer-pill-strip" style="--strip: {swatch}">
					<span class="drawer-polarity">{decisionVariantLabel[primaryDrawer.variant]}</span>
					<span class="drawer-confidence">
						confidence {(item.confidence * 100).toFixed(0)}%
					</span>
				</div>
				<h2 class="drawer-title">{item.title}</h2>
				{#if item.body}
					<p class="drawer-text">
						{#each segmentWithKeywords(item.body) as seg, i (i)}
							{#if seg.keyword}
								<button
									type="button"
									class="kw-link"
									onclick={() => openKeywordDrawer(seg.keyword!)}
								>{seg.text}</button>
							{:else}
								{seg.text}
							{/if}
						{/each}
					</p>
				{/if}
				{#if item.supporting_fragment_ids.length > 0}
					<div class="drawer-quote-block">
						<h3 class="drawer-section-title">Supporting quotes</h3>
						{#each item.supporting_fragment_ids as fid (fid)}
							{@const f = fragmentsById[fid]}
							{#if f}
								<div class="drawer-quote">
									<div class="drawer-quote-speaker">{speakerLabel(f)}</div>
									<div class="drawer-quote-text">"{f.text}"</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			{:else if primaryDrawer?.kind === 'stage'}
				{@const stage = primaryDrawer.stage}
				<h2 class="drawer-title">{stage.label}</h2>
				{#if stage.stage_summary}
					<p class="drawer-text">
						{#each segmentWithKeywords(stage.stage_summary) as seg, i (i)}
							{#if seg.keyword}
								<button
									type="button"
									class="kw-link"
									onclick={() => openKeywordDrawer(seg.keyword!)}
								>{seg.text}</button>
							{:else}
								{seg.text}
							{/if}
						{/each}
					</p>
				{/if}
				{#if stage.drill_down}
					<div class="drawer-section">
						<h3 class="drawer-section-title">Drill-down</h3>
						<p class="drawer-text">
							{#each segmentWithKeywords(stage.drill_down.text) as seg, i (i)}
								{#if seg.keyword}
									<button
										type="button"
										class="kw-link"
										onclick={() => openKeywordDrawer(seg.keyword!)}
									>{seg.text}</button>
								{:else}
									{seg.text}
								{/if}
							{/each}
						</p>
						{#if stage.drill_down.supporting_fragment_ids.length > 0}
							<div class="drawer-quote-block">
								<h3 class="drawer-section-title">Supporting quotes</h3>
								{#each stage.drill_down.supporting_fragment_ids as fid (fid)}
									{@const f = fragmentsById[fid]}
									{#if f}
										<div class="drawer-quote">
											<div class="drawer-quote-speaker">{speakerLabel(f)}</div>
											<div class="drawer-quote-text">"{f.text}"</div>
										</div>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</RightDrawer>

<!-- ====================== KEYWORD TERTIARY DRAWER ====================== -->

<TertiaryDrawer
	open={keywordDrawerKw !== null}
	onclose={closeKeywordDrawer}
	ariaLabel="Keyword fragments"
	eyebrow="Keyword"
	title={keywordDrawerKw ?? ''}
>
	{#if keywordDrawerKw}
		{@const related = fragmentsForKeyword(keywordDrawerKw)}
		<div class="drawer-body">
			<p class="drawer-text">
				{related.length} fragment{related.length === 1 ? '' : 's'} in this corpus mention "{keywordDrawerKw}".
			</p>
			{#if related.length > 0}
				<div class="drawer-quote-block">
					{#each related as f (f.id)}
						<div class="drawer-quote">
							<div class="drawer-quote-speaker">{speakerLabel(f)}</div>
							<div class="drawer-quote-text">"{f.text}"</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</TertiaryDrawer>

<style>
	/* =================================================================== */
	/* PAGE                                                                  */
	/* =================================================================== */

	.journey-map-table-page {
		max-width: 1480px;
		margin: 0 auto;
		padding: 2rem 1.75rem 4rem;
		color: var(--ink);
		font-family: var(--font-body);
		font-size: 0.95rem;
		line-height: 1.4;
	}

	/* ---------------- Header (matches sidebar view) ---------------- */

	.page-header {
		padding-bottom: 1.5rem;
		border-bottom: 1px solid #e7e5e2;
		margin-bottom: 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.header-eyebrow {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.persona-swatch {
		width: 12px;
		height: 12px;
		display: inline-block;
	}
	.eyebrow-text {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--grayblue);
	}
	.header-title {
		font-family: var(--font-heading);
		font-weight: 400;
		font-size: 2.5rem;
		line-height: 1.1;
		color: var(--darkgrayblue);
		margin: 0;
		text-wrap: balance;
	}
	.header-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--gray);
	}
	.meta-chip {
		background: var(--panel);
		padding: 3px 10px;
		color: var(--darkgrayblue);
		font-weight: 500;
	}

	/* =================================================================== */
	/* TAB BAR                                                               */
	/* =================================================================== */

	.tab-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid #e7e5e2;
		margin-bottom: 0.25rem;
	}
	.tabs {
		display: flex;
		gap: 0.5rem;
	}
	.tab {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: transparent;
		border: none;
		padding: 0.6rem 0.85rem 0.55rem;
		font-family: var(--font-body);
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--gray);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		transition: color 0.16s ease;
	}
	.tab:hover {
		color: var(--darkgrayblue);
	}
	.tab:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.tab-active {
		color: var(--darkgrayblue);
		border-bottom-color: var(--darkgrayblue);
	}
	.tab-count {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 500;
		background: var(--panel);
		color: var(--grayblue);
		padding: 1px 7px;
	}
	.tab-active .tab-count {
		background: var(--darkgrayblue);
		color: #fff;
	}

	.bulk-controls {
		display: flex;
		gap: 0.4rem;
	}
	.bulk-btn {
		background: transparent;
		border: 1px solid #d9dacf;
		padding: 0.35rem 0.7rem;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--grayblue);
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		transition: background-color 0.16s ease;
	}
	.bulk-btn:hover {
		background: var(--panel);
	}

	/* =================================================================== */
	/* TABLE                                                                 */
	/* =================================================================== */

	.table {
		display: flex;
		flex-direction: column;
		border: 1px solid #e7e5e2;
		border-top: none;
		background: #fff;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(360px, 1fr) 180px 160px 130px 160px 130px;
		gap: 0;
		align-items: center;
		min-height: 48px;
		padding: 0;
		border-top: 1px solid #e7e5e2;
		background: transparent;
		text-align: left;
		font-family: var(--font-body);
		font-size: 0.92rem;
		color: var(--ink);
		cursor: default;
		width: 100%;
		border-left: none;
		border-right: none;
		border-bottom: none;
	}

	.row-head {
		min-height: 38px;
		background: var(--panel);
		border-top: none;
		border-bottom: 1px solid #e7e5e2;
		position: sticky;
		top: 0;
		z-index: 2;
	}
	.row-head .cell {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--gray);
		text-transform: capitalize;
		letter-spacing: 0.08em;
	}

	.row-stage {
		background: #fafaf6;
		min-height: 56px;
	}
	.row-stage::before {
		content: '';
		position: absolute;
	}
	.row-stage:hover {
		background: #f4f4ec;
	}

	.row-stage-desc,
	.row-stage-foot {
		background: #fafaf6;
		min-height: 0;
		grid-template-columns: 1fr;
	}
	.row-stage-desc .cell-desc,
	.row-stage-foot .cell-foot {
		padding: 0.25rem 0.9rem 0.6rem 5.4rem;
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
	}
	.row-stage-foot .cell-foot {
		padding-top: 0.3rem;
		padding-bottom: 0.85rem;
	}
	.stage-foot-inner {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex-wrap: wrap;
	}
	.stage-desc {
		margin: 0;
		font-size: 0.85rem;
		color: var(--gray);
		line-height: 1.45;
		max-width: 70ch;
	}

	.row-step {
		min-height: 44px;
	}
	.row-step:hover {
		background: #fbfbf7;
	}

	.row-obs {
		min-height: 40px;
		cursor: pointer;
		display: grid;
		font: inherit;
	}
	.row-obs:hover {
		background: #f7f7ee;
	}
	.row-obs:focus-visible {
		outline: 2px solid var(--midgrayblue);
		outline-offset: -2px;
	}
	.row-obs-ext:hover {
		background: #f4f4f8;
	}

	.row-empty {
		min-height: 36px;
		background: #fbfbf7;
	}
	.row-empty-text {
		font-size: 0.85rem;
		color: var(--gray);
		font-style: normal;
	}

	/* ---------------- Cells ---------------- */

	.cell {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.85rem;
		min-width: 0;
	}
	.cell-name {
		gap: 0.55rem;
		padding-left: 0.7rem;
	}
	.cell-decision {
		justify-content: flex-start;
	}
	.cell-frags,
	.cell-conf {
		font-family: var(--font-mono);
		font-size: 0.82rem;
		color: var(--darkgrayblue);
	}

	.cell-em {
		color: var(--panel-mid);
		font-family: var(--font-mono);
	}

	/* ---------------- Chevron toggle ---------------- */

	.chevron-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		background: transparent;
		border: none;
		color: var(--grayblue);
		cursor: pointer;
		flex-shrink: 0;
		transition: background-color 0.14s ease, color 0.14s ease;
	}
	.chevron-btn:hover {
		background: var(--panel-dark);
		color: var(--darkgrayblue);
	}
	.chevron-btn:disabled {
		opacity: 0.25;
		cursor: not-allowed;
	}
	.chevron-static {
		cursor: default;
	}
	.chevron-static:hover {
		background: transparent;
	}
	:global(.chev-rot) {
		transform: rotate(90deg);
		transition: transform 0.18s ease;
	}

	/* ---------------- Row icon badge ---------------- */

	.row-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: #fff;
		background: var(--accent, var(--midgrayblue));
	}
	.row-icon-stage {
		width: 26px;
		height: 26px;
	}
	.row-icon-step {
		width: 22px;
		height: 22px;
		background: var(--panel);
		color: var(--grayblue);
		border: 1px solid #d9dacf;
	}
	.row-icon-obs {
		width: 18px;
		height: 18px;
	}

	/* ---------------- Row title ---------------- */

	.row-title-btn {
		display: inline-flex;
		align-items: baseline;
		gap: 0.45rem;
		background: transparent;
		border: none;
		padding: 0;
		font: inherit;
		color: inherit;
		text-align: left;
		cursor: pointer;
		min-width: 0;
	}
	.row-title-btn:hover .row-title {
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 3px;
	}
	.row-num {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--grayblue);
		font-weight: 500;
		flex-shrink: 0;
	}
	.row-title {
		font-family: var(--font-heading);
		font-weight: 500;
		font-size: 1.02rem;
		color: var(--darkgrayblue);
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row-title-step {
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 0.92rem;
		color: var(--darkgrayblue);
	}
	.row-title-obs {
		font-family: var(--font-body);
		font-weight: 400;
		font-size: 0.88rem;
		color: var(--ink);
		white-space: normal;
		line-height: 1.35;
	}

	/* ---------------- Tree guide (nested indentation) ---------------- */

	.tree-stub {
		flex-shrink: 0;
		width: 28px;
		align-self: stretch;
		position: relative;
		margin-left: 22px;
	}
	.tree-stub::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 1px;
		background: var(--panel-dark);
	}
	.tree-stub::after {
		content: '';
		position: absolute;
		left: 0;
		top: 50%;
		width: 22px;
		height: 1px;
		background: var(--panel-dark);
	}
	.tree-stub-deep {
		margin-left: 52px;
	}
	.tree-stub-stage {
		margin-left: 22px;
		align-self: stretch;
	}
	.tree-stub-stage::after {
		display: none;
	}

	/* ---------------- Sentiment ---------------- */

	.sentiment {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.88rem;
		font-weight: 500;
	}
	.sentiment-sm {
		font-size: 0.82rem;
		font-weight: 400;
	}
	.sentiment-dot {
		width: 9px;
		height: 9px;
		display: inline-block;
		flex-shrink: 0;
	}

	/* ---------------- Numbers ---------------- */

	.num {
		font-family: var(--font-mono);
		font-size: 0.88rem;
		font-weight: 500;
		color: var(--darkgrayblue);
	}
	.num-sm {
		font-size: 0.8rem;
	}
	.num-dim {
		color: var(--gray);
		font-weight: 400;
	}
	.num-sep {
		color: var(--panel-mid);
		margin: 0 0.1rem;
	}
	.num-label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--gray);
		letter-spacing: 0.04em;
		margin-left: 0.15rem;
	}
	:global(.frags-icon) {
		color: var(--midgrayblue);
		flex-shrink: 0;
		margin-right: 0.15rem;
	}

	/* ---------------- Polarity mix dots ---------------- */

	.mix-dot {
		width: 8px;
		height: 8px;
		display: inline-block;
		flex-shrink: 0;
	}
	.mix-count {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--darkgrayblue);
		margin-right: 0.35rem;
	}

	/* ---------------- Chips ---------------- */

	.chip {
		display: inline-block;
		padding: 2px 8px;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chip-decision {
		background: #eef2f6;
		color: var(--darkgrayblue);
		border: 1px solid #dbe3ea;
	}
	.chip-research {
		background: #ededf3;
		color: #3f4a85;
		border: 1px solid #d9d9e3;
	}
	.chip-driver {
		background: #e6f1ec;
		color: #3f6b58;
		border: 1px solid #c8e0d4;
	}
	.chip-barrier {
		background: #f6e1d3;
		color: #8a3f12;
		border: 1px solid #e8c5a8;
	}
	.chip-mixed {
		background: #e8eef5;
		color: #3a5c7c;
		border: 1px solid #cfdce8;
	}

	/* ---------------- Confidence chevrons ---------------- */

	.conf-chevs {
		display: inline-flex;
		align-items: center;
		gap: 0;
		color: #599077;
	}
	.conf-chevs[data-level='1'] {
		color: #b6c9c0;
	}
	.conf-chevs[data-level='2'] {
		color: #7DBFA7;
	}
	.conf-chevs[data-level='3'] {
		color: #599077;
	}
	.conf-pct {
		margin-left: 0.4rem;
	}

	/* ---------------- Stage details button ---------------- */

	.stage-details-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.55rem;
		background: var(--panel);
		border: 1px solid #d9dacf;
		font-family: var(--font-body);
		font-size: 0.78rem;
		color: var(--darkgrayblue);
		cursor: pointer;
		transition: background-color 0.16s ease;
	}
	.stage-details-btn:hover {
		background: #e7e5e2;
	}

	/* =================================================================== */
	/* DRAWER STYLES (shared structure with sidebar view)                    */
	/* =================================================================== */

	.drawer-header {
		padding: 1.4rem 1.6rem 0.6rem;
		border-bottom: 1px solid #e7e5e2;
	}
	.drawer-header-eyebrow {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--grayblue);
	}
	.drawer-body {
		padding: 1.2rem 1.6rem 2.5rem;
		overflow-y: auto;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		color: var(--ink);
	}
	.drawer-pill-strip {
		display: inline-flex;
		align-items: center;
		gap: 0.7rem;
		padding-left: 0.6rem;
		border-left: 4px solid var(--strip);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--grayblue);
	}
	.drawer-polarity {
		color: var(--darkgrayblue);
		font-weight: 500;
	}
	.drawer-confidence {
		color: var(--gray);
	}
	.drawer-title {
		font-family: var(--font-heading);
		font-weight: 500;
		font-size: 1.55rem;
		line-height: 1.18;
		color: var(--darkgrayblue);
		margin: 0;
		text-wrap: balance;
	}
	.drawer-text {
		font-size: 1rem;
		line-height: 1.55;
		color: var(--ink);
		margin: 0;
	}
	.drawer-section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding-top: 0.4rem;
		border-top: 1px solid #e7e5e2;
	}
	.drawer-section-title {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--grayblue);
		margin: 0;
	}
	.drawer-quote-block {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding-top: 0.6rem;
		border-top: 1px solid #e7e5e2;
	}
	.drawer-quote {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.5rem 0.7rem;
		background: var(--panel);
		border-left: 2px solid var(--midgrayblue);
	}
	.drawer-quote-speaker {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		color: var(--grayblue);
		text-transform: uppercase;
	}
	.drawer-quote-text {
		font-size: 0.95rem;
		line-height: 1.45;
		color: var(--ink);
	}
	.drawer-citation {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--gray);
	}
	.drawer-source-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.drawer-source-id {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		background: var(--panel);
		padding: 2px 6px;
		color: var(--darkgrayblue);
	}
	.kw-link {
		background: transparent;
		border: none;
		padding: 0;
		font: inherit;
		color: var(--midgrayblue);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.kw-link:hover {
		color: var(--darkgrayblue);
	}

	/* =================================================================== */
	/* FOOTER                                                                */
	/* =================================================================== */

	.page-footer {
		margin-top: 2.5rem;
		padding-top: 1.25rem;
		border-top: 1px solid #e7e5e2;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--gray);
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		line-height: 1.45;
	}

	/* =================================================================== */
	/* RESPONSIVE                                                            */
	/* =================================================================== */

	@media (max-width: 1100px) {
		.row {
			grid-template-columns: minmax(280px, 1fr) 140px 140px 110px 130px 100px;
		}
	}
	@media (max-width: 880px) {
		.row {
			grid-template-columns: minmax(220px, 1fr) 130px 110px 90px;
		}
		.cell-mix,
		.cell-conf {
			display: none;
		}
	}
</style>
