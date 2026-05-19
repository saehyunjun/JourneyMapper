/**
 * executive-summary.ts
 *
 * Derives the home-page executive summary from the interview-analysis pipeline
 * outputs: a headline read on overall sentiment, and a handful of cross-cutting
 * "findings" — the brightest and hardest moments of the interview, the most-
 * discussed and most-divisive topics, and how patients talked about GLP-1
 * drugs versus other weight-loss methods. Each finding carries a computed data
 * point, the positive/neutral/negative split behind it, a supporting quote,
 * and the coded segments to show when its card opens a drawer.
 *
 * Like journey.ts / keywords.ts this is the UI-side counterpart to the build
 * scripts: everything here is derived at runtime from the JSON artifacts, no
 * new file is written. Quote selection is the one piece that needs live state
 * (the analyst's stars), so `buildFindings` takes the starred ids as an
 * argument — the rest of the module is static.
 *
 * EDITORIAL LAYER — `SHORT_LABEL` is the one authored piece, the headline-
 * friendly phrasing of a question or theme id (the way journey.ts's PLAN names
 * its phases). Every count, mean, and ranking below is derived.
 */
import {
	annotations,
	quotes,
	questions,
	questionLabel,
	titleCase,
	fragmentsMatching,
	segmentsForTheme,
	subthemeParent,
	themeGroupOf,
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

const distributionOf = (rows: { sentiment: number }[]): Distribution => ({
	positive: rows.filter((r) => r.sentiment > 0).length,
	neutral: rows.filter((r) => r.sentiment === 0).length,
	negative: rows.filter((r) => r.sentiment < 0).length
});

// --- Per-question sentiment ------------------------------------------------

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

// --- Per-theme sentiment ---------------------------------------------------

export type ThemeStat = {
	theme: string;
	n: number;
	positive: number;
	negative: number;
	mean: number;
	interviews: number;
};

function themeStats(): ThemeStat[] {
	const by = new Map<string, Annotation[]>();
	for (const a of themed)
		for (const t of a.themes) {
			const list = by.get(t);
			if (list) list.push(a);
			else by.set(t, [a]);
		}
	return [...by.entries()].map(([theme, rows]) => ({
		theme,
		n: rows.length,
		positive: rows.filter((r) => r.sentiment > 0).length,
		negative: rows.filter((r) => r.sentiment < 0).length,
		mean: rows.reduce((s, r) => s + r.sentiment, 0) / rows.length,
		interviews: new Set(rows.map((r) => r.interview_id)).size
	}));
}

const THEMES: ThemeStat[] = themeStats();

/** One sub-kind within a theme — e.g. a kind of support within `education_need`. */
export type BreakdownItem = {
	id: string;
	label: string;
	count: number;
	positive: number;
	negative: number;
};

/**
 * A theme's subtheme tally — the codebook's own decomposition of the theme into
 * kinds, counted across the themed annotations. Sorted by count, biggest first.
 */
function subthemeBreakdown(themeId: string): BreakdownItem[] {
	const by = new Map<string, Annotation[]>();
	for (const a of themed) {
		if (!a.themes.includes(themeId)) continue;
		for (const s of a.subthemes) {
			if (subthemeParent.get(s) !== themeId) continue;
			const list = by.get(s);
			if (list) list.push(a);
			else by.set(s, [a]);
		}
	}
	return [...by.entries()]
		.map(([id, rows]) => ({
			id,
			label: titleCase(id),
			count: rows.length,
			positive: rows.filter((r) => r.sentiment > 0).length,
			negative: rows.filter((r) => r.sentiment < 0).length
		}))
		.sort((a, b) => b.count - a.count);
}

/** Heading for a theme's breakdown — names it as kinds of support where it fits. */
function breakdownLabelFor(themeId: string): string {
	return themeGroupOf.get(themeId) === 'education_support'
		? 'Kinds of support mentioned'
		: 'Within this theme';
}

// --- Medications vs. other weight-loss methods -----------------------------

type KeywordUsage = {
	categories: {
		id: string;
		label: string;
		keywords: { id: string; label: string; count: number; matches: { segment_id: string }[] }[];
	}[];
};

const keywordCategories = (keywordUsageRaw as KeywordUsage).categories;
const categoryMentions = (id: string): number =>
	keywordCategories.find((c) => c.id === id)?.keywords.reduce((s, k) => s + k.count, 0) ?? 0;

/** Named GLP-1 products and formulations — the headline of the medications talk. */
const NAMED_DRUG_KEYWORDS = new Set([
	'glp_1',
	'semaglutide',
	'tirzepatide',
	'orforglipron',
	'retatrutide',
	'cagrilintide',
	'oral_medication',
	'compounded_medication',
	'name_brand'
]);

const medicationMentions = categoryMentions('medications');
const lifestyleMentions = categoryMentions('lifestyle');
const namedDrugMentions =
	keywordCategories
		.find((c) => c.id === 'medications')
		?.keywords.filter((k) => NAMED_DRUG_KEYWORDS.has(k.id))
		.reduce((s, k) => s + k.count, 0) ?? 0;

/** Every segment that mentions a medications-category keyword. */
const medicationSegmentIds = new Set<string>(
	keywordCategories
		.find((c) => c.id === 'medications')
		?.keywords.flatMap((k) => k.matches.map((m) => m.segment_id)) ?? []
);

// --- Editorial labels + text helpers --------------------------------------

/**
 * Headline-friendly phrasing for a question or theme id. Authored so the
 * generated sentences read naturally ("spoke most warmly about …"); anything
 * not listed falls back to a title-cased id.
 */
const SHORT_LABEL: Record<string, string> = {
	// questions
	stopping_glp1: 'stopping a GLP-1',
	try_different_medication: 'switching medications',
	trial_unapproved_medication: 'trialing an unapproved drug',
	trial_motivation: 'what would draw them to a trial',
	placebo_controlled_appeal: 'placebo-controlled trials',
	monthly_injection_barrier: 'the monthly injection',
	compounded_vs_approved: 'compounded vs. approved drugs',
	trial_barriers: 'the barriers to joining a trial',
	trial_concerns: 'their lingering trial concerns',
	educational_support: 'the support they want',
	weight_loss_history: 'their weight-loss history',
	considered_trials_before: 'past experience with trials',
	oral_glp_awareness: 'oral GLP-1 options',
	oral_vs_injectable: 'oral vs. injectable treatment',
	// themes
	education_need: 'the need for education',
	information_seeking: 'seeking out information',
	risk_calculation: 'weighing the risks',
	visit_logistics: 'trial visit logistics',
	oral_medication_interest: 'interest in oral medication',
	side_effect_concern: 'side-effect concerns',
	cost_access: 'cost and access',
	insurance_barrier: 'insurance barriers',
	treatment_continuation: 'staying on treatment',
	trial_participation_motivation: 'the motivation to join a trial',
	monitoring_burden: 'the monitoring burden',
	travel_burden: 'travel to the site'
};

function shortLabel(id: string): string {
	return SHORT_LABEL[id] ?? titleCase(id).replace(/Glp1/g, 'GLP-1');
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Signed mean to two places, with a typographic minus. */
const formatMean = (m: number): string => (m < 0 ? '−' : '+') + Math.abs(m).toFixed(2);

const NUM_WORDS = [
	'zero', 'one', 'two', 'three', 'four', 'five', 'six',
	'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'
];
const numWord = (n: number): string => NUM_WORDS[n] ?? String(n);

// --- Findings --------------------------------------------------------------

/** A moment finding needs at least this many coded segments to qualify. */
const MIN_MOMENT_N = 10;

/** Brightest / hardest interview questions, by mean sentiment. */
const rankedQuestions = questionSentiment.filter((q) => q.n >= MIN_MOMENT_N);
const brightestQuestion = rankedQuestions[0];
const hardestQuestion = rankedQuestions[rankedQuestions.length - 1];

/** Most-discussed theme, and the most divisive theme distinct from it. */
const mostDiscussed = [...THEMES].sort((a, b) => b.n - a.n)[0];
const mostDivisive = [...THEMES]
	.filter((t) => t.theme !== mostDiscussed?.theme)
	.sort(
		(a, b) =>
			Math.min(b.positive, b.negative) - Math.min(a.positive, a.negative) || b.n - a.n
	)[0];

export type SummaryQuote = {
	/** quote_id from the quote bank. */
	id: string;
	isStarred: boolean;
	interview_id: string;
	question_id: string;
	text: string;
	sentiment: number;
	themes: string[];
	/** Quote-bank overall score. */
	score: number;
};

/**
 * Pick one supporting quote from `candidates`: an analyst-starred quote first
 * (the "starred first, then bank" rule), then the highest-scored. `prefer`
 * narrows to a sentiment direction when the candidate set still has one.
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

export type FindingTone = 'positive' | 'negative' | 'divisive' | 'neutral';

export type Finding = {
	id: 'brightest' | 'hardest' | 'most-discussed' | 'most-divisive' | 'medications';
	tone: FindingTone;
	/** Short kicker — "Brightest moment" etc. */
	eyebrow: string;
	/** The big figure on the card. */
	stat: { value: string; caption: string };
	/** Generated one-line takeaway. */
	headline: string;
	/** Generated supporting sentence with the underlying counts. */
	detail: string;
	/** Positive / neutral / negative split — the donut on the card. */
	distribution: Distribution;
	/** Heading for `breakdown`, when the finding has one. */
	breakdownLabel?: string;
	/** Sub-kinds behind the finding (e.g. the kinds of support) — a mini chart. */
	breakdown?: BreakdownItem[];
	/** The supporting quote, or null if the bank covers neither side. */
	quote: SummaryQuote | null;
	/** Coded segments behind the finding — shown when its card opens a drawer. */
	fragments: ThemeFragment[];
};

const bySegmentId = (a: ThemeFragment, b: ThemeFragment) =>
	a.segment_id.localeCompare(b.segment_id);

/**
 * The five cross-cutting findings, with a supporting quote chosen against the
 * supplied analyst stars. Static counts aside, only quote selection varies
 * with `starredQuoteIds`.
 */
export function buildFindings(starredQuoteIds: string[] = []): Finding[] {
	const starred = new Set(starredQuoteIds);
	const findings: Finding[] = [];

	if (brightestQuestion) {
		const q = brightestQuestion;
		findings.push({
			id: 'brightest',
			tone: 'positive',
			eyebrow: 'Brightest moment',
			stat: { value: formatMean(q.mean), caption: `avg sentiment · ${q.n} segments` },
			headline: `${cap(shortLabel(q.question_id))} drew the study's warmest responses.`,
			detail: `Asked “${questionLabel(q.question_id)}”, ${q.positive} of ${q.n} coded segments came back positive — the highest of any question in the guide.`,
			distribution: { positive: q.positive, neutral: q.n - q.positive - q.negative, negative: q.negative },
			quote: pickQuote(
				quotes.filter((x) => x.question_id === q.question_id),
				starred,
				'positive'
			),
			fragments: fragmentsMatching(
				(a) => a.question_id === q.question_id && a.themes.length > 0
			).sort(bySegmentId)
		});
	}

	if (hardestQuestion) {
		const q = hardestQuestion;
		findings.push({
			id: 'hardest',
			tone: 'negative',
			eyebrow: 'Hardest moment',
			stat: { value: formatMean(q.mean), caption: `avg sentiment · ${q.n} segments` },
			headline: `${cap(shortLabel(q.question_id))} surfaced the most frustration.`,
			detail: `Asked “${questionLabel(q.question_id)}”, ${q.negative} of ${q.n} coded segments came back negative — the lowest reading in the guide.`,
			distribution: { positive: q.positive, neutral: q.n - q.positive - q.negative, negative: q.negative },
			quote: pickQuote(
				quotes.filter((x) => x.question_id === q.question_id),
				starred,
				'negative'
			),
			fragments: fragmentsMatching(
				(a) => a.question_id === q.question_id && a.themes.length > 0
			).sort(bySegmentId)
		});
	}

	{
		// Medications vs. other weight-loss methods.
		const medFragments = fragmentsMatching((a) => medicationSegmentIds.has(a.segment_id));
		findings.push({
			id: 'medications',
			tone: 'neutral',
			eyebrow: 'Drugs vs. methods',
			stat: {
				value: String(medicationMentions),
				caption: `medication mentions · ${medicationSegmentIds.size} segments`
			},
			headline: 'Patients reached for GLP-1 drugs over diet and exercise.',
			detail: `Medications surfaced ${medicationMentions} times across the interviews — more than double the ${lifestyleMentions} mentions of diet, exercise, and other lifestyle methods. Named GLP-1 products alone accounted for ${namedDrugMentions}.`,
			distribution: distributionOf(medFragments),
			quote: pickQuote(
				quotes.filter((x) =>
					x.themes.some((t) =>
						[
							'oral_medication_interest',
							'drug_switching',
							'compounded_medication',
							'medication_access',
							'treatment_continuation',
							'treatment_dependency',
							'non_weight_benefits'
						].includes(t)
					)
				),
				starred,
				'any'
			),
			fragments: medFragments.slice().sort(bySegmentId)
		});
	}

	if (mostDiscussed) {
		const t = mostDiscussed;
		findings.push({
			id: 'most-discussed',
			tone: 'neutral',
			eyebrow: 'Most discussed',
			stat: {
				value: String(t.n),
				caption: `mentions · ${t.interviews} of ${summaryStats.interviews} interviews`
			},
			headline: `${cap(shortLabel(t.theme))} ran through nearly every interview.`,
			detail: `It surfaced in ${t.n} coded segments across ${t.interviews} of the ${summaryStats.interviews} interviews — no other thread was returned to as often.`,
			distribution: { positive: t.positive, neutral: t.n - t.positive - t.negative, negative: t.negative },
			breakdownLabel: breakdownLabelFor(t.theme),
			breakdown: subthemeBreakdown(t.theme),
			quote: pickQuote(
				quotes.filter((x) => x.themes.includes(t.theme)),
				starred,
				'any'
			),
			fragments: segmentsForTheme(t.theme).sort(bySegmentId)
		});
	}

	if (mostDivisive) {
		const t = mostDivisive;
		findings.push({
			id: 'most-divisive',
			tone: 'divisive',
			eyebrow: 'Most divisive',
			stat: {
				value: `${t.positive} / ${t.negative}`,
				caption: 'positive vs. negative mentions'
			},
			headline: `${cap(shortLabel(t.theme))} split opinion down the middle.`,
			detail: `Across ${t.n} coded segments, ${t.positive} leaned positive and ${t.negative} negative — the widest sentiment split of any theme.`,
			distribution: { positive: t.positive, neutral: t.n - t.positive - t.negative, negative: t.negative },
			breakdownLabel: breakdownLabelFor(t.theme),
			breakdown: subthemeBreakdown(t.theme),
			quote: pickQuote(
				quotes.filter((x) => x.themes.includes(t.theme)),
				starred,
				'any'
			),
			fragments: segmentsForTheme(t.theme).sort(bySegmentId)
		});
	}

	return findings;
}

/**
 * The opening paragraph — a programmatic read of the corpus. Static: it leans
 * only on the question ranking, not on analyst stars.
 */
export const summaryText: string = [
	`${cap(numWord(summaryStats.interviews))} GLP-1 patients sat for in-depth interviews,`,
	`producing ${summaryStats.segments} coded segments across ${summaryStats.themes} themes.`,
	`Sentiment ran ${sentimentLean.lean}: ${sentimentLean.posPct}% of coded moments registered`,
	`positive against ${sentimentLean.negPct}% negative.`,
	brightestQuestion && hardestQuestion
		? `Patients spoke most warmly about ${shortLabel(brightestQuestion.question_id)}, and most guardedly about ${shortLabel(hardestQuestion.question_id)}.`
		: ''
]
	.filter(Boolean)
	.join(' ');
