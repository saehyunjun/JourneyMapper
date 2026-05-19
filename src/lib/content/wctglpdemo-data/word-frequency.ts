/**
 * word-frequency.ts
 *
 * Runtime word-frequency analysis over participant transcripts and theme
 * segments/quotes — the UI-side counterpart to scripts/build-word-usage.mjs.
 * Same tokenizer and stoplist, so on-screen counts agree with word_usage.json.
 *
 * Two jobs:
 *   - analyzeWords(texts, opts) — tokenize + count any bag of text, then rank
 *       words either by raw frequency ("common") or by how far they over-index
 *       against a baseline corpus ("distinctive" — the scope's unique voice).
 *       When the input texts carry a sentiment, each word also gets the
 *       average sentiment of the segments it appeared in.
 *   - participantWords / themeWords — convenience wrappers that gather the
 *       right segments for a participant or a theme and pick a sensible baseline.
 *
 * The result's `words` array is shaped for <WordCloud> (`text` + `value`), so
 * it drops straight into the component with no remapping.
 */
import { segments, annotations, segmentsForTheme, wordUsage } from './analysis';

// --- Stoplist ------------------------------------------------------------
// Mirrors scripts/build-word-usage.mjs exactly. Standard English function
// words, contractions and pure speech fillers; content-bearing words are kept.
const STOPWORDS = new Set(
	(
		`a an the and but or nor so if then than that this these those of to in on at for
		with as by from up out off over under into about above below again further once
		it its they them their theirs he she his her him hers we us our ours you your yours
		i me my mine is am are was were be been being do does did doing have has had having
		will would can could shall should may might must not no here there when where why how
		what which who whom whose all any both each few more most other some such only own
		same very too s t d ll m re o just now also because while during before after
		between against through above below
		dont doesnt didnt isnt arent wasnt werent havent hasnt hadnt wont wouldnt cant
		couldnt shouldnt im ive id ill youre youve youd youll were weve wed well theyre
		theyve theyd thats theres whats lets gonna wanna
		yeah yea okay ok oh um uh umm uhh hmm mm mmm mhm huh`
	)
		.split(/\s+/)
		.filter(Boolean)
);

// Extended stoplist: high-frequency conversational/discourse filler and vague
// words. Removing these is an editorial choice; domain terms (weight,
// medication, injection, doctor, …) are deliberately NOT here.
const FILLER_WORDS = new Set(
	(
		`know knows knew knowing think thinks thinking thought mean means meant
		one ones even get gets getting got gotten go goes going went gone
		definitely maybe actually really basically honestly probably literally
		obviously absolutely kind kinda sort sorta lot lots like liked likes
		thing things something anything everything nothing someone anyone everyone
		somebody anybody everybody way ways said say says saying tell tells telling
		told want wants wanted wanting much many good great guess guessed
		gonna wanna gotta come comes coming came make makes making made put puts
		putting let lets letting look looks looking looked right sure stuff bit
		pretty anyway anyways still able yes yep yup nope nah`
	)
		.split(/\s+/)
		.filter(Boolean)
);

/** The full stoplist applied during tokenization. */
export const STOPLIST: ReadonlySet<string> = new Set([...STOPWORDS, ...FILLER_WORDS]);

/**
 * Lowercase, normalise curly apostrophes, split into word tokens, and drop
 * stoplist words, single characters and pure-numeric tokens. Identical rules
 * to build-word-usage.mjs.
 */
export function tokenize(text: string, extraStopwords?: ReadonlySet<string>): string[] {
	const cleaned = text.toLowerCase().replace(/[‘’]/g, "'");
	const raw = cleaned.match(/[a-z0-9]+(?:['-][a-z0-9]+)*/g) ?? [];
	return raw
		.map((tok) => tok.replace(/^'+|'+$/g, ''))
		.filter((tok) => {
			if (tok.length < 2) return false;
			if (!/[a-z]/.test(tok)) return false;
			const bare = tok.replace(/'/g, '');
			if (STOPLIST.has(bare)) return false;
			if (extraStopwords?.has(bare)) return false;
			return true;
		});
}

// --- Analysis ------------------------------------------------------------

export type WordMode = 'common' | 'distinctive';

/** A piece of text with the sentiment (-2..2) of the segment it came from. */
export type ScopedText = { text: string; sentiment?: number };

/** One ranked word, ready to feed straight into <WordCloud> as `text`/`value`. */
export type CloudWord = {
	/** The word itself — the WordCloud `text` field. */
	text: string;
	/** Raw occurrences within the analysed scope. */
	count: number;
	/** count / total counted tokens in the scope. */
	frequency: number;
	/**
	 * log2 ratio of this word's scope frequency to its baseline frequency.
	 * > 0 means the scope over-indexes on the word (its distinctive voice);
	 * 0 when no baseline is supplied.
	 */
	distinctiveness: number;
	/**
	 * Average sentiment (-2..2) of the segments this word appeared in, weighted
	 * by occurrence. 0 when the input carried no sentiment.
	 */
	sentiment: number;
	/** The metric the cloud sizes on — `count` in common mode, `distinctiveness` in distinctive mode. */
	value: number;
};

export type WordFrequencyResult = {
	/** Ranked words, capped to `limit`, ordered by the chosen mode. */
	words: CloudWord[];
	/** Total counted tokens in the scope (after the stoplist). */
	totalWords: number;
	/** Distinct words in the scope. */
	uniqueWords: number;
	/** Words spoken exactly once — literally unique within this scope. */
	hapaxWords: string[];
};

export interface AnalyzeOptions {
	/** `common` ranks by raw count; `distinctive` ranks by over-indexing vs the baseline. Default `common`. */
	mode?: WordMode;
	/** Maximum words returned. Default 60. */
	limit?: number;
	/** Drop words below this count. Default 1 (common) / 2 (distinctive). */
	minCount?: number;
	/** word -> count for the comparison corpus, used to score distinctiveness. */
	baseline?: ReadonlyMap<string, number> | null;
	/** Extra words to exclude on top of the shared stoplist. */
	extraStopwords?: Iterable<string>;
}

/** Normalise the loose `texts` argument into a uniform list of scoped texts. */
function toScopedTexts(texts: string | readonly string[] | readonly ScopedText[]): ScopedText[] {
	if (typeof texts === 'string') return [{ text: texts }];
	return texts.map((t) => (typeof t === 'string' ? { text: t } : t));
}

/**
 * Tokenize and count an arbitrary bag of text, then rank the words.
 *
 * In `distinctive` mode each word is scored by how much more often it appears
 * here than in `baseline` — surfacing the vocabulary that sets this scope
 * apart rather than the words everyone uses. When the inputs carry a
 * `sentiment`, every word also gets the average sentiment of its segments.
 */
export function analyzeWords(
	texts: string | readonly string[] | readonly ScopedText[],
	options: AnalyzeOptions = {}
): WordFrequencyResult {
	const { mode = 'common', limit = 60, baseline = null } = options;
	const minCount = options.minCount ?? (mode === 'distinctive' ? 2 : 1);
	const extra = options.extraStopwords ? new Set(options.extraStopwords) : undefined;

	// Count every word in scope, and accumulate sentiment per word.
	const counts = new Map<string, number>();
	const sentimentSum = new Map<string, number>();
	const sentimentN = new Map<string, number>();
	let totalWords = 0;
	for (const { text, sentiment } of toScopedTexts(texts)) {
		const hasSentiment = sentiment != null && Number.isFinite(sentiment);
		for (const tok of tokenize(text, extra)) {
			counts.set(tok, (counts.get(tok) ?? 0) + 1);
			totalWords++;
			if (hasSentiment) {
				sentimentSum.set(tok, (sentimentSum.get(tok) ?? 0) + (sentiment as number));
				sentimentN.set(tok, (sentimentN.get(tok) ?? 0) + 1);
			}
		}
	}

	const uniqueWords = counts.size;
	const hapaxWords = [...counts]
		.filter(([, c]) => c === 1)
		.map(([w]) => w)
		.sort();

	// Baseline frequencies for distinctiveness. One pseudo-count of smoothing
	// keeps words absent from the baseline finite (and strongly distinctive).
	let baselineTotal = 0;
	if (baseline) for (const c of baseline.values()) baselineTotal += c;
	const smoothing = baselineTotal > 0 ? 1 / baselineTotal : 0;

	const words: CloudWord[] = [...counts].map(([text, count]) => {
		const frequency = totalWords > 0 ? count / totalWords : 0;
		let distinctiveness = 0;
		if (baseline && baselineTotal > 0) {
			const baseFreq = (baseline.get(text) ?? 0) / baselineTotal;
			distinctiveness = Math.log2((frequency + smoothing) / (baseFreq + smoothing));
		}
		const sn = sentimentN.get(text) ?? 0;
		const sentiment = sn > 0 ? (sentimentSum.get(text) ?? 0) / sn : 0;
		return {
			text,
			count,
			frequency,
			distinctiveness,
			sentiment,
			value: mode === 'distinctive' ? distinctiveness : count
		};
	});

	const ranked = words
		.filter((w) => w.count >= minCount)
		.sort((a, b) =>
			mode === 'distinctive'
				? b.distinctiveness - a.distinctiveness || b.count - a.count
				: b.count - a.count || a.text.localeCompare(b.text)
		)
		// In distinctive mode keep only words the scope actually over-indexes on.
		.filter((w) => (mode === 'distinctive' ? w.distinctiveness > 0 : true))
		.slice(0, limit);

	return { words: ranked, totalWords, uniqueWords, hapaxWords };
}

// --- Scoped convenience wrappers ----------------------------------------

/** segment_id -> sentiment (-2..2) from the per-segment annotations. */
const sentimentBySegment = new Map(annotations.map((a) => [a.segment_id, a.sentiment]));

/** word -> count across every participant's speech, summed from word_usage.json. */
function corpusCounts(excludeInterviewId?: string): Map<string, number> {
	const totals = new Map<string, number>();
	for (const [id, p] of Object.entries(wordUsage.by_participant)) {
		if (id === excludeInterviewId) continue;
		for (const { word, count } of p.word_usage) {
			totals.set(word, (totals.get(word) ?? 0) + count);
		}
	}
	return totals;
}

/**
 * Word cloud for one participant: every word they spoke across their coded
 * response segments, ranked, each carrying the average sentiment of the
 * segments it appeared in. `distinctive` mode compares them against the
 * *other* participants, surfacing the words that set this person apart.
 */
export function participantWords(
	interviewId: string,
	options: AnalyzeOptions = {}
): WordFrequencyResult {
	const texts: ScopedText[] = segments
		.filter((s) => s.interview_id === interviewId && s.speaker === 'participant')
		.map((s) => ({ text: s.text, sentiment: sentimentBySegment.get(s.segment_id) }));
	return analyzeWords(texts, { baseline: corpusCounts(interviewId), ...options });
}

/**
 * Word cloud for one theme: the words used across every response segment
 * tagged with the theme (pull quotes are curated subsets of these segments, so
 * counting segments alone covers the theme's quotes without double-counting).
 * Each word carries the average sentiment of its segments. `distinctive` mode
 * compares the theme against the whole corpus.
 */
export function themeWords(themeId: string, options: AnalyzeOptions = {}): WordFrequencyResult {
	const texts: ScopedText[] = segmentsForTheme(themeId).map((f) => ({
		text: f.text,
		sentiment: f.sentiment
	}));
	return analyzeWords(texts, { baseline: corpusCounts(), ...options });
}
