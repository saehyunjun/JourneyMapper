/**
 * derivePatientPoster — builds the prop bag for PatientPoster from a single
 * interview_id and the corpus rollups exported by analysis.ts. Consumers
 * (ParticipantDrawer, participant-profiles page) call this once per row.
 *
 * Pulls from `annotations` (sentiment + theme + emotion per segment),
 * `quotes` (curated pull quotes), and `interviews` (denominator for the
 * vs-median rectangle length). All scores are clamped so a chatty patient
 * doesn't overflow the poster's hard caps.
 */
import {
	annotations,
	quotes,
	interviews,
	titleCase,
	type Annotation,
	type Quote
} from './analysis';

export type PatientPosterProps = {
	interviewId: string;
	segmentCount: number;
	posPct: number;
	negPct: number;
	neutralPct: number;
	segmentsVsMedian: number;
	topThemeSize: number;
	distinctThemes: number;
	distinctEmotions: number;
	netSentiment: number;
	pullQuotes: { id: string; text: string; sentiment?: number; themes?: string[] }[];
	sentimentTimeline: number[];
};

// Corpus median segment count per interview — denominator for the
// rectangle's "vs average speaker" length. Computed once at module load.
const segmentsPerInterview: Map<string, number> = (() => {
	const m = new Map<string, number>();
	for (const a of annotations) m.set(a.interview_id, (m.get(a.interview_id) ?? 0) + 1);
	return m;
})();

const corpusMedianSegments = (() => {
	const counts = [...segmentsPerInterview.values()].sort((a, b) => a - b);
	if (!counts.length) return 1;
	const mid = Math.floor(counts.length / 2);
	return counts.length % 2 === 0 ? (counts[mid - 1] + counts[mid]) / 2 : counts[mid];
})();

// Pull-quote pool by interview_id, sorted by analyst preference (starred
// first, then quote_score.overall). We render up to N dots per patient.
function pullQuotesFor(interviewId: string, starred: Set<string>, max = 6): Quote[] {
	const own = quotes.filter((q) => q.interview_id === interviewId);
	return [...own].sort((a, b) => {
		const sa = Number(starred.has(a.quote_id));
		const sb = Number(starred.has(b.quote_id));
		if (sa !== sb) return sb - sa;
		return b.quote_score.overall - a.quote_score.overall;
	}).slice(0, max);
}

export function derivePatientPoster(
	interviewId: string,
	starredQuoteIds: string[] = []
): PatientPosterProps {
	const own = annotations.filter((a) => a.interview_id === interviewId);
	const segmentCount = own.length;

	let pos = 0, neg = 0, neu = 0;
	for (const a of own) {
		if (a.sentiment > 0) pos++;
		else if (a.sentiment < 0) neg++;
		else neu++;
	}
	const total = pos + neg + neu || 1;
	const posPct = Math.round((pos / total) * 100);
	const negPct = Math.round((neg / total) * 100);
	const neutralPct = Math.max(0, 100 - posPct - negPct);

	// Theme rollup — biggest theme size + count of distinct themes touched.
	const themeCounts = new Map<string, number>();
	for (const a of own) for (const t of a.themes) themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
	const topThemeSize = themeCounts.size ? Math.max(...themeCounts.values()) : 0;
	const distinctThemes = themeCounts.size;

	// Emotional range — count of distinct emotions surfaced.
	const emotions = new Set<string>();
	for (const a of own) for (const e of a.emotions) emotions.add(e);
	const distinctEmotions = emotions.size;

	// Net sentiment in [-1, 1] — average of annotation.sentiment (-2..+2) / 2.
	const sentimentSum = own.reduce((s, a) => s + a.sentiment, 0);
	const netSentiment = segmentCount ? Math.max(-1, Math.min(1, sentimentSum / segmentCount / 2)) : 0;

	// segmentsVsMedian — 1 means this patient talks the median amount.
	const segmentsVsMedian = corpusMedianSegments > 0 ? segmentCount / corpusMedianSegments : 1;

	// Pull quotes for the dot markers.
	const starredSet = new Set(starredQuoteIds);
	const pulls = pullQuotesFor(interviewId, starredSet).map((q) => ({
		id: q.quote_id,
		text: q.text,
		sentiment: q.sentiment,
		themes: q.themes.map(titleCase)
	}));

	// Sentiment timeline — turn-by-turn for this patient only. Sort by
	// segment_id which encodes turn order in the pipeline output.
	const sentimentTimeline = [...own]
		.sort((a, b) => a.segment_id.localeCompare(b.segment_id))
		.map((a) => a.sentiment);

	return {
		interviewId,
		segmentCount,
		posPct,
		negPct,
		neutralPct,
		segmentsVsMedian,
		topThemeSize,
		distinctThemes,
		distinctEmotions,
		netSentiment,
		pullQuotes: pulls,
		sentimentTimeline
	};
}

/** Bucket an age_range string into the three poster variant bands. */
export function ageBandFor(ageRange: string | undefined | null): 'younger' | 'middle' | 'older' {
	if (!ageRange) return 'middle';
	const m = ageRange.match(/(\d{2})/);
	if (!m) return 'middle';
	const lo = parseInt(m[1], 10);
	if (lo <= 30) return 'younger';
	if (lo >= 56) return 'older';
	return 'middle';
}
