<!--
	Executive summary — the GLP-1 Lab Book landing page.

	A programmatic read of the interview corpus: an opening paragraph and
	headline stats, the overall sentiment lean, and five cross-cutting findings
	(brightest / hardest moment, GLP-1 drugs vs. methods, most-discussed and
	most-divisive topic). Each card carries a donut of its positive/negative
	split and a supporting quote, and opens a drawer of the tagged quotes
	behind it. All copy is generated in
	$lib/content/wctglpdemo-data/executive-summary.ts from the pipeline outputs.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { MoveUpRight, Star, ArrowRight } from '@lucide/svelte';
	import {
		summaryStats,
		summaryText,
		sentimentLean,
		buildFindings,
		type Finding,
		type FindingTone,
		type Distribution,
		type ClusterBar
	} from '$lib/content/wctglpdemo-data/executive-summary';
	import { buildRadialTree } from '$lib/content/wctglpdemo-data/analysis';
	import KeyQuoteCard from '$lib/components/KeyQuoteCard.svelte';
	import ParticipantDrawer from '$lib/components/ParticipantDrawer.svelte';
	import SentimentDonut from '$lib/components/SentimentDonut.svelte';
	import BubbleChart from '$lib/components/BubbleChart.svelte';
	import StatBlock from '$lib/components/StatBlock.svelte';
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import CodedFragmentCard from '$lib/components/CodedFragmentCard.svelte';
	import SegmentTensionMatrix, {
		type SegmentTensionDatum
	} from '$lib/charts/glp/SegmentTensionMatrix.svelte';
	import SemiArcChart from '$lib/components/key-findings/blocks/SemiArcChart.svelte';
	import { sentimentColor } from '$lib/key-findings/widgets';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Per-finding wrapper width for the keyword-cluster BubbleChart so each
	// chart resizes to the card's actual content width.
	let clusterWidths = $state<Record<string, number>>({});

	// Participant profiles — seeded from the server, updated locally when the
	// drawer persists an edit.
	let profiles = $state(untrack(() => data.participantProfiles));

	// Hero condition label — driven by the indication dropdown in WctglpTopbar.
	// The layout server resolves the active id and ships the indications list, so
	// the page just looks up the matching label. Falls back to "GLP-1" so the
	// title still reads if the slice is missing for any reason.
	const activeConditionLabel = $derived(
		data.slice?.indications.find((i) => i.id === data.slice?.active_indication)?.label ?? 'GLP-1'
	);

	const activeIndication = $derived(data.slice?.active_indication ?? 'obesity');
	const isLupusNephritis = $derived(activeIndication === 'lupus_nephritis');

	// Findings, with each supporting quote resolved against the analyst's stars.
	const findings = buildFindings(untrack(() => data.starredQuoteIds));

	// --- Lupus nephritis placeholder data ------------------------------------
	// Placeholder numbers and copy for LN — no real transcript corpus yet.

	function mockBlocks(pos: number, neu: number, neg: number): { sentiment: number; interview_id: string }[] {
		return [
			...Array.from({ length: pos }, (_, i) => ({ sentiment: 1, interview_id: `LN${String(i + 1).padStart(2, '0')}` })),
			...Array.from({ length: neu }, (_, i) => ({ sentiment: 0, interview_id: `LN${String(i + 1).padStart(2, '0')}` })),
			...Array.from({ length: neg }, (_, i) => ({ sentiment: -1, interview_id: `LN${String(i + 1).padStart(2, '0')}` }))
		];
	}

	const LN_SUMMARY_TEXT =
		'Twenty-four lupus nephritis patients sat for in-depth interviews, producing 187 tagged quotes across eleven themes. Sentiment ran mixed: 41% of coded moments registered positive against 38% negative. Negative reactions clustered around immunosuppressive side effects and renal monitoring burden; warmest mentions were of disease remission and long-term renal protection.';

	const LN_STATS = [
		{ value: 24, label: 'interviews' },
		{ value: 187, label: 'tagged quotes' },
		{ value: 11, label: 'themes' },
		{ value: 43, label: 'pull quotes' }
	];

	const LN_SENTIMENT_LEAN = {
		lean: 'mixed' as 'positive' | 'negative' | 'mixed',
		positive: 77,
		negative: 71,
		neutral: 39,
		total: 187,
		posPct: 41,
		negPct: 38,
		neutralPct: 21
	};

	const LN_THEMES = [
		{ id: 'disease_activity', label: 'Disease activity & flares', blocks: mockBlocks(8, 6, 14) },
		{ id: 'treatment', label: 'Treatment & medication', blocks: mockBlocks(12, 8, 10) },
		{ id: 'side_effects', label: 'Side effects', blocks: mockBlocks(4, 7, 15) },
		{ id: 'renal_function', label: 'Renal function', blocks: mockBlocks(6, 5, 11) },
		{ id: 'quality_of_life', label: 'Quality of life', blocks: mockBlocks(14, 9, 6) },
		{ id: 'clinical_trials', label: 'Clinical trials', blocks: mockBlocks(10, 12, 8) },
		{ id: 'monitoring', label: 'Disease monitoring', blocks: mockBlocks(7, 10, 9) },
		{ id: 'mental_health', label: 'Mental health & stress', blocks: mockBlocks(5, 8, 13) },
		{ id: 'social_life', label: 'Social & lifestyle impact', blocks: mockBlocks(9, 11, 7) },
		{ id: 'support', label: 'Healthcare support', blocks: mockBlocks(15, 6, 5) },
		{ id: 'future_outlook', label: 'Future outlook', blocks: mockBlocks(13, 7, 6) }
	];

	const LN_FINDINGS: Finding[] = [
		{
			id: 'negative-treatment',
			tone: 'negative' as FindingTone,
			eyebrow: 'Drivers of negative treatment sentiment',
			stat: { value: '28', caption: 'negative mentions · 61 segments' },
			headline:
				'Immunosuppressive side effects, steroid dependency, and infection risk drove the loudest negative reactions to treatment.',
			detail:
				'Across the 4 keyword clusters surfacing most in negative treatment talk, 28 of the underlying 61 segments came back negative.',
			clusters: [
				{ id: 'ln-side-effects', label: 'Side effects (immunosuppressive)', count: 21, positive: 3, neutral: 6, negative: 12, blocks: mockBlocks(3, 6, 12) } as ClusterBar,
				{ id: 'ln-steroids', label: 'Steroid dependency', count: 18, positive: 2, neutral: 5, negative: 11, blocks: mockBlocks(2, 5, 11) } as ClusterBar,
				{ id: 'ln-infection', label: 'Infection risk', count: 15, positive: 4, neutral: 4, negative: 7, blocks: mockBlocks(4, 4, 7) } as ClusterBar,
				{ id: 'ln-fatigue', label: 'Fatigue & energy loss', count: 19, positive: 5, neutral: 6, negative: 8, blocks: mockBlocks(5, 6, 8) } as ClusterBar
			],
			distribution: { positive: 16, neutral: 17, negative: 28 } as Distribution,
			quote: null,
			fragments: []
		},
		{
			id: 'negative-trial',
			tone: 'negative' as FindingTone,
			eyebrow: 'Drivers of negative trial sentiment',
			stat: { value: '19', caption: 'negative mentions · 42 segments' },
			headline:
				'Flare risk during washout, visit burden, and travel distance drove the strongest negative trial reactions.',
			detail:
				'Across the 3 keyword clusters surfacing most in negative trial talk, 19 of the underlying 42 segments came back negative.',
			clusters: [
				{ id: 'ln-washout', label: 'Washout / flare risk', count: 14, positive: 2, neutral: 4, negative: 8, blocks: mockBlocks(2, 4, 8) } as ClusterBar,
				{ id: 'ln-visit-burden', label: 'Visit frequency & burden', count: 16, positive: 4, neutral: 5, negative: 7, blocks: mockBlocks(4, 5, 7) } as ClusterBar,
				{ id: 'ln-travel', label: 'Travel distance', count: 12, positive: 3, neutral: 5, negative: 4, blocks: mockBlocks(3, 5, 4) } as ClusterBar
			],
			distribution: { positive: 11, neutral: 12, negative: 19 } as Distribution,
			quote: null,
			fragments: []
		},
		{
			id: 'positive-treatment',
			tone: 'positive' as FindingTone,
			eyebrow: 'Drivers of positive treatment sentiment',
			stat: { value: '32', caption: 'positive mentions · 67 segments' },
			headline:
				'Disease remission, renal function preservation, and reduced flare frequency drew the warmest reactions to treatment.',
			detail:
				'Across the 3 keyword clusters surfacing most in positive treatment talk, 32 of the underlying 67 segments came back positive.',
			clusters: [
				{ id: 'ln-remission', label: 'Remission & disease control', count: 22, positive: 14, neutral: 5, negative: 3, blocks: mockBlocks(14, 5, 3) } as ClusterBar,
				{ id: 'ln-renal', label: 'Renal function preservation', count: 18, positive: 11, neutral: 5, negative: 2, blocks: mockBlocks(11, 5, 2) } as ClusterBar,
				{ id: 'ln-flare-reduction', label: 'Reduced flare frequency', count: 16, positive: 9, neutral: 5, negative: 2, blocks: mockBlocks(9, 5, 2) } as ClusterBar
			],
			distribution: { positive: 32, neutral: 21, negative: 14 } as Distribution,
			quote: null,
			fragments: []
		},
		{
			id: 'trial-non-barriers',
			tone: 'neutral' as FindingTone,
			eyebrow: 'Non-issues for trial participation',
			stat: { value: '4', caption: "expected barriers that didn't drive negative sentiment" },
			headline:
				'Genetic testing requirements, imaging visits, questionnaire burden, and sample collection were not viewed as major barriers.',
			detail:
				"Of the 7 trial-barrier topics raised in interviews, 4 didn't skew negative — 28 of the 52 mentions were positive against just 14 negative.",
			clusters: [
				{ id: 'ln-genetic', label: 'Genetic / biomarker testing', count: 14, positive: 8, neutral: 3, negative: 3, blocks: mockBlocks(8, 3, 3) } as ClusterBar,
				{ id: 'ln-imaging', label: 'Imaging visits', count: 12, positive: 7, neutral: 4, negative: 1, blocks: mockBlocks(7, 4, 1) } as ClusterBar,
				{ id: 'ln-questionnaire', label: 'Questionnaire burden', count: 11, positive: 6, neutral: 4, negative: 1, blocks: mockBlocks(6, 4, 1) } as ClusterBar,
				{ id: 'ln-samples', label: 'Blood / urine samples', count: 10, positive: 5, neutral: 4, negative: 1, blocks: mockBlocks(5, 4, 1) } as ClusterBar
			],
			distribution: { positive: 28, neutral: 10, negative: 14 } as Distribution,
			quote: null,
			fragments: []
		}
	];

	// --- Participant details drawer ---
	let participantDrawerOpen = $state(false);
	let participantDrawerId = $state<string | null>(null);

	function openParticipant(id: string) {
		participantDrawerId = id;
		participantDrawerOpen = true;
	}

	// --- Finding drawer — the tagged quotes behind one finding ---
	let findingDrawerOpen = $state(false);
	let activeFinding = $state<Finding | null>(null);

	function openFinding(f: Finding) {
		activeFinding = f;
		findingDrawerOpen = true;
	}

	const headlineStats = [
		{ value: summaryStats.interviews, label: 'interviews' },
		{ value: summaryStats.segments, label: 'tagged quotes' },
		{ value: summaryStats.themes, label: 'themes' },
		{ value: summaryStats.quotes, label: 'pull quotes' }
	];

	// All themes with their per-segment sentiment blocks — for the theme breakdown strip.
	const themeBreakdown = buildRadialTree();

	// Display data — switches between real corpus and LN placeholder.
	const displaySummaryText = $derived(isLupusNephritis ? LN_SUMMARY_TEXT : summaryText);
	const displayStats = $derived(isLupusNephritis ? LN_STATS : headlineStats);
	const displaySentimentLean = $derived(isLupusNephritis ? LN_SENTIMENT_LEAN : sentimentLean);
	const displayThemeBreakdown = $derived(isLupusNephritis ? LN_THEMES : themeBreakdown);
	const displayFindings = $derived(isLupusNephritis ? LN_FINDINGS : findings);

	// Convert theme blocks into SegmentTensionDatum for the matrix viz.
	// Both RadialNode[] and LN_THEMES share id, label, blocks[{sentiment}].
	const displayTensionData = $derived(
		(displayThemeBreakdown as Array<{ id: string; label: string; blocks: { sentiment: number }[] }>).map(
			(t): SegmentTensionDatum => ({
				id: t.id,
				label: t.label,
				total: t.blocks.length,
				positive: t.blocks.filter((b) => b.sentiment > 0).length,
				neutral:  t.blocks.filter((b) => b.sentiment === 0).length,
				negative: t.blocks.filter((b) => b.sentiment < 0).length
			})
		)
	);

	const SENTIMENT_GRADES = [
		{ value: -2, label: 'Strongly negative' },
		{ value: -1, label: 'Negative' },
		{ value:  0, label: 'Neutral / mixed' },
		{ value:  1, label: 'Positive' },
		{ value:  2, label: 'Strongly positive' }
	] as const;

	const themeCharts = $derived(
		(displayThemeBreakdown as Array<{ id: string; label: string; blocks: { sentiment: number }[] }>).map(
			(t) => ({
				label: t.label,
				data: SENTIMENT_GRADES.map((s) => ({
					label: s.label,
					value: t.blocks.filter((b) => b.sentiment === s.value).length,
					color: sentimentColor(s.value)
				}))
			})
		)
	);

	let themeReplayKey = $state(0);

	// Per-tone styling for the finding cards.
	const tone: Record<Finding['tone'], { accent: string }> = {
		positive: { accent: 'text-emerald-700' },
		negative: { accent: 'text-rose-700' },
		divisive: { accent: 'text-amber-700' },
		neutral: { accent: 'text-accent-mint' }
	};

	const LN_TENSION_DATA: SegmentTensionDatum[] = [
		{ id: 'immunosuppressive_side_effects', label: 'Immunosuppressive side effects', group: 'Treatment & medication', total: 21, positive: 2, neutral: 4, negative: 15 },
		{ id: 'steroid_dependency',             label: 'Steroid dependency',             group: 'Treatment & medication', total: 18, positive: 1, neutral: 5, negative: 12 },
		{ id: 'infection_risk',                 label: 'Infection risk',                 group: 'Treatment & medication', total: 15, positive: 1, neutral: 4, negative: 10 },
		{ id: 'remission_control',              label: 'Remission & disease control',    group: 'Positive treatment drivers', total: 22, positive: 16, neutral: 4, negative: 2 },
		{ id: 'renal_function_preservation',    label: 'Renal function preservation',    group: 'Positive treatment drivers', total: 18, positive: 12, neutral: 4, negative: 2 },
		{ id: 'washout_flare_risk',             label: 'Washout / flare risk',           group: 'Clinical trials',            total: 14, positive: 1,  neutral: 3, negative: 10 },
		{ id: 'visit_burden',                   label: 'Visit frequency & burden',       group: 'Clinical trials',            total: 16, positive: 2,  neutral: 5, negative: 9 },
		{ id: 'questionnaire_burden',           label: 'Questionnaire burden',           group: 'Trial non-issues',           total: 11, positive: 6,  neutral: 3, negative: 2 }
	];

	let tensionReplayKey = $state(0);

	const explore = [
		{
			href: '/patientlyiq/fingerprint',
			title: 'Participant fingerprint',
			blurb: "Each interviewee's distinctive theme profile."
		},
		{
			href: '/patientlyiq/interview-words',
			title: 'What patients said',
			blurb: 'Sortable word-usage and theme charts.'
		},
		{
			href: '/patientlyiq/journey',
			title: 'Trial journey',
			blurb: 'The interview recut as an awareness-to-participation arc.'
		}
	];
</script>

{#key activeIndication}
<div class="flex flex-1 flex-col gap-6" in:fade={{ duration: 300 }}>
	<div
		class="mx-auto flex w-full flex-col justify-center bg-muted bg-[url('/content-assets/bgtexture.png')] bg-center align-middle bg-blend-lighten"
	>
		<div class="flex w-full flex-col gap-2">
			<span class="pill-white mx-auto text-base">
				Executive summary</span>
			<p
				class="mx-auto justify-center text-pretty text-center text-2xl leading-8 text-primary md:w-5xl md:text-4xl md:font-light md:leading-10"
			>
				<span class="font-bold font-heading border-b-2 border-accent-orange text-primary">{activeConditionLabel}</span> Patient Insights Lab Book
			</p>
		</div>
	</div>

	<div class="mx-auto flex w-full max-w-6xl flex-col gap-14 px-8 pt-8 pb-16">
		<!-- Opening read — programmatic paragraph, headline stats, sentiment lean. -->
		<section class="flex flex-col gap-8">
			<div class="flex flex-col gap-4">
				<h2 class="text-sm font-medium uppercase font-heading text-accent-mint">
					Summary View
				</h2>
				<p class="md:max-w-4xl lg:max-w-5xl text-pretty text-lg leading-normal text-secondary-foreground">
					{displaySummaryText}
				</p>
			</div>

			<div class="grid grid-cols-2 gap-px overflow-hidden border bg-slate-200 md:grid-cols-4">
				{#each displayStats as stat (stat.label)}
					<StatBlock value={stat.value} label={stat.label} />
				{/each}
			</div>

			<!-- Overall sentiment lean across every tagged quote. -->
			<div class="flex flex-col gap-3">
				<div class="flex items-baseline justify-between">
					<h3 class="text-sm font-medium uppercase tracking-wide text-slate-500">
						Sentiment across {displaySentimentLean.total} tagged quotes
					</h3>
					<span class="text-sm text-slate-500">
						Leans <span class="font-medium text-secondary-foreground">{displaySentimentLean.lean}</span>
					</span>
				</div>

				<div class="flex h-3 w-full overflow-hidden rounded-full">
					<div class="bg-emerald-400" style="width: {displaySentimentLean.posPct}%"></div>
					<div class="bg-slate-200" style="width: {displaySentimentLean.neutralPct}%"></div>
					<div class="bg-rose-400" style="width: {displaySentimentLean.negPct}%"></div>
				</div>
				<div class="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
					<span class="flex items-center gap-1.5">
						<span class="size-2.5 rounded-full bg-emerald-400"></span>
						Positive — {displaySentimentLean.positive} ({displaySentimentLean.posPct}%)
					</span>
					<span class="flex items-center gap-1.5">
						<span class="size-2.5 rounded-full bg-slate-200"></span>
						Neutral / mixed — {displaySentimentLean.neutral} ({displaySentimentLean.neutralPct}%)
					</span>
					<span class="flex items-center gap-1.5">
						<span class="size-2.5 rounded-full bg-rose-400"></span>
						Negative — {displaySentimentLean.negative} ({displaySentimentLean.negPct}%)
					</span>
				</div>
			</div>
		</section>

		<!-- Theme breakdown — segment tension matrix, one glyph per theme. -->
		{#if displayTensionData.length}
			<section class="flex flex-col gap-4">
				<div class="flex items-baseline justify-between gap-4">
					<div class="flex flex-col gap-1">
						<h2 class="text-2xl font-medium uppercase tracking-wide text-accent-mint">
							By theme
						</h2>
						<p class="text-sm text-muted-foreground">
							Segment volume and sentiment balance across {displayTensionData.length} coded themes.
						</p>
					</div>
					<button
						class="font-mono text-xs text-muted-foreground underline-offset-2 hover:underline"
						onclick={() => themeReplayKey++}
					>
						Replay
					</button>
				</div>
				<div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
					{#each themeCharts as theme (theme.label)}
						<div class="flex flex-col items-center gap-1">
							<p class="text-sm font-medium text-slate-700">{theme.label}</p>
							<SemiArcChart data={theme.data} animate replayKey={themeReplayKey} size={240} />
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Key findings — cluster-driven cards, each opening a segment drawer. -->
		<section class="flex flex-col gap-5">
			<div class="flex flex-col gap-1">
				<h2 class="text-2xl font-medium uppercase tracking-wide text-accent-mint">
					Key findings</h2>
				<p class="text-sm text-muted-foreground">
					The keyword clusters that drove the interviews' sharpest reactions.
				</p>
			</div>

			<div class="grid gap-4 md:grid-cols-2">
				{#each displayFindings as f (f.id)}
					{@const t = tone[f.tone]}
					<div
						role="button"
						tabindex="0"
						onclick={() => openFinding(f)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								openFinding(f);
							}
						}}
						class="group hover:cursor-pointer flex cursor-pointer flex-col gap-4 border border-slate-200 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-accent-mint hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-mint"
					>
						<div class="flex items-start justify-between gap-4">
							<div class="flex flex-col gap-2">
								<span class="text-xs font-semibold uppercase tracking-wide {t.accent}">
									{f.eyebrow}
								</span>
								<h3 class="text-lg font-medium text-slate-800">{f.headline}</h3>
							</div>
							<SentimentDonut
								positive={f.distribution.positive}
								neutral={f.distribution.neutral}
								negative={f.distribution.negative}
							/>
						</div>

						<p class="text-sm leading-6 text-slate-600">{f.detail}</p>
						<p class="text-xs text-muted-foreground">
							<span class="text-sm font-medium {t.accent}">{f.stat.value}</span>
							· {f.stat.caption}
						</p>

						{#if f.clusters.length}
							<div class="flex flex-col gap-2.5 border-t border-muted pt-4">
								<span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
									Keyword clusters · bubble size = tagged quote count
								</span>
								<div class="exec-bubble-wrap" bind:clientWidth={clusterWidths[f.id]}>
									{#if clusterWidths[f.id]}
										<BubbleChart
											items={f.clusters.map((c) => c.label)}
											values={f.clusters.map((c) => c.count)}
											context="card"
											units=""
											width={Math.max(260, clusterWidths[f.id])}
											height={220}
											allowUserOverride={false}
										/>
									{/if}
								</div>
							</div>
						{/if}

						{#if f.quote}
							<div class="flex flex-col gap-2 border-t border-muted pt-4">
								<KeyQuoteCard
									text={f.quote.text}
									sentiment={f.quote.sentiment}
									interviewId={f.quote.interview_id}
									questionId={f.quote.question_id}
									{profiles}
									onparticipant={openParticipant}
									size="sm"
								/>
								{#if f.quote.isStarred}
									<span
										class="flex items-center gap-1 self-center text-xs text-amber-600"
										title="Analyst-starred highlight"
									>
										<Star class="size-3.5 fill-amber-400 text-amber-400" />
										Starred
									</span>
								{/if}
							</div>
						{/if}

						{#if f.fragments.length > 0}
							<span
								class="mt-auto flex items-center gap-1 pt-1 text-sm font-medium {t.accent}"
							>
								View {f.fragments.length} tagged quotes
								<ArrowRight
									class="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
								/>
							</span>
						{:else}
							<span class="mt-auto pt-1 text-xs text-muted-foreground">Placeholder data</span>
						{/if}
					</div>
				{/each}
			</div>
		</section>

		<!-- Sentiment tension matrix — lupus nephritis keyword clusters -->
		{#if isLupusNephritis}
			<section class="flex flex-col gap-4">
				<div class="flex items-baseline justify-between gap-4">
					<h2 class="text-2xl font-medium font-heading text-accent-mint">
						Sentiment tension by keyword cluster
					</h2>
					<button
						class="font-mono text-xs text-muted-foreground underline-offset-2 hover:underline"
						onclick={() => tensionReplayKey++}
					>
						Replay
					</button>
				</div>
				<p class="max-w-2xl text-sm text-muted-foreground">
					Each glyph represents a keyword cluster. Left bar height = tagged quote volume.
					Diagonal slope direction = sentiment balance. Color = sentiment class.
				</p>
				<SegmentTensionMatrix
					data={LN_TENSION_DATA}
					groupBy="group"
					sortBy="total"
					motionMode="story"
					replayKey={tensionReplayKey}
				/>
			</section>
		{/if}

		<!-- Onward — the read-only views over the same dataset. -->
		<section class="flex flex-col gap-4">
			<h2 class="text-2xl font-medium uppercase tracking-wide text-accent-mint">Go deeper</h2>
			<div class="grid gap-4 md:grid-cols-3">
				{#each explore as out (out.href)}
					<a
						href={out.href}
						class="flex flex-col gap-2 border p-6 duration-300 ease-in-out hover:-translate-y-2 hover:text-muted-foreground"
					>
						<div class="flex flex-row items-start justify-between gap-3">
							<h3 class="text-lg font-medium uppercase tracking-tight text-accent-mint">
								{out.title}
							</h3>
							<MoveUpRight class="size-5 shrink-0 text-accent-mint" />
						</div>
						<p class="text-sm">{out.blurb}</p>
					</a>
				{/each}
			</div>
		</section>
	</div>
</div>
{/key}

<!-- Participant details drawer -->
<ParticipantDrawer
	bind:open={participantDrawerOpen}
	interviewId={participantDrawerId}
	bind:profiles
/>

<!-- Finding drawer — the tagged quotes behind the selected finding -->
<RightDrawer bind:open={findingDrawerOpen}>
	{#if activeFinding}
		<div class="flex h-full flex-col">
			<div class="flex flex-col gap-1 border-b border-slate-200 p-6">
				<span class="figcaption text-accent-mint">{activeFinding.eyebrow}</span>
				<h2 class="font-heading text-2xl font-light text-primary">{activeFinding.headline}</h2>
				<p class="text-sm text-muted-foreground">
					{activeFinding.detail}
				</p>
				<p class="pt-1 text-xs uppercase tracking-wide text-muted-foreground">
					{activeFinding.fragments.length} tagged quotes
				</p>
			</div>

			<div class="flex flex-1 flex-col gap-3 overflow-y-auto p-6">
				{#each activeFinding.fragments as f (f.segment_id)}
					<CodedFragmentCard fragment={f} {profiles} />
				{:else}
					<p
						class="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500"
					>
						No tagged quotes behind this finding.
					</p>
				{/each}
			</div>
		</div>
	{/if}
</RightDrawer>
