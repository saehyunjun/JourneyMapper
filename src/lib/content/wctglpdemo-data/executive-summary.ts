/**
 * executive-summary.ts
 *
 * Derives the home-page executive summary from the interview-analysis pipeline
 * outputs: a headline read on overall sentiment, and four cluster-driven
 * findings — what drove negative reactions to each broad theme, what drew the
 * warmest reactions to treatment, and which "expected" trial barriers turned
 * out not to be barriers at all. Each finding carries a small set of keyword
 * clusters with one sentiment-coloured block per matched segment, an overall
 * positive/neutral/negative split, an optional anchor quote, and the coded
 * segments to show when its card opens a drawer.
 *
 * Like journey.ts / keywords.ts this is the UI-side counterpart to the build
 * scripts: everything here is derived at runtime from the JSON artifacts. Quote
 * selection is the one piece that needs live state (the analyst's stars), so
 * `buildFindings` takes the starred ids as an argument — the rest of the
 * module is static.
 */
import {
	annotations,
	quotes,
	questions,
	titleCase,
	fragmentsMatching,
	type Annotation,
	type Quote,
	type ThemeFragment
} from './analysis';
import keywordUsageRaw from './keyword_usage.json';

/** Themed segment annotations — the unit the summary counts over. */
const themed: Annotation[] = annotations.filter((a) => a.themes.length > 0);

/** Distinct interviews represented in the themed annotations. */
const interviewIds = [...new Set(themed.map((a) => a.interview_id))];

export const summaryStats = {
	interviews: interviewIds.length,
	segments: themed.length,
	themes: new Set(themed.flatMap((a) => a.themes)).size,
	quotes: quotes.length
};

// --- Overall sentiment lean ------------------------------------------------

const positiveCount = themed.filter((a) => a.sentiment > 0).length;
const negativeCount = themed.filter((a) => a.sentiment < 0).length;
const neutralCount = themed.length - positiveCount - negativeCount;
const pct = (n: number) => (themed.length ? Math.round((n / themed.length) * 100) : 0);

export const sentimentLean = {
	positive: positiveCount,
	negative: negativeCount,
	neutral: neutralCount,
	total: themed.length,
	posPct: pct(positiveCount),
	negPct: pct(negativeCount),
	neutralPct: pct(neutralCount),
	/** Which way the corpus tips — a 1.2× margin keeps a near-even split "mixed". */
	lean: (positiveCount > negativeCount * 1.2
		? 'positive'
		: negativeCount > positiveCount * 1.2
			? 'negative'
			: 'mixed') as 'positive' | 'negative' | 'mixed'
};

/** A positive / neutral / negative split — the data behind a finding's donut. */
export type Distribution = { positive: number; neutral: number; negative: number };

// --- Keyword-cluster scoping ----------------------------------------------

type KeywordUsageMatch = { segment_id: string; interview_id: string; question_id: string | null };
type KeywordUsageCluster = {
	id: string;
	label: string;
	parent_theme?: string;
	parent_subtheme?: string;
	count: number;
	matches: KeywordUsageMatch[];
};

const keywordClusters = (keywordUsageRaw as unknown as { clusters: KeywordUsageCluster[] }).clusters;
const annBySeg = new Map(annotations.map((a) => [a.segment_id, a]));

/** One annotated segment behind a cluster row — the unit a SentimentBar block draws. */
type ClusterSegment = { segment_id: string; sentiment: number; interview_id: string };

type ClusterRow = {
	cluster: KeywordUsageCluster;
	/** Distinct annotated segments where this cluster surfaced (under the active scope). */
	segments: ClusterSegment[];
	positive: number;
	negative: number;
	neutral: number;
};

/**
 * Per-cluster rows, scoped to annotations matching the predicate. Segments
 * are deduped within a cluster; sentiment is pulled from the codebook
 * annotation, not the keyword match itself.
 */
function clusterRows(annPred: (a: Annotation) => boolean): ClusterRow[] {
	const rows: ClusterRow[] = [];
	for (const cluster of keywordClusters) {
		const seen = new Set<string>();
		const segments: ClusterSegment[] = [];
		for (const m of cluster.matches) {
			if (seen.has(m.segment_id)) continue;
			const a = annBySeg.get(m.segment_id);
			if (!a) continue;
			if (!annPred(a)) continue;
			seen.add(m.segment_id);
			segments.push({
				segment_id: m.segment_id,
				sentiment: a.sentiment,
				interview_id: a.interview_id
			});
		}
		if (!segments.length) continue;
		rows.push({
			cluster,
			segments,
			positive: segments.filter((s) => s.sentiment > 0).length,
			negative: segments.filter((s) => s.sentiment < 0).length,
			neutral: segments.filter((s) => s.sentiment === 0).length
		});
	}
	return rows;
}

/** Sentiment block stream for a finding's bars — one block per matched segment. */
export type ClusterBlock = { sentiment: number; interview_id: string };

export type ClusterBar = {
	id: string;
	label: string;
	count: number;
	positive: number;
	negative: number;
	neutral: number;
	blocks: ClusterBlock[];
};

const barFromRow = (r: ClusterRow): ClusterBar => ({
	id: r.cluster.id,
	label: r.cluster.label,
	count: r.segments.length,
	positive: r.positive,
	negative: r.negative,
	neutral: r.neutral,
	blocks: r.segments.map((s) => ({ sentiment: s.sentiment, interview_id: s.interview_id }))
});

// --- Per-question sentiment (kept as an internal stat) --------------------

const primaryQuestionIds = new Set(
	questions.filter((q) => q.type === 'primary').map((q) => q.question_id)
);

export type QuestionSentiment = {
	question_id: string;
	n: number;
	mean: number;
	positive: number;
	negative: number;
};

function questionSentiments(): QuestionSentiment[] {
	const by = new Map<string, Annotation[]>();
	for (const a of themed) {
		if (!a.question_id || !primaryQuestionIds.has(a.question_id)) continue;
		const list = by.get(a.question_id);
		if (list) list.push(a);
		else by.set(a.question_id, [a]);
	}
	return [...by.entries()]
		.map(([question_id, rows]) => ({
			question_id,
			n: rows.length,
			mean: rows.reduce((s, r) => s + r.sentiment, 0) / rows.length,
			positive: rows.filter((r) => r.sentiment > 0).length,
			negative: rows.filter((r) => r.sentiment < 0).length
		}))
		.sort((a, b) => b.mean - a.mean);
}

/** Primary interview questions, ranked by mean sentiment (warmest first). */
export const questionSentiment: QuestionSentiment[] = questionSentiments();

// --- Editorial labels + text helpers --------------------------------------

const NUM_WORDS = [
	'zero', 'one', 'two', 'three', 'four', 'five', 'six',
	'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'
];
const numWord = (n: number): string => NUM_WORDS[n] ?? String(n);

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Inline form of a cluster label — strips parenthetical disambiguation
 *  ("Side effects (as barrier)" → "side effects") and lower-cases for
 *  natural mid-sentence use. Acronyms like GLP-1 are preserved. */
function inlineClusterLabel(label: string): string {
	const stripped = label.replace(/\s*\([^)]*\)\s*/g, '').trim();
	// Preserve all-caps tokens (acronyms) — only lower the first letter of
	// otherwise-title-cased words.
	return stripped
		.split(/(\s+)/)
		.map((tok) => (/^[A-Z0-9-]+$/.test(tok) ? tok : tok.toLowerCase()))
		.join('');
}

function joinNames(names: string[]): string {
	if (names.length === 0) return '';
	if (names.length === 1) return names[0];
	if (names.length === 2) return `${names[0]} and ${names[1]}`;
	return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

// --- Findings --------------------------------------------------------------

/** Floor on cluster segment-count before it can rank in a finding — keeps
 *  one-off mentions from displacing genuine signal. */
const MIN_CLUSTER_N = 3;
/** Top-K clusters shown per finding. */
const TOP_K = 5;
/** Headline names the top-N clusters inline. */
const HEADLINE_K = 3;

const negativeRank = (a: ClusterRow, b: ClusterRow) =>
	b.negative - a.negative ||
	b.negative / b.segments.length - a.negative / a.segments.length ||
	b.segments.length - a.segments.length;

const positiveRank = (a: ClusterRow, b: ClusterRow) =>
	b.positive - a.positive ||
	b.positive / b.segments.length - a.positive / a.segments.length ||
	b.segments.length - a.segments.length;

/** Theme-anchor cluster labels — clusters whose label IS the theme name
 *  rather than a sub-topic. These are filtered out of self-driver lists:
 *  a cluster can't be a "driver" of the theme it IS (see
 *  [[no-tautological-drivers]] feedback). Keyed by theme id; values are
 *  lowercased label forms the lexicon happens to use. */
const SELF_DRIVER_TAUTOLOGIES: Record<string, string[]> = {
	clinical_trials: ['clinical trial', 'clinical trials'],
	treatment: ['treatment'],
	condition_specific: ['condition specific', 'condition-specific']
};

/** Cluster ids that name a SPEAKER STANCE rather than a domain entity —
 *  pure affect ("Concern (explicit)") or generic evaluation ("Harm",
 *  "Better"). Surfacing them as drivers produces near-tautologies like
 *  "people expressing concern drove the sentiment of concern." Same
 *  principle as SELF_DRIVER_TAUTOLOGIES, just scope-independent: a
 *  stance-only cluster is never a useful driver in any scope.
 *
 *  Watch list (intentionally NOT filtered for now): `risk` — clinicians
 *  use "risk-benefit profile" as a real clinical referent, so it can
 *  legitimately drive sentiment in some contexts. Revisit if it starts
 *  dominating driver lists without adding signal. */
const STANCE_ONLY_DRIVER_IDS = new Set<string>([
	'concern',
	'harm',
	'better',
	'guinea_pig',
	'lawsuits'
]);

/** Drop rows whose cluster is either a theme-anchor tautology for the
 *  scope theme OR a globally stance-only cluster. Apply at every site
 *  that builds a driver list — keeps the principle enforced app-wide via
 *  one helper instead of duplicating filters. */
function dropSelfDrivers(rows: ClusterRow[], scopeTheme: string): ClusterRow[] {
	const anchors = new Set(SELF_DRIVER_TAUTOLOGIES[scopeTheme] ?? []);
	return rows.filter((r) => {
		if (STANCE_ONLY_DRIVER_IDS.has(r.cluster.id)) return false;
		if (anchors.size && anchors.has(r.cluster.label.toLowerCase().trim())) return false;
		return true;
	});
}

// 1. Negative drivers of clinical-trial sentiment.
const trialScopeRows = dropSelfDrivers(
	clusterRows((a) => a.themes.includes('clinical_trials')),
	'clinical_trials'
);
const negTrialDrivers = trialScopeRows
	.filter((r) => r.negative >= 2 && r.segments.length >= MIN_CLUSTER_N)
	.sort(negativeRank)
	.slice(0, TOP_K);

// 2. Negative drivers of treatment sentiment.
const treatmentScopeRows = dropSelfDrivers(
	clusterRows((a) => a.themes.includes('treatment')),
	'treatment'
);
const negTreatmentDrivers = treatmentScopeRows
	.filter((r) => r.negative >= 2 && r.segments.length >= MIN_CLUSTER_N)
	.sort(negativeRank)
	.slice(0, TOP_K);

// 3. Positive drivers of treatment sentiment.
const posTreatmentDrivers = treatmentScopeRows
	.filter((r) => r.positive >= 3 && r.segments.length >= MIN_CLUSTER_N)
	.sort(positiveRank)
	.slice(0, TOP_K);

// 4. Trial barriers that turned out NOT to be barriers — codebook-declared
//    trial-barrier clusters that, when they actually came up, drew at least as
//    many positive as negative reactions (i.e. didn't skew negative). Ranked
//    by mention count so the most-discussed non-issues lead.
const trialBarrierRows = clusterRows(() => true).filter(
	(r) => r.cluster.parent_subtheme === 'trial_barriers' && r.segments.length >= 2
);
const nonBarriers = trialBarrierRows
	.filter((r) => r.positive >= r.negative)
	.sort((a, b) => b.segments.length - a.segments.length)
	.slice(0, TOP_K);

// --- Quote selection ------------------------------------------------------

export type SummaryQuote = {
	id: string;
	isStarred: boolean;
	interview_id: string;
	question_id: string;
	text: string;
	sentiment: number;
	themes: string[];
	score: number;
};

const segmentIdsForQuote = new Map<string, string>();
for (const q of quotes) for (const sid of q.segment_ids) segmentIdsForQuote.set(sid, q.quote_id);

/** Pool of quotes whose underlying segments live in any of the given rows. */
function quotesForRows(rows: ClusterRow[]): Quote[] {
	const segIds = new Set(rows.flatMap((r) => r.segments.map((s) => s.segment_id)));
	return quotes.filter((q) => q.segment_ids.some((sid) => segIds.has(sid)));
}

/**
 * Pick one supporting quote from `candidates`: an analyst-starred quote first,
 * then the highest-scored. `prefer` narrows to a sentiment direction when the
 * candidate set still has one in that direction.
 */
function pickQuote(
	candidates: Quote[],
	starred: Set<string>,
	prefer: 'positive' | 'negative' | 'any'
): SummaryQuote | null {
	const directed =
		prefer === 'positive'
			? candidates.filter((q) => q.sentiment > 0)
			: prefer === 'negative'
				? candidates.filter((q) => q.sentiment < 0)
				: candidates;
	const pool = directed.length ? directed : candidates;
	if (!pool.length) return null;
	const best = [...pool].sort((a, b) => {
		const sa = Number(starred.has(a.quote_id));
		const sb = Number(starred.has(b.quote_id));
		if (sa !== sb) return sb - sa;
		return b.quote_score.overall - a.quote_score.overall;
	})[0];
	return {
		id: best.quote_id,
		isStarred: starred.has(best.quote_id),
		interview_id: best.interview_id,
		question_id: best.question_id,
		text: best.text,
		sentiment: best.sentiment,
		themes: best.themes,
		score: best.quote_score.overall
	};
}

// --- Finding shape --------------------------------------------------------

export type FindingTone = 'positive' | 'negative' | 'divisive' | 'neutral';

export type Finding = {
	id: 'negative-trial' | 'negative-treatment' | 'positive-treatment' | 'trial-non-barriers';
	tone: FindingTone;
	/** Short kicker — "What drove negative trial sentiment" etc. */
	eyebrow: string;
	/** Big figure on the card. */
	stat: { value: string; caption: string };
	/** Generated one-line takeaway, naming the top clusters inline. */
	headline: string;
	/** Generated supporting sentence with the underlying counts. */
	detail: string;
	/** Optional analyst-voice lede (from dashboard-blurbs.ts) that supersedes
	 *  the templated `headline` when present. */
	lede?: string;
	/** Optional analyst-voice analysis paragraph (from dashboard-blurbs.ts)
	 *  that supersedes the templated `detail` when present. */
	analysis?: string;
	/** Top keyword clusters behind the finding — one row per cluster, one
	 *  sentiment-coloured block per matched segment. */
	clusters: ClusterBar[];
	/** Overall positive / neutral / negative split — the donut on the card. */
	distribution: Distribution;
	/** Anchor quote from the underlying segments, or null if none fit. */
	quote: SummaryQuote | null;
	/** Coded segments behind the finding — shown when its card opens a drawer. */
	fragments: ThemeFragment[];
};

const bySegmentId = (a: ThemeFragment, b: ThemeFragment) =>
	a.segment_id.localeCompare(b.segment_id);

/** Sum positive / neutral / negative across a set of rows. */
function aggregate(rows: ClusterRow[]): Distribution {
	const seen = new Set<string>();
	let positive = 0;
	let neutral = 0;
	let negative = 0;
	for (const r of rows) {
		for (const s of r.segments) {
			if (seen.has(s.segment_id)) continue;
			seen.add(s.segment_id);
			if (s.sentiment > 0) positive++;
			else if (s.sentiment < 0) negative++;
			else neutral++;
		}
	}
	return { positive, neutral, negative };
}

function fragmentsForRows(rows: ClusterRow[]): ThemeFragment[] {
	const ids = new Set(rows.flatMap((r) => r.segments.map((s) => s.segment_id)));
	return fragmentsMatching((a) => ids.has(a.segment_id)).sort(bySegmentId);
}

function headlineClusterNames(rows: ClusterRow[]): string {
	return joinNames(rows.slice(0, HEADLINE_K).map((r) => inlineClusterLabel(r.cluster.label)));
}

/**
 * The four cluster-driven findings, with a supporting quote chosen against the
 * supplied analyst stars. Static counts aside, only quote selection varies
 * with `starredQuoteIds`.
 */
export function buildFindings(starredQuoteIds: string[] = []): Finding[] {
	const starred = new Set(starredQuoteIds);
	const findings: Finding[] = [];

	if (negTrialDrivers.length) {
		const rows = negTrialDrivers;
		const dist = aggregate(rows);
		const names = headlineClusterNames(rows);
		findings.push({
			id: 'negative-trial',
			tone: 'negative',
			eyebrow: 'Drivers of negative trial sentiment',
			stat: { value: String(dist.negative), caption: `negative mentions · ${dist.positive + dist.neutral + dist.negative} segments` },
			headline: `${cap(names)} drove the negative sentiment about clinical trials.`,
			detail: `Across the ${rows.length} keyword clusters that surfaced most in negative trial talk, ${dist.negative} of the underlying ${dist.positive + dist.neutral + dist.negative} segments came back negative.`,
			clusters: rows.map(barFromRow),
			distribution: dist,
			quote: pickQuote(quotesForRows(rows), starred, 'negative'),
			fragments: fragmentsForRows(rows)
		});
	}

	if (negTreatmentDrivers.length) {
		const rows = negTreatmentDrivers;
		const dist = aggregate(rows);
		const names = headlineClusterNames(rows);
		findings.push({
			id: 'negative-treatment',
			tone: 'negative',
			eyebrow: 'Drivers of negative treatment sentiment',
			stat: { value: String(dist.negative), caption: `negative mentions · ${dist.positive + dist.neutral + dist.negative} segments` },
			headline: `${cap(names)} drove the loudest negative reactions to treatment.`,
			detail: `Across the ${rows.length} keyword clusters that surfaced most in negative treatment talk, ${dist.negative} of the underlying ${dist.positive + dist.neutral + dist.negative} segments came back negative.`,
			clusters: rows.map(barFromRow),
			distribution: dist,
			quote: pickQuote(quotesForRows(rows), starred, 'negative'),
			fragments: fragmentsForRows(rows)
		});
	}

	if (posTreatmentDrivers.length) {
		const rows = posTreatmentDrivers;
		const dist = aggregate(rows);
		const names = headlineClusterNames(rows);
		findings.push({
			id: 'positive-treatment',
			tone: 'positive',
			eyebrow: 'Drivers of positive treatment sentiment',
			stat: { value: String(dist.positive), caption: `positive mentions · ${dist.positive + dist.neutral + dist.negative} segments` },
			headline: `${cap(names)} drew the warmest reactions to treatment.`,
			detail: `Across the ${rows.length} keyword clusters that surfaced most in positive treatment talk, ${dist.positive} of the underlying ${dist.positive + dist.neutral + dist.negative} segments came back positive.`,
			clusters: rows.map(barFromRow),
			distribution: dist,
			quote: pickQuote(quotesForRows(rows), starred, 'positive'),
			fragments: fragmentsForRows(rows)
		});
	}

	if (nonBarriers.length) {
		const rows = nonBarriers;
		const dist = aggregate(rows);
		const names = headlineClusterNames(rows);
		findings.push({
			id: 'trial-non-barriers',
			tone: 'neutral',
			eyebrow: 'Non-issues for trial participation',
			stat: { value: String(rows.length), caption: `expected barriers that didn't drive negative sentiment` },
			headline: `${cap(names)} were not viewed as major barriers to trial participation.`,
			detail: `Of the ${trialBarrierRows.length} trial-barrier topics raised in the interviews, ${rows.length} didn't skew negative when they came up — ${dist.positive} of the ${dist.positive + dist.neutral + dist.negative} mentions were positive against just ${dist.negative} negative.`,
			clusters: rows.map(barFromRow),
			distribution: dist,
			quote: pickQuote(quotesForRows(rows), starred, 'any'),
			fragments: fragmentsForRows(rows)
		});
	}

	return findings;
}

/**
 * The opening paragraph — a programmatic read of the corpus. Static: leans
 * only on the headline cluster ranking, not on analyst stars.
 */
export const summaryText: string = (() => {
	const bits = [
		`${cap(numWord(summaryStats.interviews))} GLP-1 patients sat for in-depth interviews,`,
		`producing ${summaryStats.segments} tagged quotes across ${summaryStats.themes} themes.`,
		`Sentiment ran ${sentimentLean.lean}: ${sentimentLean.posPct}% of coded moments registered`,
		`positive against ${sentimentLean.negPct}% negative.`
	];
	const negHead = negTreatmentDrivers.length
		? headlineClusterNames(negTreatmentDrivers)
		: '';
	const posHead = posTreatmentDrivers.length
		? headlineClusterNames(posTreatmentDrivers)
		: '';
	if (negHead && posHead) {
		bits.push(
			`Negative reactions clustered around ${negHead}; warmest mentions were of ${posHead}.`
		);
	}
	return bits.join(' ');
})();
