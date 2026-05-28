/**
 * topic-alignment.ts
 *
 * Categorical version of the search-vs-interview alignment. Where
 * search-interview-alignment.ts does 1:1 treatment-name matching, this
 * rollup answers a broader question — "across the topic categories patients
 * care about, where does the search demand line up with what they talk
 * about in interviews?"
 *
 * The canonical category set is curated for editorial use: treatments /
 * clinical trials / symptoms & disease activity / quality of life /
 * diagnostics & monitoring / side effects & safety / comorbidities &
 * complications. The same set is used on both sides so each row of the viz
 * compares apples to apples.
 *
 * Search side: pulls every per-category search file from
 * disease-insights/lupus-nephritis/search/, sums volume by topic_category.
 * Files contributing to the rollup must declare their `topic_category`
 * field (added in this expansion). Files without one are skipped.
 *
 * Interview side: rolls every cluster in lupus_nephritis_keyword_usage.json
 * up to a canonical category via INTERVIEW_CATEGORY_MAP (cluster category id
 * → canonical category id). Clusters with no mapping are dropped — they
 * shouldn't pollute the rollup just because they exist.
 *
 * Both sides may be empty for a given canonical category — that's the
 * "scope gap" the viz surfaces (e.g. clinical trials had no LN interview
 * data in the demo set).
 */
import interviewUsage from './lupus_nephritis_keyword_usage.json';
import placeholderQuotes from './lupus_nephritis_placeholder_quotes.json';

import treatmentSearches from '$lib/content/disease-insights/lupus-nephritis/search/treatment_searches_us.json';
import symptomsSearches from '$lib/content/disease-insights/lupus-nephritis/search/symptoms_searches_us.json';
import qualityOfLifeSearches from '$lib/content/disease-insights/lupus-nephritis/search/quality_of_life_searches_us.json';
import diagnosticsSearches from '$lib/content/disease-insights/lupus-nephritis/search/diagnostics_monitoring_searches_us.json';
import sideEffectsSearches from '$lib/content/disease-insights/lupus-nephritis/search/side_effects_searches_us.json';
import comorbiditiesSearches from '$lib/content/disease-insights/lupus-nephritis/search/comorbidities_searches_us.json';
import clinicalTrialsSearches from '$lib/content/disease-insights/lupus-nephritis/search/clinical_trials_searches_us.json';

export type TopicCategoryId =
	| 'treatments'
	| 'clinical_trials'
	| 'symptoms'
	| 'quality_of_life'
	| 'diagnostics_monitoring'
	| 'side_effects_safety'
	| 'comorbidities_complications';

export type TopicCategory = {
	id: TopicCategoryId;
	label: string;
	blurb: string;
};

/**
 * Editorial order — sets the row order in the viz top-to-bottom. Picked so
 * the read flows from "what the disease is" (symptoms / monitoring) →
 * "what people take" (treatments / side effects) → "what they live with"
 * (quality of life / comorbidities) → "what comes next" (trials).
 */
export const TOPIC_CATEGORIES: TopicCategory[] = [
	{
		id: 'symptoms',
		label: 'Symptoms & disease activity',
		blurb: 'Symptoms, flares, disease-presentation searches and talk.'
	},
	{
		id: 'diagnostics_monitoring',
		label: 'Diagnostics & monitoring',
		blurb: 'Lab values, biopsy, tests — how the disease is tracked.'
	},
	{
		id: 'treatments',
		label: 'Treatments',
		blurb: 'Drug names, regimens, modalities.'
	},
	{
		id: 'side_effects_safety',
		label: 'Side effects & safety',
		blurb: 'Adverse effects, infection risk, treatment burden.'
	},
	{
		id: 'quality_of_life',
		label: 'Quality of life',
		blurb: 'Daily life, prognosis, work / family / future.'
	},
	{
		id: 'comorbidities_complications',
		label: 'Comorbidities & complications',
		blurb: 'Kidney failure, dialysis, transplant, downstream conditions.'
	},
	{
		id: 'clinical_trials',
		label: 'Clinical trials',
		blurb: 'Trial awareness, site-finding, modality curiosity.'
	}
];

/** Map from the cluster-category id used in lupus_nephritis_keyword_usage.json
 *  to the canonical TopicCategoryId. Clusters in categories not listed here
 *  drop out of the rollup (e.g. treatment_decision_factors doesn't have a
 *  search counterpart in the current dataset). */
const INTERVIEW_CATEGORY_MAP: Record<string, TopicCategoryId> = {
	treatment_health_history: 'treatments',
	symptoms: 'symptoms',
	comorbidities: 'comorbidities_complications',
	condition_knowledge_gaps: 'diagnostics_monitoring',
	treatment_positive_experiences: 'quality_of_life',
	treatment_negative_experiences: 'side_effects_safety'
	// treatment_decision_factors: intentionally unmapped — no search counterpart yet
};

// --- Types for the inputs ---------------------------------------------------

type SearchFile = {
	id: string;
	title: string;
	topic_category?: string;
	data: { topic: string; volume: number }[];
};

type UsageKeyword = {
	id: string;
	label: string;
	parent_theme: string;
	parent_subtheme: string;
	count: number;
};
type UsageCategory = { id: string; label: string; keywords: UsageKeyword[] };
type UsageFile = { categories: UsageCategory[] };

const SEARCH_FILES: SearchFile[] = [
	treatmentSearches as SearchFile,
	symptomsSearches as SearchFile,
	qualityOfLifeSearches as SearchFile,
	diagnosticsSearches as SearchFile,
	sideEffectsSearches as SearchFile,
	comorbiditiesSearches as SearchFile,
	clinicalTrialsSearches as SearchFile
];

// --- Public types -----------------------------------------------------------

export type TopicRow = {
	category: TopicCategory;
	searchVolume: number;
	searchQueries: number;
	interviewMentions: number;
	interviewClusters: number;
	/** Top contributing search query (highest single-volume) — for the row hover. */
	topSearch?: { query: string; volume: number };
	/** Top contributing interview cluster (highest single-count) — for the row hover. */
	topCluster?: { label: string; count: number };
};

export type TopicAlignment = {
	rows: TopicRow[];
	totals: {
		searchVolume: number;
		interviewMentions: number;
		categoriesWithBoth: number;
		categoriesWithSearchOnly: number;
		categoriesWithInterviewOnly: number;
	};
};

// --- Builder ----------------------------------------------------------------

const usage = interviewUsage as UsageFile;

function aggregateSearchByCategory(): Map<
	TopicCategoryId,
	{ volume: number; queryCount: number; topQuery?: { query: string; volume: number } }
> {
	const out = new Map<
		TopicCategoryId,
		{ volume: number; queryCount: number; topQuery?: { query: string; volume: number } }
	>();
	for (const file of SEARCH_FILES) {
		const cat = file.topic_category as TopicCategoryId | undefined;
		if (!cat) continue;
		const entry = out.get(cat) ?? { volume: 0, queryCount: 0 };
		for (const row of file.data) {
			entry.volume += row.volume;
			entry.queryCount += 1;
			if (!entry.topQuery || row.volume > entry.topQuery.volume) {
				entry.topQuery = { query: row.topic, volume: row.volume };
			}
		}
		out.set(cat, entry);
	}
	return out;
}

function aggregateInterviewByCategory(): Map<
	TopicCategoryId,
	{ mentions: number; clusterCount: number; topCluster?: { label: string; count: number } }
> {
	const out = new Map<
		TopicCategoryId,
		{ mentions: number; clusterCount: number; topCluster?: { label: string; count: number } }
	>();
	for (const cat of usage.categories) {
		const canonical = INTERVIEW_CATEGORY_MAP[cat.id];
		if (!canonical) continue;
		const entry = out.get(canonical) ?? { mentions: 0, clusterCount: 0 };
		for (const k of cat.keywords) {
			if (!k.count) continue;
			entry.mentions += k.count;
			entry.clusterCount += 1;
			if (!entry.topCluster || k.count > entry.topCluster.count) {
				entry.topCluster = { label: k.label, count: k.count };
			}
		}
		out.set(canonical, entry);
	}
	return out;
}

// --- Per-row narrative (data-driven; no LLM, no quote bank yet) -------------
//
// The slide's right-hand pane is row-reactive: hovering or focusing a row
// updates the headline + body to that row's specific story. These functions
// keep the per-category framing in one place (instead of duplicating the
// branch logic in every slide that consumes the data).
//
// Each branch reads from the live TopicRow numbers so the narrative is
// driven by the same data the bars show — no risk of headline numbers
// drifting from the chart. Quote-bank integration is a future hook (LN
// has no real interview corpus today; matches[] is intentionally empty
// across all clusters in the demo file).

export type RowNarrative = {
	/** Title-case-y short headline. */
	headline: string;
	/** 1–2 sentence body — leads with the magnitude, ends with the read. */
	body: string;
	/** Optional pull quote for indications with a real quote bank. */
	quote?: { text: string; attribution?: string };
};

function fmtVol(v: number): string {
	if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
	return String(v);
}

/** Placeholder demo quotes keyed by category. Replace the underlying JSON
 *  file once a real LN transcript corpus exists — the consumer here looks up
 *  by category_id, so the shape only needs to be preserved. Returns null
 *  when no quote is registered for the category (slide skips the block). */
type PlaceholderQuoteRow = { category_id: string; text: string; participant_id: string };
type PlaceholderQuoteFile = { meta: unknown; quotes: PlaceholderQuoteRow[] };
const QUOTES_BY_CATEGORY: Map<string, PlaceholderQuoteRow> = (() => {
	const file = placeholderQuotes as PlaceholderQuoteFile;
	const m = new Map<string, PlaceholderQuoteRow>();
	for (const q of file.quotes) m.set(q.category_id, q);
	return m;
})();

function quoteForCategory(id: TopicCategoryId): RowNarrative['quote'] | undefined {
	const row = QUOTES_BY_CATEGORY.get(id);
	if (!row) return undefined;
	return { text: row.text, attribution: row.participant_id };
}

export function narrativeForTopicRow(row: TopicRow): RowNarrative {
	const s = row.searchVolume;
	const i = row.interviewMentions;
	const sFmt = fmtVol(s);
	const top = row.topSearch ? `"${row.topSearch.query}" (${fmtVol(row.topSearch.volume)}/mo)` : null;
	const cluster = row.topCluster ? `${row.topCluster.label} (${row.topCluster.count})` : null;

	let base: RowNarrative;
	switch (row.category.id) {
		case 'symptoms':
			base = {
				headline: 'Symptoms search as much as treatments — but with more named conditions.',
				body: `${sFmt}/mo across ${row.searchQueries} symptom queries against ${i} interview mentions in ${row.interviewClusters} clusters.${cluster ? ` ${cluster} led the interview side.` : ''} Search demand and interview talk track closely here — the question is whether your protocol probed the specific symptoms patients are actively investigating online.`
			};
			break;
		case 'diagnostics_monitoring':
			base = {
				headline: 'Lab and procedure queries map cleanly to interview talk.',
				body: `${sFmt} searches/mo for kidney biopsy, ANA, eGFR, proteinuria; ${i} interview mentions across ${row.interviewClusters} diagnostic clusters.${top ? ` ${top} was the top query — patients land on clinic vocabulary before they understand it.` : ''}`
			};
			break;
		case 'treatments':
			base = {
				headline: 'Treatment talk is the densest interview topic — and a tight echo of the search demand.',
				body: `Patients searched ${sFmt}/mo across ${row.searchQueries} treatment terms; interviews logged ${i} mentions across ${row.interviewClusters} drug clusters.${cluster ? ` ${cluster} dominated the interview side.` : ''} Brand-name searches (Lupkynis, Benlysta) echo cleanly in patient cluster talk.`
			};
			break;
		case 'side_effects_safety':
			base = {
				headline: `${sFmt}/mo searched. ${i} interview mentions. The loudest scope gap.`,
				body: `Side-effect searches — led by prednisone-related queries — dwarf every other category, but the interview corpus touched the topic only ${i} times across ${row.interviewClusters} clusters. ${top ? `${top} alone outranks most LN-specific queries.` : ''} Strong signal that the interview protocol under-probed a topic patients are actively researching.`
			};
			break;
		case 'quality_of_life':
			base = {
				headline: 'Prognosis, pregnancy, daily life — the heaviest emotional search demand.',
				body: `HRQoL queries (life expectancy, lupus diet, pregnancy, exercise) hit ${sFmt}/mo against ${i} interview mentions in ${row.interviewClusters} clusters. The volume sits in private, late-night searches that don't always surface as direct interview questions.`
			};
			break;
		case 'comorbidities_complications':
			base = {
				headline: 'Patients quietly research the end-state.',
				body: `Kidney failure, dialysis, transplant queries pull ${sFmt}/mo — modest compared to treatments and side effects, but emotionally heavy. Interviews caught ${i} mentions across ${row.interviewClusters} clusters.${cluster ? ` ${cluster} led the cluster side.` : ''} Same end-stage anxiety surfaces in both signals.`
			};
			break;
		case 'clinical_trials':
			base = {
				headline: `${sFmt}/mo searched. Zero interview clusters.`,
				body: `Clinical-trial queries — including ${top ?? 'CAR-T trial searches'} — find no echo in the demo interview corpus.${row.interviewMentions === 0 ? ' The widest scope gap in the dataset.' : ''} A clear research-protocol shortfall if trial recruitment is in scope.`
			};
			break;
		default:
			base = {
				headline: row.category.label,
				body: `${sFmt} searches/mo against ${i} interview mentions.`
			};
	}
	const quote = quoteForCategory(row.category.id);
	return quote ? { ...base, quote } : base;
}

export function computeLupusNephritisTopicAlignment(): TopicAlignment {
	const searchAgg = aggregateSearchByCategory();
	const interviewAgg = aggregateInterviewByCategory();

	const rows: TopicRow[] = TOPIC_CATEGORIES.map((category) => {
		const s = searchAgg.get(category.id);
		const i = interviewAgg.get(category.id);
		return {
			category,
			searchVolume: s?.volume ?? 0,
			searchQueries: s?.queryCount ?? 0,
			interviewMentions: i?.mentions ?? 0,
			interviewClusters: i?.clusterCount ?? 0,
			topSearch: s?.topQuery,
			topCluster: i?.topCluster
		};
	});

	let categoriesWithBoth = 0;
	let categoriesWithSearchOnly = 0;
	let categoriesWithInterviewOnly = 0;
	let totalSearch = 0;
	let totalInterview = 0;
	for (const r of rows) {
		totalSearch += r.searchVolume;
		totalInterview += r.interviewMentions;
		if (r.searchVolume > 0 && r.interviewMentions > 0) categoriesWithBoth++;
		else if (r.searchVolume > 0) categoriesWithSearchOnly++;
		else if (r.interviewMentions > 0) categoriesWithInterviewOnly++;
	}

	return {
		rows,
		totals: {
			searchVolume: totalSearch,
			interviewMentions: totalInterview,
			categoriesWithBoth,
			categoriesWithSearchOnly,
			categoriesWithInterviewOnly
		}
	};
}
