/**
 * Key-phrase bank — page loader.
 *
 * Reads phrase_lexicon.json fresh on each request so edits made from the
 * segment-tag drawer show up after a refresh. Pairs each variant's segment_id
 * with the segment text from segments.json, so the bank can display the full
 * quote (not just the highlighted snippet) for context.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PageServerLoad } from './$types';
import type { KeyPhrase } from '$lib/server/phrases';

const DATA_DIR = 'src/lib/content/wctglpdemo-data';

type Segment = {
	segment_id: string;
	interview_id: string;
	text: string;
};

export const load: PageServerLoad = () => {
	const phrases = JSON.parse(
		readFileSync(resolve(`${DATA_DIR}/phrase_lexicon.json`), 'utf8')
	) as { key_phrases: KeyPhrase[] };
	const segments = JSON.parse(
		readFileSync(resolve(`${DATA_DIR}/segments.json`), 'utf8')
	) as { segments: Segment[] };

	const segmentText = new Map(segments.segments.map((s) => [s.segment_id, s.text]));

	return {
		keyPhrases: phrases.key_phrases ?? [],
		segmentText: Object.fromEntries(segmentText)
	};
};
