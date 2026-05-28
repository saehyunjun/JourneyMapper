<!--
	Journey-map artifact render — sidebar layout.

	Per-stage row: stage header on the left (sticky within its stage section),
	steps stacked vertically on the right. Pills carry only an icon + title;
	body text, supporting quotes, drill-down content, and decision-panel
	details all live in a right-side drawer that opens on pill click.

	Inline keywords inside drawer body text are auto-linked against the
	journey taxonomy + a supplemental keyword list; clicking a keyword opens
	a tertiary drawer showing fragments in this corpus that mention it.

	No italics, no italicized serif fonts. No rounded radii. Sharp corners
	throughout. Bigger type than the previous polish pass.
-->
<script lang="ts">
	import type { Fragment } from '$lib/content/corpora/types';
	import type {
		Observation,
		ExternalObservation,
		DecisionPanelItem,
		StageMap,
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
		ClipboardList,
		DollarSign,
		FlaskConical,
		Info,
		Minus,
		Pill,
		Search,
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

	// ---------------- Drawer state ----------------
	//
	// Primary drawer uses the app-standard RightDrawer. Clicking a keyword inside
	// drawer body text opens the keyword view as a stacked TertiaryDrawer — the
	// pattern other patientlyiq pages use (lexicon stats, segment tag drawer).

	type PrimaryDrawerEntry =
		| {
				kind: 'observation';
				obs: Observation;
				stageLabel: string;
				stepLabel: string | null;
		  }
		| {
				kind: 'external';
				ext: ExternalObservation;
				stageLabel: string;
				stepLabel: string | null;
		  }
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

	// When the primary drawer closes (X / Escape / outside click), also clear
	// the stacked keyword drawer so we don't leave a tertiary panel orphaned.
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
		const p = profiles[id] as { first_name?: string; last_initial?: string } | undefined;
		if (p?.first_name) {
			return [p.first_name, p.last_initial ? `${p.last_initial}.` : ''].filter(Boolean).join(' ');
		}
		return id;
	}

	// ---------------- Sentiment bands ----------------

	type Band = { label: string; dotBg: string; text: string };

	function sentimentBand(avg: number | null): Band {
		if (avg == null) return { label: 'Neutral', dotBg: '#A8A8A0', text: '#6E6E64' };
		if (avg >= 1.5) return { label: 'Very positive', dotBg: '#599077', text: '#3F6B58' };
		if (avg >= 0.5) return { label: 'Positive', dotBg: '#7DBFA7', text: '#3F6B58' };
		if (avg > -0.5) return { label: 'Neutral', dotBg: '#A8A8A0', text: '#6E6E64' };
		if (avg > -1.5) return { label: 'Negative', dotBg: '#CC6324', text: '#8A3F12' };
		return { label: 'Very negative', dotBg: '#8A3F12', text: '#5A2A0E' };
	}

	// ---------------- Pill polarity → swatch ----------------

	function polaritySwatch(p: Observation['polarity']): string {
		if (p === 'positive') return '#7DBFA7';
		if (p === 'negative') return '#CC6324';
		return '#6a99c2';
	}

	// ---------------- Topic icon classifier ----------------

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
		// Sort longest first so multi-word matches win over single-word substrings.
		return [...set].sort((a, b) => b.length - a.length);
	});

	type Segment = { text: string; keyword?: string };

	function segmentWithKeywords(text: string): Segment[] {
		if (!text) return [{ text: '' }];
		// Build a single regex with alternation.
		const escaped = keywordList
			.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
			.join('|');
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

	// Related-fragment lookup for a keyword (case-insensitive substring on text).
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
</script>

<svelte:head>
	<title>{artifact.meta.persona_label} — journey map</title>
</svelte:head>

<div class="journey-map-page">
	{#if showHeader}
		<!-- Header -->
		<header class="page-header">
			<div class="header-eyebrow">
				<span
					class="persona-swatch"
					style="background-color: {personaColor}"
					aria-hidden="true"
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
				{#if artifact.meta.external_observations_proposer}
					<span>·</span>
					<span>{artifact.meta.external_observations_proposer.count} research pills</span>
				{/if}
			</div>
		</header>
	{/if}

	<!-- Stages -->
	<section class="stages">
		{#each artifact.stages as stage, stageIdx (stage.stage_id)}
			{@const band = sentimentBand(stage.avg_sentiment)}
			<article id="stage-{stage.stage_id}" class="stage" style="--stage-accent: {band.dotBg}">
				<!-- LEFT: sticky stage header -->
				<aside class="stage-aside">
					<div class="stage-aside-sticky">
						<div class="stage-number-row">
							<span class="stage-number">{String(stageIdx + 1).padStart(2, '0')}</span>
							<span class="stage-counter">/ {artifact.stages.length}</span>
						</div>
						<h2 class="stage-title">{stage.label}</h2>
						<div class="stage-affect">
							<span class="affect-band" style="color: {band.text}">
								<span class="affect-band-dot" style="background-color: {band.dotBg}"></span>
								<span>{band.label}</span>
							</span>
							{#if stage.emotion_label}
								<EmotionDyadChip id={stage.emotion_label} showConstituents />
							{/if}
						</div>
						<div class="stage-meta">
							<span>{stage.fragment_count} fragments</span>
							{#if stage.steps.length > 0}
								<span class="stage-meta-sep">·</span>
								<span>{stage.steps.length} step{stage.steps.length === 1 ? '' : 's'}</span>
							{/if}
						</div>
						<button
							type="button"
							class="stage-details-btn"
							onclick={() => openPrimaryDrawer({ kind: 'stage', stage })}
						>
							<Info size={14} />
							<span>Stage details</span>
						</button>
					</div>
				</aside>

				<!-- RIGHT: vertical steps -->
				<div class="stage-main">
					{#if stage.steps.length === 0}
						<p class="stage-empty">No steps synthesized for this stage.</p>
					{/if}

					{#each stage.steps as step, stepIdx (step.step_id ?? '_general_' + stepIdx)}
						{@const obsCount = step.observations.length + step.external_observations.length}
						<section class="step-block">
							<header class="step-header">
								<span class="step-num">{stageIdx + 1}.{stepIdx + 1}</span>
								<span class="step-label">{step.label ?? 'General'}</span>
								<span class="step-count">{obsCount} pill{obsCount === 1 ? '' : 's'}</span>
							</header>

							<div class="pill-list">
								{#each step.observations as obs, obsIdx (obsIdx)}
									{@const PillIcon = iconFor(obs.title + ' ' + obs.body, obs.polarity)}
									<button
										type="button"
										class="pill"
										data-polarity={obs.polarity}
										onclick={() =>
											openPrimaryDrawer({
												kind: 'observation',
												obs,
												stageLabel: stage.label,
												stepLabel: step.label
											})}
									>
										<span class="pill-swatch" style="background-color: {polaritySwatch(obs.polarity)}"></span>
										<span class="pill-icon"><PillIcon size={18} strokeWidth={1.6} /></span>
										<span class="pill-title">{obs.title}</span>
									</button>
								{/each}

								{#if step.observations.length === 0 && step.external_observations.length === 0}
									<p class="pill-empty">No observations synthesized</p>
								{/if}

								{#if step.external_observations.length > 0}
									<div class="research-divider">
										<span class="research-divider-rule"></span>
										<span class="research-divider-label">Research</span>
										<span class="research-divider-rule"></span>
									</div>
									{#each step.external_observations as ext, extIdx (extIdx)}
										<button
											type="button"
											class="pill pill-research"
											onclick={() =>
												openPrimaryDrawer({
													kind: 'external',
													ext,
													stageLabel: stage.label,
													stepLabel: step.label
												})}
										>
											<span class="pill-swatch" style="background-color: #6469A6"></span>
											<span class="pill-icon"><BookOpen size={18} strokeWidth={1.6} /></span>
											<span class="pill-title">{ext.title}</span>
										</button>
									{/each}
								{/if}
							</div>
						</section>
					{/each}
				</div>
			</article>
		{/each}
	</section>

	<!-- Decision panels -->
	{#if artifact.decision_panels.length > 0}
		<section class="decision-section">
			<header class="decision-section-header">
				<span class="decision-section-eyebrow">Decision-point panels</span>
				<h2 class="decision-section-title">Drivers, barriers, and what's still unsettled</h2>
			</header>
			{#each artifact.decision_panels as panel (panel.stage_id)}
				<article class="decision-stage">
					<aside class="stage-aside">
						<div class="stage-aside-sticky">
							<div class="decision-panel-eyebrow">Decision point</div>
							<h3 class="decision-panel-title">{panel.label}</h3>
							<div class="decision-panel-counts">
								<span>{panel.drivers.length} drivers</span>
								<span class="stage-meta-sep">·</span>
								<span>{panel.barriers.length} barriers</span>
								<span class="stage-meta-sep">·</span>
								<span>{panel.mixed.length} mixed</span>
							</div>
						</div>
					</aside>

					<div class="stage-main">
						<!-- Drivers -->
						<section class="step-block">
							<header class="step-header">
								<span class="step-num">D</span>
								<span class="step-label">Drivers to engagement</span>
								<span class="step-count">{panel.drivers.length}</span>
							</header>
							<div class="pill-list">
								{#each panel.drivers as it, i (i)}
									{@const PillIcon = iconFor(it.title + ' ' + it.body, 'positive')}
									<button
										type="button"
										class="pill"
										data-polarity="positive"
										onclick={() =>
											openPrimaryDrawer({
												kind: 'decision_item',
												item: it,
												variant: 'driver',
												panelLabel: panel.label
											})}
									>
										<span class="pill-swatch" style="background-color: {decisionVariantColor.driver}"></span>
										<span class="pill-icon"><PillIcon size={18} strokeWidth={1.6} /></span>
										<span class="pill-title">{it.title}</span>
									</button>
								{/each}
							</div>
						</section>

						<!-- Barriers -->
						<section class="step-block">
							<header class="step-header">
								<span class="step-num">B</span>
								<span class="step-label">Barriers to engagement</span>
								<span class="step-count">{panel.barriers.length}</span>
							</header>
							<div class="pill-list">
								{#each panel.barriers as it, i (i)}
									{@const PillIcon = iconFor(it.title + ' ' + it.body, 'negative')}
									<button
										type="button"
										class="pill"
										data-polarity="negative"
										onclick={() =>
											openPrimaryDrawer({
												kind: 'decision_item',
												item: it,
												variant: 'barrier',
												panelLabel: panel.label
											})}
									>
										<span class="pill-swatch" style="background-color: {decisionVariantColor.barrier}"></span>
										<span class="pill-icon"><PillIcon size={18} strokeWidth={1.6} /></span>
										<span class="pill-title">{it.title}</span>
									</button>
								{/each}
							</div>
						</section>

						<!-- Mixed -->
						<section class="step-block">
							<header class="step-header">
								<span class="step-num">M</span>
								<span class="step-label">Knowledge gaps &amp; mixed signal</span>
								<span class="step-count">{panel.mixed.length}</span>
							</header>
							<div class="pill-list">
								{#each panel.mixed as it, i (i)}
									{@const PillIcon = iconFor(it.title + ' ' + it.body, 'mixed')}
									<button
										type="button"
										class="pill"
										data-polarity="mixed"
										onclick={() =>
											openPrimaryDrawer({
												kind: 'decision_item',
												item: it,
												variant: 'mixed',
												panelLabel: panel.label
											})}
									>
										<span class="pill-swatch" style="background-color: {decisionVariantColor.mixed}"></span>
										<span class="pill-icon"><PillIcon size={18} strokeWidth={1.6} /></span>
										<span class="pill-title">{it.title}</span>
									</button>
								{/each}
							</div>
						</section>
					</div>
				</article>
			{/each}
		</section>
	{/if}

	{#if showFooter}
		<!-- Footer / provenance -->
		<footer class="page-footer">
			<p>Generated {artifact.meta.generated_at} · {artifact.meta.generator} · {artifact.meta.model}</p>
			<p>
				Click any pill or "Stage details" to open the supporting drawer. Linked keywords inside
				drawer text open related fragments. All observations are AI-proposed against the
				patient evidence and journey taxonomy; review pending.
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
					<span class="drawer-confidence">confidence {(obs.confidence * 100).toFixed(0)}%</span>
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
						<span class="drawer-confidence">confidence {(ext.confidence * 100).toFixed(0)}%</span>
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
					<span class="drawer-confidence">confidence {(item.confidence * 100).toFixed(0)}%</span>
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

	.journey-map-page {
		max-width: 1320px;
		margin: 0 auto;
		padding: 2rem 1.75rem 4rem;
		color: var(--ink);
		font-family: var(--font-body);
		font-size: 1rem;
		line-height: 1.4;
	}

	/* =================================================================== */
	/* HEADER                                                                */
	/* =================================================================== */

	.page-header {
		padding-bottom: 1.5rem;
		border-bottom: 1px solid #E7E5E2;
		margin-bottom: 2.5rem;
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
	/* STAGES — sidebar + vertical-step main column                          */
	/* =================================================================== */

	.stages {
		display: flex;
		flex-direction: column;
		gap: 3rem;
	}

	.stage,
	.decision-stage {
		display: grid;
		grid-template-columns: 280px 1fr;
		gap: 2.5rem;
		align-items: start;
		padding-bottom: 1rem;
	}
	@media (max-width: 960px) {
		.stage,
		.decision-stage {
			grid-template-columns: 1fr;
			gap: 1.25rem;
		}
	}

	.stage-aside {
		min-height: 100%;
	}
	.stage-aside-sticky {
		position: sticky;
		top: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding-right: 1rem;
		border-right: 1px solid #E7E5E2;
		padding-bottom: 0.5rem;
	}
	@media (max-width: 960px) {
		.stage-aside-sticky {
			position: static;
			border-right: none;
			border-bottom: 1px solid #E7E5E2;
			padding-right: 0;
			padding-bottom: 1rem;
		}
	}

	.stage-number-row {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
	}
	.stage-number {
		font-family: var(--font-heading);
		font-weight: 300;
		font-size: 3.2rem;
		line-height: 0.95;
		color: var(--stage-accent, var(--midgrayblue));
	}
	.stage-counter {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--gray);
		letter-spacing: 0.04em;
	}
	.stage-title {
		font-family: var(--font-heading);
		font-weight: 500;
		font-size: 1.55rem;
		line-height: 1.15;
		color: var(--darkgrayblue);
		margin: 0;
		text-wrap: balance;
	}
	.stage-affect {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.8rem;
		font-size: 0.9rem;
	}
	.affect-band {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-weight: 500;
	}
	.affect-band-dot {
		width: 9px;
		height: 9px;
		display: inline-block;
	}
	.stage-meta {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--gray);
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.stage-meta-sep { opacity: 0.5; }
	.stage-details-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 0.7rem;
		background: var(--panel);
		border: 1px solid #D9DACF;
		font-family: var(--font-body);
		font-size: 0.85rem;
		color: var(--darkgrayblue);
		cursor: pointer;
		align-self: flex-start;
		transition: background-color 0.16s ease;
	}
	.stage-details-btn:hover { background: #E7E5E2; }

	.stage-main {
		display: flex;
		flex-direction: column;
		gap: 1.6rem;
	}
	.stage-empty {
		font-size: 0.95rem;
		color: var(--gray);
		margin: 0;
	}

	/* ---------------- Step block (vertical) ---------------- */

	.step-block {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.step-header {
		display: flex;
		align-items: baseline;
		gap: 0.7rem;
		padding-bottom: 0.4rem;
		border-bottom: 1px solid #E7E5E2;
	}
	.step-num {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--grayblue);
		font-weight: 600;
		letter-spacing: 0.04em;
	}
	.step-label {
		font-family: var(--font-body);
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--darkgrayblue);
		flex: 1;
	}
	.step-count {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--gray);
	}

	/* ---------------- Pill list ---------------- */

	.pill-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.pill-empty {
		font-size: 0.9rem;
		color: var(--gray);
		margin: 0;
		padding-left: 0.5rem;
	}

	.pill {
		display: grid;
		grid-template-columns: 4px 28px 1fr;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		padding: 0.7rem 0.85rem 0.7rem 0;
		background: #FFFFFF;
		border: 1px solid #E7E5E2;
		text-align: left;
		font-family: var(--font-body);
		color: var(--ink);
		cursor: pointer;
		transition: background-color 0.14s ease, border-color 0.14s ease;
	}
	.pill:hover {
		background: var(--panel);
		border-color: #D0D9DC;
	}
	.pill-swatch {
		display: block;
		width: 4px;
		height: 100%;
		min-height: 32px;
	}
	.pill-icon {
		display: flex;
		justify-content: center;
		align-items: center;
		color: var(--grayblue);
	}
	.pill[data-polarity='positive'] .pill-icon { color: #3F6B58; }
	.pill[data-polarity='negative'] .pill-icon { color: #8A3F12; }
	.pill[data-polarity='mixed'] .pill-icon { color: #446079; }
	.pill-research .pill-icon { color: #44488E; }

	.pill-title {
		font-size: 0.98rem;
		font-weight: 500;
		line-height: 1.3;
		color: var(--ink);
		text-wrap: balance;
	}

	/* ---------------- Research divider ---------------- */

	.research-divider {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0.5rem 0;
	}
	.research-divider-rule {
		flex: 1;
		height: 1px;
		background: #C7CBEB;
	}
	.research-divider-label {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #6469A6;
		font-weight: 600;
	}

	/* =================================================================== */
	/* DECISION PANELS                                                       */
	/* =================================================================== */

	.decision-section {
		margin-top: 4rem;
		padding-top: 2.5rem;
		border-top: 1px solid #E7E5E2;
		display: flex;
		flex-direction: column;
		gap: 2.5rem;
	}
	.decision-section-header {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.decision-section-eyebrow {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--grayblue);
	}
	.decision-section-title {
		font-family: var(--font-heading);
		font-size: 2rem;
		font-weight: 400;
		color: var(--darkgrayblue);
		margin: 0;
		text-wrap: balance;
	}

	.decision-panel-eyebrow {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--grayblue);
	}
	.decision-panel-title {
		font-family: var(--font-heading);
		font-weight: 500;
		font-size: 1.55rem;
		line-height: 1.15;
		color: var(--darkgrayblue);
		margin: 0;
	}
	.decision-panel-counts {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--gray);
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	/* =================================================================== */
	/* DRAWER BODY                                                           */
	/* Chrome (panel, backdrop, slide-in, close button) lives in             */
	/* RightDrawer / TertiaryDrawer; only the journey-map content styling    */
	/* lives here.                                                            */
	/* =================================================================== */

	.drawer-header {
		padding: 1rem 1.4rem 0.85rem;
		padding-right: 3.5rem; /* clear the RightDrawer's overlay close button */
		border-bottom: 1px solid #E7E5E2;
		background: var(--panel);
	}
	.drawer-header-eyebrow {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--grayblue);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.drawer-body {
		flex: 1;
		overflow-y: auto;
		padding: 1.25rem 1.4rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.drawer-pill-strip {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.55rem 0.7rem;
		background: var(--panel);
		border-left: 4px solid var(--strip, var(--midgrayblue));
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--grayblue);
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.drawer-polarity { font-weight: 600; }
	.drawer-confidence { color: var(--gray); }

	.drawer-title {
		font-family: var(--font-heading);
		font-weight: 500;
		font-size: 1.6rem;
		line-height: 1.2;
		color: var(--darkgrayblue);
		margin: 0;
		text-wrap: balance;
	}
	.drawer-text {
		font-family: var(--font-body);
		font-size: 1.02rem;
		line-height: 1.55;
		color: var(--ink);
		margin: 0;
		text-wrap: pretty;
	}

	.drawer-citation {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #6469A6;
	}
	.drawer-source-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.drawer-source-id {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		background: #EEF0FB;
		color: #2A2F66;
		padding: 0.3rem 0.5rem;
		display: inline-block;
		width: fit-content;
		max-width: 100%;
		overflow-wrap: break-word;
	}

	.drawer-section {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding-top: 0.6rem;
		border-top: 1px solid #E7E5E2;
	}
	.drawer-section-title {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--grayblue);
		margin: 0;
	}

	.drawer-quote-block {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding-top: 0.4rem;
	}
	.drawer-quote {
		padding: 0.7rem 0.8rem;
		background: var(--panel);
		border-left: 3px solid #D0D9DC;
	}
	.drawer-quote-speaker {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--grayblue);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		margin-bottom: 0.3rem;
	}
	.drawer-quote-text {
		font-family: var(--font-body);
		font-size: 0.97rem;
		line-height: 1.45;
		color: var(--ink);
	}

	/* ---------------- Keyword link ---------------- */

	.kw-link {
		display: inline;
		border: 0;
		background: transparent;
		padding: 0;
		font: inherit;
		color: inherit;
		text-decoration: underline;
		text-decoration-color: rgba(68, 96, 121, 0.45);
		text-decoration-thickness: 1px;
		text-underline-offset: 3px;
		cursor: pointer;
		transition: color 0.14s ease, text-decoration-color 0.14s ease;
	}
	.kw-link:hover,
	.kw-link:focus-visible {
		color: var(--darkgrayblue);
		text-decoration-color: var(--darkgrayblue);
		outline: none;
	}

	/* =================================================================== */
	/* FOOTER                                                                */
	/* =================================================================== */

	.page-footer {
		margin-top: 4rem;
		padding-top: 1.5rem;
		border-top: 1px solid #E7E5E2;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--gray);
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.page-footer p { margin: 0; }

	/* =================================================================== */
	/* PRINT                                                                 */
	/* =================================================================== */

	@media print {
		.stage-aside-sticky { position: static; }
		.stage, .decision-stage { break-inside: avoid; }
	}
</style>
