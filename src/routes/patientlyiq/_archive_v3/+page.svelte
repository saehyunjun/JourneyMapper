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
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
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
	import {
		buildRadialTree,
		quotes as allQuotes,
		type Quote,
		type RadialNode
	} from '$lib/content/wctglpdemo-data/analysis';
	import ParticipantDrawer from '$lib/components/ParticipantDrawer.svelte';
	import ExecutiveSummaryStory from '$lib/components/story/ExecutiveSummaryStory.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import InteractiveCorpusGrid, {
		type Dot as CorpusDot,
		type GroupSpec as CorpusGroupSpec
	} from '$lib/components/exec-summary/InteractiveCorpusGrid.svelte';
	import { vizSize } from '$lib/story/responsiveSize.svelte';
	import InsightOverview from '$lib/components/exec-summary/InsightOverview.svelte';
	import FindingDetail from '$lib/components/exec-summary/FindingDetail.svelte';
	import ThemeDetail from '$lib/components/exec-summary/ThemeDetail.svelte';
	import QuoteDetail from '$lib/components/exec-summary/QuoteDetail.svelte';
	import type { Selection } from '$lib/components/exec-summary/types';
	import type { StoryInput } from '$lib/story/types';
	import { computeBurdenDistribution } from '$lib/content/wctglpdemo-data/burden-distribution';
	import { getOverviewBlurb, getFindingBlurb } from '$lib/content/wctglpdemo-data/dashboard-blurbs';
	import { computeLupusNephritisAlignment } from '$lib/content/wctglpdemo-data/search-interview-alignment';
	import { computeLupusNephritisTopicAlignment } from '$lib/content/wctglpdemo-data/topic-alignment';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

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

	// Split a theme's mock blocks into N subtheme child buckets so the LN
	// placeholder has subtheme data to drive the InteractiveCorpusHero's
	// subtheme grouping. Blocks are partitioned round-robin so each subtheme
	// inherits a representative slice of the theme's sentiment mix.
	function mockSubtheme(
		themeId: string,
		subId: string,
		label: string,
		themeBlocks: { sentiment: number; interview_id: string }[],
		bucketIndex: number,
		bucketCount: number
	) {
		const slice = themeBlocks.filter((_, i) => i % bucketCount === bucketIndex);
		return { id: `${themeId}__${subId}`, label, kind: 'subtheme' as const, blocks: slice };
	}

	const LN_SUMMARY_TEXT =
		'Twenty-four lupus nephritis patients sat for in-depth interviews, producing 187 tagged quotes across eleven themes. Sentiment ran mixed: 41% of coded moments registered positive against 38% negative. Negative reactions clustered around immunosuppressive side effects and renal monitoring burden; warmest mentions were of disease remission and long-term renal protection.';

	const LN_STATS = [
		{ value: 24, label: 'interviews' },
		{ value: 187, label: 'tagged quotes' },
		{ value: 11, label: 'themes' },
		{ value: 33, label: 'subthemes' },
		{ value: 4, label: 'findings' }
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

	const LN_THEMES = (() => {
		const themeSpecs: { id: string; label: string; subs: string[]; blocks: { sentiment: number; interview_id: string }[] }[] = [
			{ id: 'disease_activity', label: 'Disease activity & flares', subs: ['Flares', 'Symptom load', 'Disease progression'], blocks: mockBlocks(8, 6, 14) },
			{ id: 'treatment', label: 'Treatment & medication', subs: ['Steroids', 'Immunosuppressants', 'Adherence'], blocks: mockBlocks(12, 8, 10) },
			{ id: 'side_effects', label: 'Side effects', subs: ['Fatigue', 'Infection risk', 'Weight changes'], blocks: mockBlocks(4, 7, 15) },
			{ id: 'renal_function', label: 'Renal function', subs: ['Lab results', 'Protein in urine', 'Kidney decline'], blocks: mockBlocks(6, 5, 11) },
			{ id: 'quality_of_life', label: 'Quality of life', subs: ['Energy', 'Work / school', 'Relationships'], blocks: mockBlocks(14, 9, 6) },
			{ id: 'clinical_trials', label: 'Clinical trials', subs: ['Awareness', 'Hesitation', 'Logistics'], blocks: mockBlocks(10, 12, 8) },
			{ id: 'monitoring', label: 'Disease monitoring', subs: ['Lab visits', 'Self-tracking', 'Appointment burden'], blocks: mockBlocks(7, 10, 9) },
			{ id: 'mental_health', label: 'Mental health & stress', subs: ['Anxiety', 'Depression', 'Coping'], blocks: mockBlocks(5, 8, 13) },
			{ id: 'social_life', label: 'Social & lifestyle impact', subs: ['Family', 'Diet', 'Activity'], blocks: mockBlocks(9, 11, 7) },
			{ id: 'support', label: 'Healthcare support', subs: ['Provider trust', 'Communication', 'Access'], blocks: mockBlocks(15, 6, 5) },
			{ id: 'future_outlook', label: 'Future outlook', subs: ['Hope', 'Treatment expectations', 'Long-term concerns'], blocks: mockBlocks(13, 7, 6) }
		];
		return themeSpecs.map((t) => ({
			id: t.id,
			label: t.label,
			blocks: t.blocks,
			children: t.subs.map((label, i) =>
				mockSubtheme(t.id, label.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label, t.blocks, i, t.subs.length)
			)
		}));
	})();

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

	// Subtheme count from the radial tree — sum of unique subtheme nodes across
	// all themes. Kept here so the headline stat stays a single source of truth.
	const realSubthemeCount = (() => {
		const ids = new Set<string>();
		for (const t of buildRadialTree()) {
			for (const c of t.children ?? []) {
				if (c.kind === 'subtheme') ids.add(c.id);
			}
		}
		return ids.size;
	})();

	const headlineStats = [
		{ value: summaryStats.interviews, label: 'interviews' },
		{ value: summaryStats.segments, label: 'tagged quotes' },
		{ value: summaryStats.themes, label: 'themes' },
		{ value: realSubthemeCount, label: 'subthemes' },
		{ value: findings.length, label: 'findings' }
	];

	// All themes with their per-segment sentiment blocks — for the theme breakdown strip.
	const themeBreakdown = buildRadialTree();

	// Display data — switches between real corpus and LN placeholder.
	const displaySummaryText = $derived(isLupusNephritis ? LN_SUMMARY_TEXT : summaryText);
	const displayStats = $derived(isLupusNephritis ? LN_STATS : headlineStats);
	const displaySentimentLean = $derived(isLupusNephritis ? LN_SENTIMENT_LEAN : sentimentLean);
	const displayThemeBreakdown = $derived(isLupusNephritis ? LN_THEMES : themeBreakdown);
	// Per-indication generated copy (Haiku 4.5). Layered over the template
	// strings — the components prefer these when present, fall back when not.
	const displayOverviewBlurb = $derived(getOverviewBlurb(activeIndication));
	const displayFindings = $derived(
		(isLupusNephritis ? LN_FINDINGS : findings).map((f) => {
			const blurb = getFindingBlurb(activeIndication, f.id);
			return blurb ? { ...f, lede: blurb.lede, analysis: blurb.analysis } : f;
		})
	);

	// --- Interactive corpus hero — flatten blocks into one dot per tagged
	//     moment, plus the theme + interview group specs the hero needs to
	//     render its regroup-by-axis modes.
	//
	//     We don't carry .starred on dots: the 'pull quotes' axis is currently
	//     unwired (blocks don't carry quote_id, so we can't map a block to its
	//     starred status without a heavier join). The InteractiveCorpusHero
	//     disables that stat-button when no dots are flagged.
	const corpusDots = $derived.by<CorpusDot[]>(() => {
		const out: CorpusDot[] = [];
		const themes = displayThemeBreakdown as Array<{
			id: string;
			blocks: { sentiment: number; interview_id?: string }[];
			children?: {
				id: string;
				kind?: string;
				blocks: { sentiment: number; interview_id?: string }[];
			}[];
		}>;

		// Build a global (sentiment, interview_id) → FIFO queue of finding_ids
		// from every finding's clusters. Each theme block (regardless of which
		// theme it came from) is matched against this queue and consumes one
		// finding tag if available; leftover blocks get `finding_id = undefined`
		// and fall into the '__unassigned_finding' group. Findings can cut
		// across themes, so the queue is corpus-wide (not per-theme like the
		// subtheme matcher below).
		const findingQueue = new Map<string, string[]>();
		for (const f of displayFindings) {
			for (const c of f.clusters) {
				for (const b of c.blocks) {
					const key = `${b.sentiment}|${b.interview_id ?? 'unknown'}`;
					const list = findingQueue.get(key) ?? [];
					list.push(f.id);
					findingQueue.set(key, list);
				}
			}
		}

		for (const t of themes) {
			// Build a (sentiment, interview_id) → FIFO queue of subtheme_ids
			// from this theme's children. Each theme block is matched against
			// the queue and consumes one subtheme tag if available; leftover
			// blocks (no matching child) get `subtheme_id = undefined` and fall
			// into the '__no_subtheme' group in subtheme mode.
			const subQueue = new Map<string, string[]>();
			for (const c of t.children ?? []) {
				if (c.kind !== 'subtheme') continue;
				for (const b of c.blocks) {
					const key = `${b.sentiment}|${b.interview_id ?? 'unknown'}`;
					const list = subQueue.get(key) ?? [];
					list.push(c.id);
					subQueue.set(key, list);
				}
			}
			for (let i = 0; i < t.blocks.length; i++) {
				const b = t.blocks[i];
				const iid = b.interview_id ?? 'unknown';
				const key = `${b.sentiment}|${iid}`;
				const subQ = subQueue.get(key);
				const subtheme_id = subQ && subQ.length ? subQ.shift() : undefined;
				const fQ = findingQueue.get(key);
				const finding_id = fQ && fQ.length ? fQ.shift() : undefined;
				out.push({
					id: `${t.id}__${iid}__${i}`,
					sentiment: b.sentiment,
					theme_id: t.id,
					interview_id: iid,
					subtheme_id,
					finding_id
				});
			}
		}
		return out;
	});

	const corpusThemeGroups = $derived<CorpusGroupSpec[]>(
		(displayThemeBreakdown as Array<{ id: string; label: string }>).map((t) => ({
			id: t.id,
			label: t.label
		}))
	);

	const corpusSubthemeGroups = $derived.by<CorpusGroupSpec[]>(() => {
		const out: CorpusGroupSpec[] = [];
		const seen = new Set<string>();
		const themes = displayThemeBreakdown as Array<{
			children?: { id: string; label?: string; kind?: string }[];
		}>;
		for (const t of themes) {
			for (const c of t.children ?? []) {
				if (c.kind !== 'subtheme' || seen.has(c.id)) continue;
				seen.add(c.id);
				out.push({ id: c.id, label: c.label ?? c.id });
			}
		}
		return out;
	});

	const corpusFindingGroups = $derived<CorpusGroupSpec[]>(
		displayFindings.map((f) => ({ id: f.id, label: f.eyebrow }))
	);

	const corpusInterviewGroups = $derived.by<CorpusGroupSpec[]>(() => {
		const seen = new Set<string>();
		const out: CorpusGroupSpec[] = [];
		for (const d of corpusDots) {
			const iid = d.interview_id ?? 'unknown';
			if (seen.has(iid)) continue;
			seen.add(iid);
			out.push({ id: iid, label: iid });
		}
		return out.sort((a, b) => a.id.localeCompare(b.id));
	});

	// --- Indication poster — generative SVG driven by corpus telemetry ------
	function hashSlug(s: string): number {
		let h = 2166136261 >>> 0;
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return h >>> 0;
	}

	const posterThemes = $derived(
		displayThemeBreakdown as Array<{
			id: string;
			label: string;
			blocks: { sentiment: number; interview_id?: string }[];
		}>
	);

	// Pick one best quote per interview — highest overall quote_score wins.
	// Used by IndicationPoster to show a key quote when the user hovers a dot.
	const bestQuoteByInterview = (() => {
		const map = new Map<string, (typeof allQuotes)[number]>();
		for (const q of allQuotes) {
			const cur = map.get(q.interview_id);
			if (!cur || q.quote_score.overall > cur.quote_score.overall) {
				map.set(q.interview_id, q);
			}
		}
		return map;
	})();

	const posterAnchors = $derived.by(() => {
		const seen = new Set<string>();
		const anchors: {
			id: string;
			quote?: string;
			sentiment?: number;
			themes?: string[];
			participant?: string;
		}[] = [];
		for (const t of posterThemes) {
			for (const b of t.blocks) {
				const id = b.interview_id;
				if (!id || seen.has(id)) continue;
				seen.add(id);
				const q = bestQuoteByInterview.get(id);
				anchors.push({
					id,
					quote: q?.text,
					sentiment: q?.sentiment,
					themes: q?.themes,
					participant: id
				});
				if (anchors.length >= 6) return anchors;
			}
		}
		return anchors;
	});

	const posterSeed = $derived(hashSlug(activeIndication));
	const posterVariant = $derived<'default' | 'cool'>(isLupusNephritis ? 'cool' : 'default');

	// --- Dashboard selection model -------------------------------------------
	// Single source of truth for what the right-pane detail view renders.
	// Resets to 'overview' whenever the active indication changes (the {#key}
	// block re-mounts the dashboard, which re-initialises this state).
	let selection = $state<Selection>({ kind: 'overview' });

	// --- Grid lens state -----------------------------------------------------
	// Drives the InteractiveCorpusGrid's grouping. Toggling the active tile
	// in the left rail returns the grid to the corpus-wide 'none' view.
	type Lens = 'none' | 'theme' | 'subtheme' | 'interview' | 'finding';
	let lens = $state<Lens>('none');

	// Dot size scales with viewport so the corpus reads as a dense field on
	// desktop without overflowing the center column on smaller screens.
	// Dots shrink when the grid breaks into per-group mini-grids — at 11
	// themes / 33 subthemes / 24 interviews the larger 'none'-mode cells
	// would crowd each mini-grid, so we step down ~35% across the board.
	// The grid component transitions width/height/transform together so the
	// resize reads as part of the regroup morph.
	const corpusCellSize = $derived(
		lens === 'none'
			? vizSize({ base: 13, md: 16, lg: 20, xl: 24, '2xl': 28 })
			: vizSize({ base: 9, md: 11, lg: 13, xl: 15, '2xl': 17 })
	);
	const corpusIntraGap = $derived(
		lens === 'none'
			? vizSize({ base: 4, md: 5, lg: 6, xl: 7, '2xl': 8 })
			: vizSize({ base: 3, md: 3, lg: 4, xl: 4, '2xl': 5 })
	);

	function toggleLens(next: Lens) {
		lens = lens === next ? 'none' : next;
	}

	function lensForLabel(label: string): Lens {
		const l = label.toLowerCase();
		if (l.includes('interview')) return 'interview';
		if (l.includes('subtheme')) return 'subtheme';
		if (l.includes('theme')) return 'theme';
		if (l.includes('finding')) return 'finding';
		return 'none';
	}

	// Subtheme → parent theme id, so clicking a subtheme cluster in the grid
	// can resolve to its parent theme's detail card (we don't have a dedicated
	// subtheme detail component).
	const subthemeParentByGid = $derived.by(() => {
		const map = new Map<string, string>();
		const themes = displayThemeBreakdown as Array<{
			id: string;
			children?: { id: string; kind?: string }[];
		}>;
		for (const t of themes) {
			for (const c of t.children ?? []) {
				if (c.kind !== 'subtheme') continue;
				map.set(c.id, t.id);
			}
		}
		return map;
	});

	// Shared dispatcher for any "navigate to X" click — grid label, blurb
	// inline ref, considerations callout. Keeps the ref-resolution rules
	// (subtheme → parent theme, interview → drawer) in one place.
	function navigateTo(kind: 'theme' | 'subtheme' | 'finding' | 'interview' | 'quote', id: string) {
		if (kind === 'theme') {
			selection = { kind: 'theme', id };
		} else if (kind === 'subtheme') {
			const parent = subthemeParentByGid.get(id);
			if (parent) selection = { kind: 'theme', id: parent };
		} else if (kind === 'finding') {
			if (id !== '__unassigned_finding') selection = { kind: 'finding', id };
		} else if (kind === 'interview') {
			openParticipant(id);
		} else if (kind === 'quote') {
			selection = { kind: 'quote', id };
		}
	}

	// Allow-list of valid ids per ref kind for the BlurbText renderer.
	// Refs to ids outside this set render as plain text (soft-fail) — Haiku
	// occasionally invents ids and we'd rather show the surface text than a
	// broken link.
	const knownRefs = $derived.by(() => {
		const themes = new Set<string>(
			(displayThemeBreakdown as Array<{ id: string }>).map((t) => t.id)
		);
		const subthemes = new Set<string>();
		for (const t of displayThemeBreakdown as Array<{ children?: { id: string; kind?: string }[] }>) {
			for (const c of t.children ?? []) {
				if (c.kind === 'subtheme') subthemes.add(c.id);
			}
		}
		const findings = new Set<string>(displayFindings.map((f) => f.id));
		const interviews = new Set<string>(corpusInterviewGroups.map((g) => g.id));
		return { theme: themes, subtheme: subthemes, finding: findings, interview: interviews };
	});

	function handleGroupClick(payload: { mode: string; id: string }) {
		const { mode, id } = payload;
		if (mode === 'theme' || mode === 'subtheme' || mode === 'finding' || mode === 'interview') {
			navigateTo(mode, id);
		}
	}

	const selectedFinding = $derived.by(() => {
		const sel = selection;
		if (sel.kind !== 'finding') return null;
		return displayFindings.find((f) => f.id === sel.id) ?? null;
	});

	const selectedTheme = $derived.by<RadialNode | null>(() => {
		const sel = selection;
		if (sel.kind !== 'theme') return null;
		return (displayThemeBreakdown as RadialNode[]).find((t) => t.id === sel.id) ?? null;
	});

	const selectedQuote = $derived.by<Quote | null>(() => {
		const sel = selection;
		if (sel.kind !== 'quote') return null;
		return allQuotes.find((q) => q.quote_id === sel.id) ?? null;
	});

	// Theme detail wants a small sample of the strongest quotes tagged with
	// the selected theme — sorted by overall quote_score so the highlights
	// surface first.
	const themeTopQuotes = $derived<Quote[]>(
		selectedTheme
			? allQuotes
				.filter((q) => q.themes.includes(selectedTheme!.id))
				.sort((a, b) => b.quote_score.overall - a.quote_score.overall)
				.slice(0, 8)
			: []
	);

	const explore = [
		{
			href: '/patientlyiq/personas',
			title: 'Participant persona',
			blurb: "Each interviewee's distinctive theme profile."
		},
		{
			href: '/patientlyiq/community',
			title: 'What patients said',
			blurb: 'Sortable word-usage and theme charts.'
		},
		{
			href: '/patientlyiq/journey',
			title: 'Trial journey',
			blurb: 'The interview recut as an awareness-to-participation arc.'
		}
	];

	// --- View mode (Dashboard / Story) ---------------------------------------
	// URL-driven so the choice survives refresh and can be shared. The topbar
	// toggle writes ?view=story; we read it here without touching the layout
	// loader (which only watches ?indication).
	const viewMode = $derived(page.url.searchParams.get('view') === 'story' ? 'story' : 'dashboard');

	function exitStory() {
		const url = new URL(page.url);
		url.searchParams.delete('view');
		goto(url, { keepFocus: true, noScroll: true });
	}

	// Bundle the data the StoryAssembler needs. Mirrors what the dashboard
	// view renders below — single source of truth for both. The real corpus
	// data from buildRadialTree carries sub-theme children; LN placeholder
	// themes don't, and the assembler skips the drivers zone when they're
	// missing.
	const storyInput = $derived<StoryInput>({
		title: `${activeConditionLabel} Patient Insights`,
		summaryText: displaySummaryText,
		stats: displayStats,
		sentimentLean: displaySentimentLean,
		themes: (displayThemeBreakdown as Array<{
			id: string;
			label: string;
			blocks: { sentiment: number }[];
			children?: { kind?: string; id: string; label: string; blocks: { sentiment: number }[] }[];
		}>).map((t) => ({
			id: t.id,
			label: t.label,
			blocks: t.blocks,
			subthemes: t.children
				?.filter((c) => c.kind === 'subtheme')
				.map((s) => ({ id: s.id, label: s.label, blocks: s.blocks }))
		})),
		findings: displayFindings,
		explore,
		profiles,
		posterSeed,
		posterVariant,
		posterAnchors,
		burdens: computeBurdenDistribution(activeIndication),
		// LN-only today: the search-side data files live under
		// disease-insights/lupus-nephritis/, and the interview cluster rollup
		// reads lupus_nephritis_keyword_usage.json. Pass undefined for other
		// indications so the assembler skips the two alignment slides.
		alignment: isLupusNephritis
			? {
				oneToOne: computeLupusNephritisAlignment(),
				topical: computeLupusNephritisTopicAlignment()
			}
			: undefined
	});
</script>

{#key activeIndication}
	{#if viewMode === 'story'}
		<div class="flex flex-1 flex-col" in:fade={{ duration: 300 }}>
			<ExecutiveSummaryStory input={storyInput} frameTitle="{activeConditionLabel} Patient Insights Lab Book" onExit={exitStory} />
		</div>
	{:else}
<div class="flex flex-1 flex-col" in:fade={{ duration: 300 }}>
	<PageHeader
		eyebrow="Executive summary"
		title="{activeConditionLabel} Patient Insights Lab Book"
	/>

	<!-- 3-column workspace — circle grid is the dashboard's main component.
		 Left rail: lens tiles (just wide enough for the buttons). Center: dot
		 grid, takes most of the remaining space. Right: findings dropdown +
		 detail card. The left rail + grid stay sticky under the topbar; the
		 right pane scrolls with the page so analysis can extend past the
		 viewport without losing the lens/grid context. Below md the layout
		 stacks (sticky disengages on flex-row alignment). -->
	<div class="dashboard-grid grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[9rem_minmax(0,1fr)_30rem] md:items-start md:gap-8 md:px-8 xl:grid-cols-[9rem_minmax(0,1fr)_34rem]">
		<!-- Left rail: stat tiles act as lens toggles. -->
		<aside class="sticky-col flex flex-row flex-wrap gap-2 md:flex-col md:gap-2">
			{#each displayStats as stat (stat.label)}
				{@const targetLens = lensForLabel(stat.label)}
				{@const active = targetLens !== 'none' && lens === targetLens}
				<button
					type="button"
					class="lens-tile"
					class:is-active={active}
					onclick={() => toggleLens(targetLens)}
					aria-pressed={active}
					title="Regroup by {stat.label}"
				>
					<span class="lens-tile-value font-heading tabular-nums">{stat.value}</span>
					<span class="lens-tile-label">{stat.label}</span>
				</button>
			{/each}

			<div class="legend mt-4 hidden md:flex">
				<div class="legend-bars">
					<span class="legend-bar" style="background: #e11d48;"></span>
					<span class="legend-bar" style="background: #fb7185;"></span>
					<span class="legend-bar" style="background: #cbd5e1;"></span>
					<span class="legend-bar" style="background: #34d399;"></span>
					<span class="legend-bar" style="background: #059669;"></span>
				</div>
				<div class="legend-text font-mono">
					<span><span class="text-rose-700">{displaySentimentLean.negPct}%</span> neg</span>
					<span><span class="text-slate-500">{displaySentimentLean.neutralPct}%</span> neu</span>
					<span><span class="text-emerald-700">{displaySentimentLean.posPct}%</span> pos</span>
				</div>
			</div>
		</aside>

		<!-- Center: the dot grid, hero of the dashboard. -->
		<section class="grid-region sticky-col">
			<InteractiveCorpusGrid
				dots={corpusDots}
				mode={lens === 'none' ? 'none' : lens}
				themeGroups={corpusThemeGroups}
				subthemeGroups={corpusSubthemeGroups}
				interviewGroups={corpusInterviewGroups}
				findingGroups={corpusFindingGroups}
				cellSize={corpusCellSize}
				intraGap={corpusIntraGap}
				onSelectGroup={handleGroupClick}
			/>
		</section>

		<!-- Right pane: findings dropdown + selected detail. -->
		<section class="right-pane flex flex-col gap-4">
			<label class="findings-picker">
				<span class="findings-picker-label font-mono">Jump to a finding</span>
				<select
					class="findings-picker-select"
					value={selection.kind === 'finding' ? selection.id : ''}
					onchange={(e) => {
						const id = (e.currentTarget as HTMLSelectElement).value;
						selection = id ? { kind: 'finding', id } : { kind: 'overview' };
					}}
				>
					<option value="">— Overview —</option>
					{#each displayFindings as f (f.id)}
						<option value={f.id}>{f.eyebrow}</option>
					{/each}
				</select>
			</label>

			<div class="detail-card">
				{#if selection.kind === 'overview'}
					<InsightOverview
						summaryText={displaySummaryText}
						overviewBlurb={displayOverviewBlurb}
						{explore}
						onref={navigateTo}
						{knownRefs}
					/>
				{:else if selectedFinding}
					{#key selectedFinding.id}
						<FindingDetail
							finding={selectedFinding}
							{profiles}
							onparticipant={openParticipant}
							onref={navigateTo}
							{knownRefs}
						/>
					{/key}
				{:else if selectedTheme}
					{#key selectedTheme.id}
						<ThemeDetail
							theme={selectedTheme}
							topQuotes={themeTopQuotes}
							{profiles}
							onparticipant={openParticipant}
						/>
					{/key}
				{:else if selectedQuote}
					{#key selectedQuote.quote_id}
						<QuoteDetail
							quote={selectedQuote}
							{profiles}
							onparticipant={openParticipant}
						/>
					{/key}
				{:else}
					<div class="flex h-full items-center justify-center p-12 text-sm text-muted-foreground">
						Selection no longer available. Pick a finding above or click a label in the grid.
					</div>
				{/if}
			</div>
		</section>
	</div>
</div>
	{/if}
{/key}

<!-- Participant details drawer -->
<ParticipantDrawer
	bind:open={participantDrawerOpen}
	interviewId={participantDrawerId}
	bind:profiles
/>

<style>
	.lens-tile {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.125rem;
		padding: 0.5rem 0.875rem;
		border-radius: 8px;
		border: 1px solid rgba(48, 47, 40, 0.12);
		background: transparent;
		color: var(--ink, #312f28);
		cursor: pointer;
		text-align: left;
		transition:
			border-color 160ms ease,
			background 160ms ease,
			color 160ms ease;
	}
	.lens-tile:hover {
		border-color: rgba(48, 47, 40, 0.4);
		background: rgba(48, 47, 40, 0.04);
	}
	.lens-tile.is-active {
		border-color: var(--ink, #312f28);
		background: var(--ink, #312f28);
		color: var(--paper, #f5f1ea);
	}
	.lens-tile-value {
		font-size: 1rem;
		font-weight: 500;
		line-height: 1.1;
	}
	.lens-tile-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		opacity: 0.7;
	}
	.lens-tile.is-active .lens-tile-label {
		opacity: 0.85;
	}

	.legend {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.375rem;
	}
	.legend-bars {
		display: inline-flex;
		gap: 2px;
		height: 6px;
		align-items: center;
	}
	.legend-bar {
		display: inline-block;
		width: 10px;
		height: 6px;
		border-radius: 999px;
	}
	.legend-text {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		font-size: 0.7rem;
		color: var(--muted-foreground, #64748b);
	}

	.grid-region {
		min-width: 0;
	}

	/* Sticky columns — the left rail and dot grid pin under the topbar while
	   the right pane (analysis) scrolls with the page. The 3.5rem offset
	   matches WctglpTopbar's min-height; max-height keeps tall sticky columns
	   from clipping out of view by allowing internal overflow. */
	@media (min-width: 768px) {
		.sticky-col {
			position: sticky;
			top: 3.5rem;
			align-self: start;
			max-height: calc(100vh - 3.5rem);
			overflow-y: auto;
		}
	}

	.findings-picker {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.findings-picker-label {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted-foreground, #64748b);
	}
	.findings-picker-select {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid rgba(48, 47, 40, 0.2);
		border-radius: 6px;
		background: var(--paper, #fff);
		color: var(--ink, #312f28);
		font-size: 0.875rem;
		font-family: inherit;
		cursor: pointer;
	}
	.findings-picker-select:focus-visible {
		outline: 2px solid rgba(48, 47, 40, 0.4);
		outline-offset: 2px;
	}

	.detail-card {
		border: 1px solid rgba(48, 47, 40, 0.1);
		border-radius: 10px;
		background: var(--paper, #fff);
		overflow: hidden;
	}
</style>
