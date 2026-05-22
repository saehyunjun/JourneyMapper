import raw from './word_usage.json';

export type WordCount = { word: string; count: number };

export type QuestionGroup = {
	question: string;
	top_words: WordCount[];
	participant_breakdown: Record<string, WordCount[]>;
};

export type GlpWordData = {
	meta: {
		study: string;
		participants: string[];
		notes: string[];
	};
	overall_word_usage: WordCount[];
	question_groups: Record<string, QuestionGroup>;
};

type WordUsageFile = {
	meta: { study_id: string; notes: string[] };
	overall_word_usage: WordCount[];
	by_participant: Record<
		string,
		{ total_words: number; unique_words: number; word_usage: WordCount[] }
	>;
	question_groups: Record<string, QuestionGroup>;
};

const data = raw as WordUsageFile;

/**
 * Adapter onto the deterministic word_usage.json produced by
 * scripts/build-word-usage.mjs. (Replaces the earlier glpInterviewWordUsage.json,
 * whose counts were AI-estimated rather than code-counted.)
 */
export const glpWordData: GlpWordData = {
	meta: {
		study: 'GLP-1 Interviews',
		participants: Object.keys(data.by_participant),
		notes: data.meta.notes
	},
	overall_word_usage: data.overall_word_usage,
	question_groups: data.question_groups
};

/** "participant_09" -> "Participant 09" */
export function participantLabel(id: string): string {
	return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** One participant's words, ranked, pooled across every question. */
export function wordsForParticipant(id: string): WordCount[] {
	return data.by_participant[id]?.word_usage ?? [];
}
