/**
 * quiz.ts
 *
 * Typed loader for the booth quiz. Every question is a "rank the barrier":
 * the visitor guesses which of two options patients raised more often, and
 * the answer is resolved live against the study data — theme / subtheme
 * annotation counts (analysis.ts) or keyword counts (keyword_usage.json),
 * never hard-coded. Also builds the results-page "blind spot" brief.
 *
 * Backs the booth quiz at /wctglpdemo/quiz.
 */
import quizRaw from './quiz.json';
import { quotes, themeCounts, titleCase, annotations, fragmentsMatching } from './analysis';
import keywordUsageRaw from './keyword_usage.json';
import profilesRaw from './participant_profiles.json';

type RankOptionRaw = {
	key: string;
	label: string;
	sublabel: string;
	/** Codebook theme / subtheme ids this option stands for. */
	theme_ids?: string[];
	/** keyword_lexicon ids this option stands for (e.g. drug names). */
	keyword_ids?: string[];
};

type DomainRaw = { label: string; wctEdge: string };

type QuestionRaw = {
	id: string;
	type: 'rank_barrier';
	kicker: string;
	prompt: string;
	options: RankOptionRaw[];
	domain: DomainRaw;
	takeaway: string;
};

type QuizFile = {
	meta: Record<string, unknown>;
	questions: QuestionRaw[];
	leaderboard: {
		seed_players: number;
		votes: Record<string, Record<string, number>>;
	};
};

const quiz = quizRaw as QuizFile;

/** A barrier option, with its count resolved from the live study data. */
export type RankOption = {
	key: string;
	label: string;
	sublabel: string;
	/** Codebook theme / subtheme ids — empty for keyword-only options. */
	themeIds: string[];
	/** Coded mentions of this option across every interview. */
	count: number;
};

/** The competency a question probes, plus its matching WCT capability. */
export type QuizDomain = { label: string; wctEdge: string };

export type QuizQuestion = {
	id: string;
	type: 'rank_barrier';
	kicker: string;
	prompt: string;
	options: RankOption[];
	/** The option key with the higher count — computed, never authored. */
	correctKey: string;
	domain: QuizDomain;
	takeaway: string;
};

// theme / subtheme id -> live annotation count. themeCounts() covers themes;
// subthemes are tallied straight from the annotations so a rank question can
// pit two subthemes (e.g. nutrition vs. medication education) against each other.
const countById = new Map<string, number>(themeCounts().map((t) => [t.id, t.count]));
for (const a of annotations)
	for (const s of a.subthemes) countById.set(s, (countById.get(s) ?? 0) + 1);

// keyword id -> corpus-wide mention count, from keyword_usage.json.
const countByKeyword = new Map<string, number>();
for (const c of (keywordUsageRaw as { categories: { keywords: { id: string; count: number }[] }[] })
	.categories)
	for (const kw of c.keywords) countByKeyword.set(kw.id, kw.count);

/** Resolve an option's count from whichever data source it references. */
const optionCount = (o: RankOptionRaw): number =>
	(o.theme_ids ?? []).reduce((n, id) => n + (countById.get(id) ?? 0), 0) +
	(o.keyword_ids ?? []).reduce((n, id) => n + (countByKeyword.get(id) ?? 0), 0);

const profiles = (
	profilesRaw as { profiles: Record<string, { first_name: string; age_range: string }> }
).profiles;

/** "Isabelle · 41–45" for the interview a quote came from. */
function attributionFor(interviewId: string): string {
	const p = profiles[interviewId];
	return p ? `${p.first_name} · ${p.age_range}` : titleCase(interviewId);
}

/** The quiz questions, each resolved against the live study data. */
export const quizQuestions: QuizQuestion[] = quiz.questions.map((q) => {
	const options: RankOption[] = q.options.map((o) => ({
		key: o.key,
		label: o.label,
		sublabel: o.sublabel,
		themeIds: o.theme_ids ?? [],
		count: optionCount(o)
	}));
	return {
		id: q.id,
		type: 'rank_barrier',
		kicker: q.kicker,
		prompt: q.prompt,
		options,
		correctKey: [...options].sort((a, b) => b.count - a.count)[0].key,
		domain: q.domain,
		takeaway: q.takeaway
	};
});

/**
 * Seeded conference-goer vote tallies, keyed by question id then option key.
 * The page layers this booth session's localStorage votes on top.
 */
export const leaderboardSeed = quiz.leaderboard;

/** One verbatim patient quote for the blind-spot brief. */
export type BriefQuote = {
	text: string;
	/** "Isabelle · 41–45", or the participant id when no profile exists. */
	attribution: string;
	sentiment: number;
};

/** The evidence for one barrier theme — its label, weight, and sample quotes. */
export type ThemeBrief = {
	themeId: string;
	/** The quiz-friendly name for the theme, e.g. "Its side effects". */
	label: string;
	/** Coded segment mentions of this theme across every interview. */
	mentions: number;
	/** Up to three representative verbatim quotes. */
	quotes: BriefQuote[];
};

// theme / subtheme id -> the quiz option label it appears under.
const themeLabel = new Map<string, string>();
for (const q of quiz.questions)
	for (const o of q.options) for (const t of o.theme_ids ?? []) themeLabel.set(t, o.label);

const wordCount = (s: string) => s.trim().split(/\s+/).length;

/**
 * The "trial blind spot" brief: for each theme, its mention count and a few
 * verbatim quotes. Curated quote-bank quotes come first (best score first);
 * if a theme has fewer than three, real coded segments fill the rest. All
 * text is verbatim from the interviews — nothing here is generated.
 */
export function barrierBrief(themeIds: string[]): ThemeBrief[] {
	const seen = new Set<string>();
	const briefs: ThemeBrief[] = [];
	for (const tid of themeIds) {
		if (seen.has(tid)) continue;
		seen.add(tid);

		const picks: BriefQuote[] = quotes
			.filter((q) => q.themes.includes(tid) || q.subthemes.includes(tid))
			.sort((a, b) => b.quote_score.overall - a.quote_score.overall)
			.map((q) => ({
				text: q.text,
				attribution: attributionFor(q.interview_id),
				sentiment: q.sentiment
			}));

		if (picks.length < 3) {
			const segs = fragmentsMatching((a) => a.themes.includes(tid) || a.subthemes.includes(tid))
				.filter((s) => wordCount(s.text) >= 12 && wordCount(s.text) <= 55)
				.sort((a, b) => b.text.length - a.text.length);
			for (const s of segs) {
				if (picks.length >= 3) break;
				if (picks.some((p) => p.text === s.text)) continue;
				picks.push({
					text: s.text,
					attribution: attributionFor(s.interview_id),
					sentiment: s.sentiment
				});
			}
		}

		briefs.push({
			themeId: tid,
			label: themeLabel.get(tid) ?? titleCase(tid),
			mentions: countById.get(tid) ?? 0,
			quotes: picks.slice(0, 3)
		});
	}
	return briefs;
}
