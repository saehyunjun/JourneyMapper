<!--
	Executive summary — patientlyiq landing page.

	History: graduated from bento-spike/+page.svelte on 2026-05-29 (see
	_archive_v3/+page.svelte for the prior 3-column dot-grid implementation).

	The layout is a bento board of evidence cards. Each cell clicks through
	to a side drawer:
	  · finding cells           → FindingEvidenceDrawer
	  · quote cells             → QuoteDetail (in RightDrawer)
	  · CAR-T search-volume     → inline ChartDrawer (source-data table)
	  · sentiment-bubble cell   → inline ChartDrawer (split breakdown)

	Indication-aware: data is built via getExecSummaryData(), which dispatches
	to wctglpdemo (obesity) or the fragment corpora (LN, MS). The page reads
	exec-summary-config.json to decide what to anchor and which axes to
	compare in the sentiment widget — per Aaron's directives (2026-05-29):
	  - Top 3 quotes always anchor on a configured sub-theme (not corpus-wide).
	  - Sentiment widgets show per-axis breakdown when axes are configured;
	    LN + MS default to CAR T-cell therapy vs Other. Drug-specific and
	    clinical-trials axes are analyst-authored in exec-summary-config.json.

	Cells that depend on obesity-specific finding outputs (lead-chart waffle,
	finding-b stat) hide for indications without a runtime findings pipeline.
	Those will come back online once the new bento-shape proposer
	(scripts/propose-exec-summary.mjs) writes findings for LN + MS.
-->
<script lang="ts">
	import BentoBoard from '$lib/components/bento/BentoBoard.svelte';
	import BentoCell from '$lib/components/bento/BentoCell.svelte';
	import StatCard from '$lib/components/bento/StatCard.svelte';
	import ChartCard from '$lib/components/bento/ChartCard.svelte';
	import NarrativeCard from '$lib/components/bento/NarrativeCard.svelte';
	import SearchVolumeLineChart from '$lib/components/bento/SearchVolumeLineChart.svelte';
	import KeyQuoteCard from '$lib/components/KeyQuoteCard.svelte';
	import StackedCards from '$lib/components/StackedCards.svelte';
	import BubbleChart from '$lib/components/BubbleChart.svelte';
	import SentimentDonut from '$lib/components/SentimentDonut.svelte';
	import IndicationPicker from '$lib/components/IndicationPicker.svelte';
	import { ChevronDown } from '@lucide/svelte';
	import FindingEvidenceDrawer from '$lib/components/exec-summary/FindingEvidenceDrawer.svelte';
	import QuoteDetail from '$lib/components/exec-summary/QuoteDetail.svelte';
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';
	import type { BentoSize } from '$lib/components/bento/types';
	import { quotes, type Quote } from '$lib/content/wctglpdemo-data/analysis';
	import {
		getExecSummaryData,
		type AnchorQuote,
		type AxisBreakdown,
		type Finding
	} from '$lib/content/exec-summary-data';
	import type { ParticipantProfile } from '$lib/types/participant-profile';
	import type { LayoutData } from './$types';
	import lnLtfuFriction from '$lib/content/disease-insights/lupus-nephritis/ltfu_friction.json';
	import lnSuggestedResearch from '$lib/content/disease-insights/lupus-nephritis/suggested_research.json';
	import msSuggestedResearch from '$lib/content/disease-insights/multiple-sclerosis/suggested_research.json';

	type LtfuEvidence = 'corpus' | 'projected';
	type LtfuCell = { summary: string; evidence: LtfuEvidence };
	type LtfuPillar = {
		id: string;
		label: string;
		trend: string;
		cells: Record<string, LtfuCell>;
	};
	type LtfuHorizon = { id: string; label: string; sublabel: string };
	type LtfuIntervention = { id: string; label: string; frame: string; body: string };
	type LtfuFriction = {
		memo: {
			eyebrow: string;
			headline: string;
			body: string;
			kicker: { value: string; label: string };
		};
		horizons: LtfuHorizon[];
		pillars: LtfuPillar[];
		evidence_legend: Record<LtfuEvidence, string>;
		what_would_strengthen_this: string[];
		possible_interventions?: LtfuIntervention[];
	};

	type SuggestedRecommendation = { label: string; frame: string; body: string };
	type SuggestedQuestion = {
		id: string;
		label: string;
		frame: string;
		summary: string;
		research: { headline: string; items: string[] };
		recommendations: { headline: string; items: SuggestedRecommendation[] };
	};
	type SuggestedResearch = {
		section: { eyebrow: string; headline: string; body: string };
		questions: SuggestedQuestion[];
	};

	let { data }: { data: LayoutData } = $props();

	const activeIndication = $derived(data.slice?.active_indication ?? 'obesity');

	const execData = $derived(getExecSummaryData(activeIndication));

	// All findings/quotes derive from the unified ExecSummaryData. The runtime
	// builder handles obesity (via buildFindings) and fragment corpora (via
	// buildCorpusFindings) behind the same shape, with editorial copy overlaid
	// from exec-summary-blurbs.json when present.
	const leadFinding = $derived<Finding | null>(execData?.leadFinding ?? null);
	const findingB = $derived<Finding | null>(execData?.secondFinding ?? null);

	const bridgeNarrative = $derived(execData?.bridgeNarrative ?? null);
	const teaserAnchorQuote = $derived<AnchorQuote | null>(execData?.teaserQuote ?? null);
	const longAnchorQuote = $derived<AnchorQuote | null>(execData?.longQuote ?? null);

	// Obesity has a richer Quote shape with quote_score — when the teaser/long
	// resolves to a quote_bank entry, prefer that for the KeyQuoteCard's
	// in-card metadata. Falls back to AnchorQuote (corpus indications).
	const teaserObesityQuote = $derived<Quote | null>(
		activeIndication === 'obesity' && teaserAnchorQuote
			? quotes.find((q) => q.quote_id === teaserAnchorQuote.id) ?? null
			: null
	);
	const longObesityQuote = $derived<Quote | null>(
		activeIndication === 'obesity' && longAnchorQuote
			? quotes.find((q) => q.quote_id === longAnchorQuote.id) ?? null
			: null
	);

	function quoteSize(size: BentoSize): 'sm' | 'lg' {
		return size === 'lg' || size === 'xl' ? 'lg' : 'sm';
	}

	/** Adapt a corpus AnchorQuote into the Quote shape the QuoteDetail drawer
	 *  expects. Fills the wctglpdemo-specific fields (quote_id, segment_ids,
	 *  quote_score) with reasonable defaults — the drawer only reads
	 *  text/sentiment/themes/interview_id/question_id directly. */
	function anchorQuoteAsQuote(a: AnchorQuote | null): Quote | null {
		if (!a) return null;
		return {
			quote_id: a.id,
			interview_id: a.speakerId,
			question_id: a.questionId ?? '',
			text: a.text,
			sentiment: a.sentiment,
			emotions: [],
			themes: a.themes,
			subthemes: a.subthemes,
			segment_ids: [a.id],
			quote_score: { overall: Math.abs(a.sentiment), clarity: 0, intensity: 0, strategic: 0 }
		} as unknown as Quote;
	}

	const profiles: Record<string, ParticipantProfile> = {};
	const onparticipant = (_id: string) => {};

	// Headline stats — adapt label set to indication.
	const headline = $derived(execData?.headlineStats ?? []);

	// Anchor sub-theme top 3 — single source of truth, regardless of indication.
	const anchorQuotes = $derived<AnchorQuote[]>(execData?.anchorQuotes ?? []);
	const anchorSubthemeLabel = $derived(execData?.anchorSubtheme?.label ?? null);

	const QUOTE_STACK_SPREAD_ROT = [0, -14, 12, -10];
	const QUOTE_STACK_SPREAD_TX = [0, -60, 65, -42];
	const QUOTE_STACK_SPREAD_TY = [0, 22, 32, 44];

	// LTFU memo + 4-pillar × time-horizon friction matrix. Currently authored
	// only for LN (CAR-T autoimmune context). Adding a sibling JSON under
	// another indication's disease-insights folder + extending the gate below
	// is all that's needed to surface it elsewhere.
	const ltfuFriction = $derived<LtfuFriction | null>(
		activeIndication === 'lupus_nephritis' ? (lnLtfuFriction as LtfuFriction) : null
	);

	// Suggested-research section. Authored for LN + MS today (the two CAR-T
	// indications in the sponsor BDM). Click-through targets a specific
	// question by id and opens the tabbed primary drawer focused on it.
	const suggestedResearch = $derived<SuggestedResearch | null>(
		activeIndication === 'lupus_nephritis'
			? (lnSuggestedResearch as SuggestedResearch)
			: activeIndication === 'multiple_sclerosis'
				? (msSuggestedResearch as SuggestedResearch)
				: null
	);

	// Sentiment widget — axis-mode when config provides axes (LN/MS today),
	// fallback to overall pos/neg when empty (obesity).
	const sentimentAxes = $derived<AxisBreakdown[]>(execData?.axes ?? []);
	const overallLean = $derived<AxisBreakdown | null>(execData?.overallLean ?? null);
	const inAxisMode = $derived(sentimentAxes.length > 0);

	// Bubble dataset: a single (positive/negative) pair in overall mode, or
	// one positive + one negative per axis in axis mode (rendered as labeled
	// column-pairs by BubbleChart).
	const bubbleItems = $derived(
		inAxisMode
			? sentimentAxes.flatMap((a) => [`${a.id}__pos`, `${a.id}__neg`])
			: ['positive', 'negative']
	);
	const bubbleValues = $derived(
		inAxisMode
			? sentimentAxes.flatMap((a) => [a.posPct, a.negPct])
			: overallLean
				? [overallLean.posPct, overallLean.negPct]
				: [0, 0]
	);
	const bubbleLabels = $derived(
		inAxisMode
			? sentimentAxes.flatMap((a) => [`${a.label} +`, `${a.label} −`])
			: ['Positive', 'Negative']
	);
	const bubblePalette = $derived(
		inAxisMode
			? sentimentAxes.flatMap(() => [
				'var(--positive-fg, #047857)',
				'var(--negative-fg, #b91c1c)'
			])
			: ['var(--positive-fg, #047857)', 'var(--negative-fg, #b91c1c)']
	);

	// === Drawer state ===
	type ActiveDrawer =
		| { kind: 'finding'; finding: Finding }
		| { kind: 'quote'; quote: Quote }
		| { kind: 'chart-search-volume' }
		| { kind: 'chart-sentiment-lean' }
		| { kind: 'chart-stacked-quotes' }
		| { kind: 'ltfu-friction' }
		| { kind: 'suggested-research'; focusQuestionId?: string; initialTab?: 'research' | 'recommendations' };
	let activeDrawer = $state<ActiveDrawer | null>(null);
	let drawerOpen = $state(false);
	let suggestedTab = $state<'research' | 'recommendations'>('research');

	function openDrawer(d: ActiveDrawer) {
		activeDrawer = d;
		drawerOpen = true;
		if (d.kind === 'suggested-research') {
			suggestedTab = d.initialTab ?? 'research';
			// Defer scroll-to-question until the drawer body has mounted.
			if (d.focusQuestionId) {
				const target = d.focusQuestionId;
				queueMicrotask(() => {
					const el = document.querySelector(
						`[data-suggested-question="${target}"]`
					) as HTMLElement | null;
					el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
				});
			}
		}
	}
	$effect(() => {
		if (!drawerOpen) activeDrawer = null;
	});

	function handleCellClick(id: string) {
		switch (id) {
			case 'hero':
				if (leadFinding) openDrawer({ kind: 'finding', finding: leadFinding });
				return;
			case 'bridge-narrative':
				if (leadFinding) openDrawer({ kind: 'finding', finding: leadFinding });
				return;
			case 'lead-chart':
				if (leadFinding) openDrawer({ kind: 'finding', finding: leadFinding });
				return;
			case 'finding-b':
				if (findingB) openDrawer({ kind: 'finding', finding: findingB });
				return;
			case 'search-volume':
				openDrawer({ kind: 'chart-search-volume' });
				return;
			case 'sentiment-bubble':
				openDrawer({ kind: 'chart-sentiment-lean' });
				return;
			case 'stacked-quotes':
				openDrawer({ kind: 'chart-stacked-quotes' });
				return;
			case 'quote-teaser': {
				const q = teaserObesityQuote ?? anchorQuoteAsQuote(teaserAnchorQuote);
				if (q) openDrawer({ kind: 'quote', quote: q });
				return;
			}
			case 'long-quote': {
				const q = longObesityQuote ?? anchorQuoteAsQuote(longAnchorQuote);
				if (q) openDrawer({ kind: 'quote', quote: q });
				return;
			}
			case 'ltfu-memo':
			case 'ltfu-matrix':
				if (ltfuFriction) openDrawer({ kind: 'ltfu-friction' });
				return;
			case 'suggested-research':
				if (suggestedResearch) openDrawer({ kind: 'suggested-research' });
				return;
		}
	}

	function openSuggestedQuestion(qid: string, initialTab: 'research' | 'recommendations' = 'research') {
		if (suggestedResearch) {
			openDrawer({ kind: 'suggested-research', focusQuestionId: qid, initialTab });
		}
	}
</script>

<div class="page-frame">
	<header class="page-header">
		<div class="eyebrow-row">
			<span class="eyebrow">Executive summary</span>
			<span class="eyebrow-sep" aria-hidden="true">·</span>
			{#if data.slice?.indications?.length}
				<IndicationPicker
					indications={data.slice.indications}
					therapeuticAreas={data.slice.therapeutic_areas}
					activeIndication={data.slice.active_indication}
				>
					{#snippet trigger({ active, props })}
						<button
							{...props}
							type="button"
							class="indication-pill"
							aria-label="Change indication"
						>
							<span class="indication-pill-label">{active?.label ?? '—'}</span>
							<ChevronDown class="size-3.5 opacity-60" />
						</button>
					{/snippet}
				</IndicationPicker>
			{/if}
		</div>
		<h1>Patient Insights</h1>
		<p class="lede">
			{#if execData?.overviewBlurb}
				{execData.overviewBlurb}
			{:else}
				Each card opens a side drawer with the evidence behind it — quote sets, cluster bubble
				charts, source data.
			{/if}
		</p>
	</header>

	{#if !execData}
		<section class="empty-state">
			<p>
				The executive-summary view isn't configured for this indication yet. Open
				<code>src/lib/content/exec-summary-config.json</code> to add an anchor sub-theme and the
				sentiment axes you want surfaced.
			</p>
		</section>
	{:else}
		<!-- KPI headline row: orientation stats outside the bento grid. -->
		<section class="headline-row" aria-label="Corpus headline stats">
			{#each headline as s (s.label)}
				<div class="headline-stat">
					<span class="headline-value">{s.value}</span>
					<span class="headline-label">{s.label}</span>
				</div>
			{/each}
		</section>

		<BentoBoard staticBoard={true}>
			<!-- Row 1: hero sentiment + bridge narrative.
				 Hero shows the first axis (e.g. CAR T) when axes are configured;
				 falls back to overall sentiment otherwise. -->
			<BentoCell id="hero" size="lg" width="2/3" height={3} onCellClick={handleCellClick}>
				{#snippet child(size)}
					{@const heroAxis = inAxisMode ? sentimentAxes[0] : overallLean}
					{#if heroAxis}
						<StatCard
							{size}
							eyebrow={inAxisMode
								? `Sentiment · ${heroAxis.label}`
								: 'Sentiment lean'}
							figure="{heroAxis.posPct}%"
							label="positive"
							caption={inAxisMode
								? `Across ${heroAxis.total} ${heroAxis.label} mentions, sentiment tips ${heroAxis.lean}. ${heroAxis.negPct}% landed negative, ${heroAxis.neuPct}% neutral.`
								: `Across ${heroAxis.total} coded moments, the corpus tips ${heroAxis.lean}. ${heroAxis.negPct}% landed negative, ${heroAxis.neuPct}% neutral.`}
							split={{
								positive: heroAxis.positive,
								neutral: heroAxis.neutral,
								negative: heroAxis.negative
							}}
							tone={heroAxis.lean === 'negative' ? 'negative' : 'positive'}
						/>
					{/if}
				{/snippet}
			</BentoCell>

			{#if bridgeNarrative || activeIndication === 'obesity'}
				<BentoCell
					id="bridge-narrative"
					size="md"
					width="1/3"
					height={3}
					onCellClick={handleCellClick}
				>
					{#snippet child(size)}
						{#if bridgeNarrative}
							<NarrativeCard
								{size}
								eyebrow={bridgeNarrative.eyebrow}
								headline={bridgeNarrative.headline}
								caption={bridgeNarrative.caption}
								body={bridgeNarrative.body}
								tone={bridgeNarrative.tone ?? 'neutral'}
								points={bridgeNarrative.points ?? []}
							/>
						{:else}
							<NarrativeCard
								{size}
								eyebrow="The throughline"
								headline="The issue is access, not tolerability."
								caption="Travel burden gates trial participation; coverage uncertainty gates long-term treatment commitment."
								body="Patients on effective therapy report the highest anxiety not about side effects but about losing the drug mid-course — a logistics problem dressed as a clinical one. Trial logistics map the same way: site visits and washout schedules deter enrollment more than trial design itself."
								tone="negative"
								points={[
									{ value: '13', label: 'Travel' },
									{ value: '22', label: 'Insurance' },
									{ value: '10', label: 'Cost' }
								]}
							/>
						{/if}
					{/snippet}
				</BentoCell>
			{/if}

			<!-- LTFU friction memo + matrix. LN-gated: the 4-pillar × time-horizon
				 friction projection for the ~12-year CAR-T LTFU tail. Authored
				 against the SLE/LN CAR-T-curious persona; placed here so it sits
				 directly under hero+bridge when the obesity-only lead-chart /
				 finding-b cells aren't rendering. -->
			{#if ltfuFriction}
				<BentoCell
					id="ltfu-memo"
					size="lg"
					width="1/3"
					height={5}
					onCellClick={handleCellClick}
				>
					{#snippet child(_size)}
						<div class="test-card ltfu-memo-card">
							<header class="ltfu-memo-head">
								<span class="test-eyebrow">{ltfuFriction.memo.eyebrow}</span>
								<h3 class="test-headline">{ltfuFriction.memo.headline}</h3>
							</header>
							<p class="test-caption ltfu-memo-body">{ltfuFriction.memo.body}</p>
							<footer class="ltfu-memo-kicker">
								<span class="ltfu-kicker-value">{ltfuFriction.memo.kicker.value}</span>
								<span class="ltfu-kicker-label">{ltfuFriction.memo.kicker.label}</span>
							</footer>
						</div>
					{/snippet}
				</BentoCell>

				<BentoCell
					id="ltfu-matrix"
					size="lg"
					width="2/3"
					height={5}
					onCellClick={handleCellClick}
				>
					{#snippet child(_size)}
						<div class="test-card ltfu-matrix-card">
							<header class="ltfu-matrix-head">
								<span class="test-eyebrow">Pillar × horizon</span>
								<h3 class="test-headline">Where retention bleeds, by year.</h3>
								<p class="ltfu-matrix-legend">
									<span class="ltfu-legend-item">
										<span class="ltfu-evidence-dot ltfu-evidence-corpus" aria-hidden="true"></span>
										Corpus
									</span>
									<span class="ltfu-legend-item">
										<span class="ltfu-evidence-dot ltfu-evidence-projected" aria-hidden="true"></span>
										Projected
									</span>
								</p>
							</header>
							<div class="ltfu-matrix" role="table" aria-label="LTFU friction by pillar and year horizon">
								<div class="ltfu-matrix-row ltfu-matrix-row--header" role="row">
									<div class="ltfu-pillar-col ltfu-pillar-col--header" role="columnheader">Pillar</div>
									{#each ltfuFriction.horizons as h (h.id)}
										<div class="ltfu-cell ltfu-cell--header" role="columnheader">
											<span class="ltfu-horizon-label">{h.label}</span>
											<span class="ltfu-horizon-sub">{h.sublabel}</span>
										</div>
									{/each}
								</div>
								{#each ltfuFriction.pillars as p (p.id)}
									<div class="ltfu-matrix-row" role="row">
										<div class="ltfu-pillar-col" role="rowheader">
											<span class="ltfu-pillar-label">{p.label}</span>
											<span class="ltfu-pillar-trend">{p.trend}</span>
										</div>
										{#each ltfuFriction.horizons as h (h.id)}
											{@const cell = p.cells[h.id]}
											<div
												class="ltfu-cell ltfu-cell--{cell.evidence}"
												role="cell"
												data-evidence={cell.evidence}
											>
												<span class="ltfu-cell-summary">{cell.summary}</span>
												<span
													class="ltfu-evidence-dot ltfu-evidence-{cell.evidence}"
													aria-hidden="true"
												></span>
											</div>
										{/each}
									</div>
								{/each}
							</div>
						</div>
					{/snippet}
				</BentoCell>
			{/if}

			<!-- Suggested for further research. Authored for LN + MS (CAR-T BDM
				 scope). Click a question to open the tabbed primary drawer
				 (Research / Recommendations) scrolled to that question. -->
			{#if suggestedResearch}
				<BentoCell
					id="suggested-research"
					size="lg"
					width="full"
					height={4}
					onCellClick={handleCellClick}
				>
					{#snippet child(_size)}
						<div class="test-card suggested-card">
							<header class="suggested-head">
								<span class="test-eyebrow">{suggestedResearch.section.eyebrow}</span>
								<h3 class="test-headline">{suggestedResearch.section.headline}</h3>
								<p class="test-caption suggested-body">{suggestedResearch.section.body}</p>
							</header>
							<ul class="suggested-grid" role="list">
								{#each suggestedResearch.questions as q (q.id)}
									<li class="suggested-question">
										<button
											type="button"
											class="suggested-question-btn"
											onclick={(e) => {
												e.stopPropagation();
												openSuggestedQuestion(q.id, 'research');
											}}
										>
											<span class="suggested-question-frame">{q.frame}</span>
											<span class="suggested-question-label">{q.label}</span>
											<span class="suggested-question-summary">{q.summary}</span>
											<span class="suggested-question-actions">
												<span
													class="suggested-tab-link"
													onclick={(e) => {
														e.stopPropagation();
														openSuggestedQuestion(q.id, 'research');
													}}
													onkeydown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.preventDefault();
															e.stopPropagation();
															openSuggestedQuestion(q.id, 'research');
														}
													}}
													role="link"
													tabindex="0"
												>Research →</span>
												<span
													class="suggested-tab-link"
													onclick={(e) => {
														e.stopPropagation();
														openSuggestedQuestion(q.id, 'recommendations');
													}}
													onkeydown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.preventDefault();
															e.stopPropagation();
															openSuggestedQuestion(q.id, 'recommendations');
														}
													}}
													role="link"
													tabindex="0"
												>Recommendations →</span>
											</span>
										</button>
									</li>
								{/each}
							</ul>
						</div>
					{/snippet}
				</BentoCell>
			{/if}

			<!-- Row 2: cluster waffle finding. -->
			{#if leadFinding}
				{@const leadTone =
					leadFinding.tone === 'positive'
						? 'positive'
						: leadFinding.tone === 'negative'
							? 'negative'
							: 'neutral'}
				{@const leadFigure =
					leadFinding.tone === 'positive'
						? leadFinding.distribution.positive
						: leadFinding.distribution.negative}
				{@const leadLabel = leadFinding.tone === 'positive' ? 'positive mentions' : 'negative mentions'}
				<BentoCell id="lead-chart" size="lg" width="full" height={3} onCellClick={handleCellClick}>
					{#snippet child(size)}
						<ChartCard
							{size}
							eyebrow={leadFinding.eyebrow}
							figure={leadFigure}
							label={leadLabel}
							caption={leadFinding.headline}
							clusters={leadFinding.clusters.map((c) => ({
								id: c.id,
								label: c.label,
								blocks: c.blocks,
								count: c.count
							}))}
							interpretation={leadFinding.analysis ?? leadFinding.detail}
							tone={leadTone}
						/>
					{/snippet}
				</BentoCell>
			{/if}

			<!-- Row 3: digital signal + finding-b stat.
				 search-volume keeps showing for every indication (CAR-T mock applies
				 to LN/MS, illustrative for obesity). finding-b hides for non-obesity. -->
			<BentoCell id="search-volume" size="lg" width="2/3" height={3} onCellClick={handleCellClick}>
				{#snippet child(size)}
					<SearchVolumeLineChart {size} />
				{/snippet}
			</BentoCell>

			{#if findingB}
				{@const secondTone =
					findingB.tone === 'positive'
						? 'positive'
						: findingB.tone === 'negative'
							? 'negative'
							: 'neutral'}
				{@const secondFigure =
					findingB.tone === 'positive'
						? findingB.distribution.positive
						: findingB.distribution.negative}
				{@const secondLabel = findingB.tone === 'positive' ? 'positive mentions' : 'negative mentions'}
				<BentoCell id="finding-b" size="md" width="1/3" height={3} onCellClick={handleCellClick}>
					{#snippet child(size)}
						<StatCard
							{size}
							eyebrow={findingB.eyebrow}
							figure={secondFigure}
							label={secondLabel}
							caption={findingB.headline}
							narrative={findingB.lede ?? findingB.analysis ?? findingB.detail}
							split={findingB.distribution}
							subStats={findingB.clusters.slice(0, 3).map((c) => ({
								value: c.count,
								label: c.label
							}))}
							tone={secondTone}
						/>
					{/snippet}
				</BentoCell>
			{/if}

			<!-- Row 4: anchor sub-theme stack + sentiment bubble + teaser quote. -->
			{#if anchorQuotes.length}
				<BentoCell
					id="stacked-quotes"
					size="lg"
					width="2/3"
					height={4}
					onCellClick={handleCellClick}
				>
					{#snippet child(_size)}
						<div class="test-card three-quote-card">
							<header class="three-quote-corner">
								<span class="test-eyebrow">Top three quotes</span>
								<h3 class="test-headline">
									{execData?.anchorSubthemeBlurb?.headline ?? 'The anchors of the corpus.'}
								</h3>
							</header>
							<div class="three-quote-stack-area">
								<div class="three-quote-frame">
									<StackedCards
										items={anchorQuotes}
										aspect="3 / 4"
										showControls={false}
										expandable={false}
										behindRot={QUOTE_STACK_SPREAD_ROT}
										behindTx={QUOTE_STACK_SPREAD_TX}
										behindTy={QUOTE_STACK_SPREAD_TY}
									>
										{#snippet item(q: AnchorQuote, _i: number)}
											<KeyQuoteCard
												text={q.text}
												sentiment={q.sentiment}
												interviewId={q.speakerId}
												questionId={q.questionId ?? ''}
												themes={q.themes}
												{profiles}
												{onparticipant}
												size="sm"
												variant="compact"
											/>
										{/snippet}
									</StackedCards>
								</div>
							</div>
							<footer class="three-quote-corner three-quote-bottom">
								<p class="test-caption">
									{#if execData?.anchorSubthemeBlurb}
										{execData.anchorSubthemeBlurb.caption}
									{:else if anchorSubthemeLabel}
										Strongest verbatim quotes from {anchorSubthemeLabel}, ranked by sentiment
										intensity and quotable length.
									{:else}
										Highest-scored verbatim quotes by combined clarity, emotional intensity, and
										strategic value.
									{/if}
								</p>
							</footer>
						</div>
					{/snippet}
				</BentoCell>
			{/if}

			<BentoCell
				id="sentiment-bubble"
				size="md"
				width="1/3"
				height={2}
				onCellClick={handleCellClick}
			>
				{#snippet child(_size)}
					<div class="test-card bubble-card">
						<header class="bubble-card-header">
							<span class="test-eyebrow">Sentiment lean</span>
							<h3 class="test-headline">
								{#if execData?.sentimentLeanBlurb}
									{execData.sentimentLeanBlurb.headline}
								{:else if inAxisMode}
									{sentimentAxes.map((a) => a.label).join(' vs ')}.
								{:else if overallLean}
									{overallLean.lean === 'positive'
										? 'Positive dominates the corpus.'
										: overallLean.lean === 'negative'
											? 'Negative dominates the corpus.'
											: 'The corpus splits down the middle.'}
								{/if}
							</h3>
						</header>
						<div class="bubble-stage">
							<BubbleChart
								items={bubbleItems}
								values={bubbleValues}
								labels={bubbleLabels}
								units="%"
								variant="center"
								allowUserOverride={false}
								width={520}
								height={260}
								palette={bubblePalette}
							/>
						</div>
					</div>
				{/snippet}
			</BentoCell>

			{#if teaserAnchorQuote}
				<BentoCell
					id="quote-teaser"
					size="sm"
					width="1/3"
					height={2}
					onCellClick={handleCellClick}
				>
					{#snippet child(size)}
						<div class="quote-wrap">
							<KeyQuoteCard
								text={teaserAnchorQuote.text}
								sentiment={teaserAnchorQuote.sentiment}
								interviewId={teaserAnchorQuote.speakerId}
								questionId={teaserAnchorQuote.questionId ?? ''}
								themes={teaserAnchorQuote.themes}
								{profiles}
								{onparticipant}
								size={quoteSize(size)}
							/>
						</div>
					{/snippet}
				</BentoCell>
			{/if}

			<!-- Row 5: long-form anchor verbatim. -->
			{#if longAnchorQuote}
				<BentoCell
					id="long-quote"
					size="lg"
					width="full"
					height={2}
					onCellClick={handleCellClick}
				>
					{#snippet child(size)}
						<div class="quote-wrap">
							<KeyQuoteCard
								text={longAnchorQuote.text}
								sentiment={longAnchorQuote.sentiment}
								interviewId={longAnchorQuote.speakerId}
								questionId={longAnchorQuote.questionId ?? ''}
								themes={longAnchorQuote.themes}
								{profiles}
								{onparticipant}
								size={quoteSize(size)}
							/>
						</div>
					{/snippet}
				</BentoCell>
			{/if}
		</BentoBoard>
	{/if}
</div>

<!-- Drawer surface — discriminated render per active cell. -->
{#if activeDrawer?.kind === 'finding'}
	<FindingEvidenceDrawer
		bind:open={drawerOpen}
		finding={activeDrawer.finding}
		{profiles}
		{onparticipant}
	/>
{:else if activeDrawer?.kind === 'quote'}
	<RightDrawer bind:open={drawerOpen}>
		<QuoteDetail quote={activeDrawer.quote} {profiles} {onparticipant} />
	</RightDrawer>
{:else if activeDrawer?.kind === 'chart-search-volume'}
	<RightDrawer bind:open={drawerOpen}>
		<div class="drawer-body">
			<header class="drawer-head">
				<span class="drawer-eyebrow">Digital signal</span>
				<h2>CAR-T cell therapy — 5y search volume</h2>
				<p>
					Mock series shaped to mirror the lift around the autoimmune-indication CAR-T programs
					(KYV-101, CABA-201, DSC-08). Monthly normalized search interest, US.
				</p>
			</header>
			<section class="drawer-section">
				<h3>Inflection points</h3>
				<dl class="drawer-dl">
					<dt>2023 H1</dt>
					<dd>NEJM lupus-CAR-T case series breaks into mainstream press.</dd>
					<dt>2024 Q1–Q3</dt>
					<dd>Phase-1 readouts across KYV-101 / CABA-201 expand the search base.</dd>
					<dt>2025 H1</dt>
					<dd>Coverage broadens beyond lupus to MG, SLE, and idiopathic indications.</dd>
				</dl>
			</section>
		</div>
	</RightDrawer>
{:else if activeDrawer?.kind === 'chart-sentiment-lean'}
	<RightDrawer bind:open={drawerOpen}>
		<div class="drawer-body">
			<header class="drawer-head">
				<span class="drawer-eyebrow">Sentiment lean</span>
				<h2>{inAxisMode ? 'Split by axis' : 'Where the corpus tips'}</h2>
				<p>
					{#if inAxisMode}
						Each axis below partitions the corpus by a separate filter. Counts can overlap
						across non-complement axes when a fragment matches more than one.
					{:else if overallLean}
						{overallLean.total} coded moments split by sentiment polarity. Bubble area encodes share
						of total.
					{/if}
				</p>
			</header>
			<section class="drawer-section">
				<h3>Distribution</h3>
				{#if inAxisMode}
					<ul class="sentiment-axis-list">
						{#each sentimentAxes as a (a.id)}
							<li class="sentiment-axis-row">
								<SentimentDonut
									positive={a.positive}
									neutral={a.neutral}
									negative={a.negative}
									size={56}
									motionMode="dashboard"
								/>
								<div class="sentiment-axis-meta">
									<h4>{a.label}</h4>
									<span class="sentiment-axis-total">{a.total} moments</span>
									<dl class="sentiment-legend">
										<div class="sentiment-legend-row">
											<span class="sentiment-swatch sentiment-swatch-pos" aria-hidden="true"></span>
											<dt>Positive</dt>
											<dd>{a.posPct}%<span class="sentiment-legend-count"> · {a.positive}</span></dd>
										</div>
										<div class="sentiment-legend-row">
											<span class="sentiment-swatch sentiment-swatch-neu" aria-hidden="true"></span>
											<dt>Neutral</dt>
											<dd>{a.neuPct}%<span class="sentiment-legend-count"> · {a.neutral}</span></dd>
										</div>
										<div class="sentiment-legend-row">
											<span class="sentiment-swatch sentiment-swatch-neg" aria-hidden="true"></span>
											<dt>Negative</dt>
											<dd>{a.negPct}%<span class="sentiment-legend-count"> · {a.negative}</span></dd>
										</div>
									</dl>
								</div>
							</li>
						{/each}
					</ul>
				{:else if overallLean}
					<div class="sentiment-overall">
						<SentimentDonut
							positive={overallLean.positive}
							neutral={overallLean.neutral}
							negative={overallLean.negative}
							size={120}
							motionMode="dashboard"
						/>
						<dl class="sentiment-legend">
							<div class="sentiment-legend-row">
								<span class="sentiment-swatch sentiment-swatch-pos" aria-hidden="true"></span>
								<dt>Positive</dt>
								<dd>{overallLean.posPct}%<span class="sentiment-legend-count"> · {overallLean.positive} moments</span></dd>
							</div>
							<div class="sentiment-legend-row">
								<span class="sentiment-swatch sentiment-swatch-neu" aria-hidden="true"></span>
								<dt>Neutral</dt>
								<dd>{overallLean.neuPct}%<span class="sentiment-legend-count"> · {overallLean.neutral} moments</span></dd>
							</div>
							<div class="sentiment-legend-row">
								<span class="sentiment-swatch sentiment-swatch-neg" aria-hidden="true"></span>
								<dt>Negative</dt>
								<dd>{overallLean.negPct}%<span class="sentiment-legend-count"> · {overallLean.negative} moments</span></dd>
							</div>
						</dl>
					</div>
				{/if}
			</section>
		</div>
	</RightDrawer>
{:else if activeDrawer?.kind === 'ltfu-friction' && ltfuFriction}
	<RightDrawer bind:open={drawerOpen}>
		<div class="drawer-body">
			<header class="drawer-head">
				<span class="drawer-eyebrow">{ltfuFriction.memo.eyebrow}</span>
				<h2>{ltfuFriction.memo.headline}</h2>
				<p>{ltfuFriction.memo.body}</p>
			</header>
			<section class="drawer-section">
				<h3>Reading the matrix</h3>
				<dl class="drawer-dl">
					<dt>Corpus</dt>
					<dd>{ltfuFriction.evidence_legend.corpus}.</dd>
					<dt>Projected</dt>
					<dd>{ltfuFriction.evidence_legend.projected}.</dd>
				</dl>
			</section>
			<section class="drawer-section">
				<h3>Pillar trend lines</h3>
				<dl class="drawer-dl">
					{#each ltfuFriction.pillars as p (p.id)}
						<dt>{p.label}</dt>
						<dd>{p.trend}.</dd>
					{/each}
				</dl>
			</section>
			<section class="drawer-section">
				<h3>What would strengthen this</h3>
				<ul class="drawer-list">
					{#each ltfuFriction.what_would_strengthen_this as item, i (i)}
						<li>{item}</li>
					{/each}
				</ul>
			</section>
			{#if ltfuFriction.possible_interventions?.length}
				<section class="drawer-section">
					<h3>Possible interventions</h3>
					<ul class="drawer-intervention-list">
						{#each ltfuFriction.possible_interventions as iv (iv.id)}
							<li class="drawer-intervention">
								<div class="drawer-intervention-head">
									<span class="drawer-intervention-label">{iv.label}</span>
									<span class="drawer-intervention-frame">{iv.frame}</span>
								</div>
								<p class="drawer-intervention-body">{iv.body}</p>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
	</RightDrawer>
{:else if activeDrawer?.kind === 'suggested-research' && suggestedResearch}
	<RightDrawer bind:open={drawerOpen}>
		<div class="drawer-body">
			<header class="drawer-head">
				<span class="drawer-eyebrow">{suggestedResearch.section.eyebrow}</span>
				<h2>{suggestedResearch.section.headline}</h2>
				<p>{suggestedResearch.section.body}</p>
			</header>
			<Tabs bind:value={suggestedTab} class="suggested-tabs">
				<TabsList variant="line" class="suggested-tabs-list">
					<TabsTrigger value="research">Research</TabsTrigger>
					<TabsTrigger value="recommendations">Recommendations</TabsTrigger>
				</TabsList>
				<TabsContent value="research">
					<div class="suggested-tab-panel">
						{#each suggestedResearch.questions as q (q.id)}
							<section
								class="drawer-section suggested-q"
								data-suggested-question={q.id}
							>
								<span class="suggested-q-frame">{q.frame}</span>
								<h3 class="suggested-q-label">{q.label}</h3>
								<p class="suggested-q-summary">{q.summary}</p>
								<h4 class="suggested-q-sub">{q.research.headline}</h4>
								<ul class="drawer-list">
									{#each q.research.items as item, i (i)}
										<li>{item}</li>
									{/each}
								</ul>
							</section>
						{/each}
					</div>
				</TabsContent>
				<TabsContent value="recommendations">
					<div class="suggested-tab-panel">
						{#each suggestedResearch.questions as q (q.id)}
							<section
								class="drawer-section suggested-q"
								data-suggested-question={q.id}
							>
								<span class="suggested-q-frame">{q.frame}</span>
								<h3 class="suggested-q-label">{q.label}</h3>
								<p class="suggested-q-summary">{q.summary}</p>
								<h4 class="suggested-q-sub">{q.recommendations.headline}</h4>
								<ul class="drawer-intervention-list">
									{#each q.recommendations.items as iv, i (i)}
										<li class="drawer-intervention">
											<div class="drawer-intervention-head">
												<span class="drawer-intervention-label">{iv.label}</span>
												<span class="drawer-intervention-frame">{iv.frame}</span>
											</div>
											<p class="drawer-intervention-body">{iv.body}</p>
										</li>
									{/each}
								</ul>
							</section>
						{/each}
					</div>
				</TabsContent>
			</Tabs>
		</div>
	</RightDrawer>
{:else if activeDrawer?.kind === 'chart-stacked-quotes'}
	<RightDrawer bind:open={drawerOpen}>
		<div class="drawer-body">
			<header class="drawer-head">
				<span class="drawer-eyebrow">Anchor quotes</span>
				<h2>Top three from {anchorSubthemeLabel ?? 'the corpus'}</h2>
				<p>
					Filtered to fragments tagged with the configured anchor sub-theme; ranked by sentiment
					strength and quotable length.
				</p>
			</header>
			<section class="drawer-section drawer-quote-stack">
				{#each anchorQuotes as q, i (q.id)}
					<div class="drawer-quote">
						<span class="drawer-quote-rank">#{i + 1}</span>
						<blockquote>{q.text}</blockquote>
						<span class="drawer-quote-meta">
							{q.speakerLabel} · sentiment {q.sentiment.toFixed(0)}
						</span>
					</div>
				{/each}
			</section>
		</div>
	</RightDrawer>
{/if}

<style>
	.page-frame {
		max-width: 88rem;
		margin: 0 auto;
		padding: 2rem 1.5rem 6rem;
	}
	.page-header {
		margin-bottom: 1.5rem;
	}
	.eyebrow {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent-mint, #047857);
	}
	.eyebrow-row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.55rem;
		margin-bottom: 0.5rem;
	}
	.eyebrow-sep {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--muted-foreground, #6b7280);
		line-height: 1;
	}

	/* Inline editorial indication pill — the active indication IS the
	   click target. Flat background hover (no side rails) to honor the
	   no-side-border-rounded-rect rule. */
	.indication-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.15rem 0.55rem 0.2rem;
		border-radius: 999px;
		border: 1px solid transparent;
		background: transparent;
		cursor: pointer;
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--ink, #312f28);
		line-height: 1.2;
		transition:
			background-color 140ms ease,
			border-color 140ms ease;
	}
	.indication-pill:hover {
		background: rgba(48, 47, 40, 0.05);
		border-color: rgba(48, 47, 40, 0.15);
	}
	.indication-pill[aria-expanded='true'] {
		background: rgba(48, 47, 40, 0.07);
		border-color: rgba(48, 47, 40, 0.2);
	}
	.indication-pill:focus-visible {
		outline: 2px solid var(--accent-mint, #047857);
		outline-offset: 2px;
	}
	.indication-pill-label {
		white-space: nowrap;
	}
	h1 {
		font-family: var(--font-heading);
		font-size: 2.25rem;
		font-weight: 500;
		line-height: 1.05;
		letter-spacing: -0.02em;
		color: var(--ink, #312f28);
		margin: 0 0 0.625rem 0;
	}
	.lede {
		font-family: var(--font-body, 'IBM Plex Sans', system-ui);
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--secondary-foreground, #312f28);
		max-width: 64ch;
		margin: 0;
	}

	.empty-state {
		border: 1px dashed rgba(48, 47, 40, 0.2);
		border-radius: 12px;
		padding: 2rem;
		color: var(--muted-foreground, #6b7280);
	}
	.empty-state code {
		font-family: var(--font-mono);
		font-size: 0.85em;
		padding: 0.1em 0.3em;
		background: rgba(48, 47, 40, 0.06);
		border-radius: 3px;
	}

	.headline-row {
		display: flex;
		gap: 2.5rem;
		align-items: baseline;
		padding: 1rem 0 1.25rem;
		margin-bottom: 1.75rem;
		border-top: 1px solid rgba(48, 47, 40, 0.18);
		border-bottom: 1px solid rgba(48, 47, 40, 0.18);
	}
	.headline-stat {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
	}
	.headline-value {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 2.25rem;
		font-weight: 500;
		line-height: 1;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
		color: var(--ink, #312f28);
	}
	.headline-label {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted-foreground, #6b7280);
	}

	.test-card {
		height: 100%;
		min-width: 0;
		border: 1px solid rgba(48, 47, 40, 0.12);
		border-radius: 12px;
		background: rgba(255, 254, 250, 0.85);
		padding: 1.5rem 1.75rem;
		overflow: visible;
	}
	.test-eyebrow {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent-mint, #047857);
	}
	.test-headline {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-weight: 500;
		font-size: 1.5rem;
		line-height: 1.2;
		letter-spacing: -0.01em;
		color: var(--ink, #312f28);
		margin: 0.5rem 0 0 0;
		text-wrap: balance;
	}
	.test-caption {
		font-family: var(--font-body, 'IBM Plex Sans', system-ui);
		font-size: 0.85rem;
		line-height: 1.5;
		color: var(--secondary-foreground, #312f28);
		margin: 0;
	}
	.three-quote-card {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
		grid-template-rows: auto 1fr auto;
		gap: 1rem;
	}
	.three-quote-corner {
		grid-column: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.three-quote-bottom {
		align-self: end;
	}
	.three-quote-stack-area {
		grid-column: 2;
		grid-row: 1 / span 3;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
	}
	.three-quote-frame {
		width: 65%;
		max-width: 22rem;
	}

	.bubble-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.bubble-card-header {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.bubble-stage {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.quote-wrap {
		height: 100%;
		min-width: 0;
	}

	/* LTFU memo (left, 1/3) — editorial framing card. */
	.ltfu-memo-card {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.ltfu-memo-head {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.ltfu-memo-body {
		flex: 1;
	}
	.ltfu-memo-kicker {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(48, 47, 40, 0.12);
	}
	.ltfu-kicker-value {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 2.25rem;
		font-weight: 500;
		line-height: 1;
		letter-spacing: -0.02em;
		color: var(--ink, #312f28);
		font-variant-numeric: tabular-nums;
	}
	.ltfu-kicker-label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted-foreground, #6b7280);
	}

	/* LTFU matrix (right, 2/3) — pillar rows × time-horizon columns. */
	.ltfu-matrix-card {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}
	.ltfu-matrix-head {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.ltfu-matrix-legend {
		display: flex;
		gap: 1.25rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted-foreground, #6b7280);
		margin: 0.25rem 0 0;
	}
	.ltfu-legend-item {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.ltfu-matrix {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		gap: 0.4rem;
	}
	.ltfu-matrix-row {
		display: grid;
		grid-template-columns: 9rem repeat(4, minmax(0, 1fr));
		gap: 0.4rem;
		flex: 1;
		min-height: 0;
	}
	.ltfu-matrix-row--header {
		flex: 0 0 auto;
	}
	.ltfu-pillar-col {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.25rem;
		padding: 0.6rem 0.75rem;
	}
	.ltfu-pillar-col--header {
		justify-content: flex-end;
	}
	.ltfu-pillar-label {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--ink, #312f28);
		line-height: 1.2;
	}
	.ltfu-pillar-trend {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted-foreground, #6b7280);
	}
	.ltfu-horizon-label {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--ink, #312f28);
	}
	.ltfu-horizon-sub {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted-foreground, #6b7280);
	}
	.ltfu-cell {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.4rem;
		padding: 0.65rem 0.75rem 0.55rem;
		border-radius: 8px;
		border: 1px solid rgba(48, 47, 40, 0.08);
		min-height: 0;
		overflow: hidden;
	}
	.ltfu-cell--header {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		border: none;
		padding: 0.5rem 0.75rem 0.3rem;
		background: transparent;
		justify-content: flex-end;
	}
	/* Tone via tinted background, never via a side rail — rounded card +
	   side border is a forbidden combination per the no-side-border rule. */
	.ltfu-cell--corpus {
		background: rgba(4, 120, 87, 0.06);
		border-color: rgba(4, 120, 87, 0.18);
	}
	.ltfu-cell--projected {
		background: rgba(48, 47, 40, 0.035);
	}
	.ltfu-cell-summary {
		font-family: var(--font-body, 'IBM Plex Sans', system-ui);
		font-size: 0.78rem;
		line-height: 1.4;
		color: var(--ink, #312f28);
	}
	.ltfu-evidence-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex: 0 0 auto;
	}
	.ltfu-evidence-corpus {
		background: var(--accent-mint, #047857);
	}
	.ltfu-evidence-projected {
		background: transparent;
		border: 1.5px solid rgba(48, 47, 40, 0.4);
	}
	.ltfu-cell .ltfu-evidence-dot {
		align-self: flex-end;
	}

	/* Suggested for further research — full-width grid of clickable question tiles. */
	.suggested-card {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.suggested-head {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-width: 64ch;
	}
	.suggested-body {
		margin-top: 0.15rem;
	}
	.suggested-grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 0.85rem;
	}
	.suggested-question {
		display: flex;
	}
	.suggested-question-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		text-align: left;
		background: rgba(255, 254, 250, 0.6);
		border: 1px solid rgba(48, 47, 40, 0.14);
		border-radius: 10px;
		padding: 0.9rem 1rem 1rem;
		cursor: pointer;
		transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
		font: inherit;
		color: inherit;
	}
	.suggested-question-btn:hover {
		background: rgba(255, 254, 250, 0.95);
		border-color: rgba(48, 47, 40, 0.3);
	}
	.suggested-question-btn:focus-visible {
		outline: 2px solid var(--accent-mint, #047857);
		outline-offset: 2px;
	}
	.suggested-question-frame {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent-mint, #047857);
	}
	.suggested-question-label {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 1rem;
		font-weight: 500;
		line-height: 1.25;
		color: var(--ink, #312f28);
		text-wrap: balance;
	}
	.suggested-question-summary {
		font-family: var(--font-body, 'IBM Plex Sans', system-ui);
		font-size: 0.82rem;
		line-height: 1.45;
		color: var(--secondary-foreground, #312f28);
	}
	.suggested-question-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin-top: 0.25rem;
	}
	.suggested-tab-link {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent-mint, #047857);
		cursor: pointer;
		border-bottom: 1px solid transparent;
		transition: border-color 120ms ease;
	}
	.suggested-tab-link:hover,
	.suggested-tab-link:focus-visible {
		border-bottom-color: var(--accent-mint, #047857);
		outline: none;
	}

	/* Tabs panel inside the drawer. Repeats per-question header so the
	   reader keeps context between tabs. */
	.suggested-tabs-list {
		margin-bottom: 0.5rem;
	}
	.suggested-tab-panel {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding-top: 0.25rem;
	}
	.suggested-q {
		gap: 0.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(48, 47, 40, 0.12);
	}
	.suggested-q:first-child {
		border-top: 0;
		padding-top: 0;
	}
	.suggested-q-frame {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent-mint, #047857);
	}
	.suggested-q-label {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 1.05rem;
		font-weight: 500;
		line-height: 1.25;
		color: var(--ink, #312f28);
		margin: 0;
		text-wrap: balance;
	}
	.suggested-q-summary {
		font-family: var(--font-body, 'IBM Plex Sans', system-ui);
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--secondary-foreground, #312f28);
		margin: 0;
	}
	.suggested-q-sub {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted-foreground, #6b7280);
		margin: 0.5rem 0 0.1rem;
	}

	.drawer-list {
		margin: 0;
		padding-left: 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-family: var(--font-body, 'IBM Plex Sans', system-ui);
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--ink, #312f28);
	}

	.drawer-intervention-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.drawer-intervention {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.65rem 0.85rem;
		background: var(--lightgrayblue, rgba(48, 47, 40, 0.04));
		border-radius: 6px;
	}
	.drawer-intervention-head {
		display: flex;
		flex-direction: row;
		align-items: baseline;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.drawer-intervention-label {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 0.92rem;
		font-weight: 500;
		color: var(--ink, #312f28);
	}
	.drawer-intervention-frame {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent-mint, #047857);
	}
	.drawer-intervention-body {
		margin: 0;
		font-family: var(--font-body, 'IBM Plex Sans', system-ui);
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--ink, #312f28);
	}

	.drawer-body {
		padding: 1.5rem 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.drawer-head {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.drawer-eyebrow {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent-mint, #047857);
	}
	.drawer-section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.drawer-dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.4rem 1rem;
		font-size: 0.875rem;
		color: var(--ink, #312f28);
		margin: 0;
	}
	.drawer-dl dt {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted-foreground, #6b7280);
		align-self: center;
	}
	.sentiment-axis-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.sentiment-axis-row {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.9rem;
		align-items: start;
	}
	.sentiment-axis-meta {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		min-width: 0;
	}
	.sentiment-axis-meta h4 {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 0.95rem;
		font-weight: 500;
		margin: 0;
		color: var(--ink, #312f28);
	}
	.sentiment-axis-total {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted-foreground, #6b7280);
	}
	.sentiment-overall {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1rem;
	}
	.sentiment-legend {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin: 0;
		font-size: 0.85rem;
		color: var(--ink, #312f28);
	}
	.sentiment-legend-row {
		display: grid;
		grid-template-columns: 10px max-content 1fr;
		gap: 0.55rem;
		align-items: baseline;
	}
	.sentiment-swatch {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		align-self: center;
	}
	.sentiment-swatch-pos { background: #34d399; }
	.sentiment-swatch-neu { background: #cbd5e1; }
	.sentiment-swatch-neg { background: #fb7185; }
	.sentiment-legend dt {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted-foreground, #6b7280);
		margin: 0;
	}
	.sentiment-legend dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}
	.sentiment-legend-count {
		color: var(--muted-foreground, #6b7280);
	}
	.drawer-quote-stack {
		gap: 1.25rem;
	}
	.drawer-quote {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.75rem 0.9rem;
		border-left: 3px solid var(--accent-mint, #047857);
		background: rgba(48, 47, 40, 0.03);
		border-radius: 0 6px 6px 0;
	}
	.drawer-quote-rank {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--accent-mint, #047857);
	}
	.drawer-quote blockquote {
		font-family: var(--font-body, 'IBM Plex Sans', system-ui);
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--ink, #312f28);
		margin: 0;
	}
	.drawer-quote-meta {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--muted-foreground, #6b7280);
	}
</style>
