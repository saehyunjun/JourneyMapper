/**
 * Segment tagging — server load + action.
 *
 * The interactive counterpart to scripts/build-segment-tags.mjs (pipeline step
 * 5). An analyst picks theme / subtheme / emotion / sentiment / semantic tags
 * for each participant segment of one interview; on save, human annotations are
 * merged into segment_tags.json and the interview moves from `pending` to
 * `tagged`.
 *
 * Tag values are validated against codebook.json — the same integrity rules
 * the build script enforces (known ids only; a subtheme requires its parent
 * theme; sentiment in -2..2).
 *
 * Note: writes into the source tree, so this is a dev/demo-time operation.
 */
import { fail } from '@sveltejs/kit';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Actions, PageServerLoad } from './$types';
import codebook from '$lib/content/wctglpdemo-data/codebook.json';

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const SEGMENTS_PATH = `${DATA_DIR}/segments.json`;
const TAGS_PATH = `${DATA_DIR}/segment_tags.json`;
const STRUCTURED_PATH = `${DATA_DIR}/interviews_structured.json`;

type Turn = { turn_index: number; speaker: string; text: string };

type Segment = {
	segment_id: string;
	interview_id: string;
	turn_index: number;
	segment_index: number;
	question_id: string | null;
	text: string;
	word_count: number;
	flags: string[];
};

type Annotation = {
	segment_id: string;
	interview_id: string;
	question_id: string | null;
	themes: string[];
	subthemes: string[];
	emotions: string[];
	sentiment: number;
	semantic_tags: string[];
	confidence: number;
	source: string;
	review_status: string;
	reviewer_notes: string;
};

const read = (path: string) => JSON.parse(readFileSync(resolve(path), 'utf8'));

// Codebook lookups — shared by load (none) and the save validation.
const THEME_IDS = new Set(codebook.theme_tags.map((t) => t.id));
const EMOTION_IDS = new Set(codebook.emotion_tags.map((e) => e.id));
const SEMANTIC_IDS = new Set(codebook.semantic_tags.map((s) => s.id));
const SUBTHEME_PARENT = new Map<string, string>();
for (const t of codebook.theme_tags) {
	for (const s of (t as { subthemes?: { id: string }[] }).subthemes ?? []) {
		SUBTHEME_PARENT.set(s.id, t.id);
	}
}

export const load: PageServerLoad = ({ url }) => {
	const segData = read(SEGMENTS_PATH);
	const tagData = read(TAGS_PATH);
	const structured = read(STRUCTURED_PATH);

	const tagged = new Set<string>(tagData.meta.tagged_interviews ?? []);
	const allIds: string[] = [
		...new Set<string>((segData.segments as Segment[]).map((s) => s.interview_id))
	].sort();

	const interviewOptions = allIds.map((id) => ({
		id,
		status: (tagged.has(id) ? 'tagged' : 'pending') as 'tagged' | 'pending',
		segmentCount: (segData.segments as Segment[]).filter((s) => s.interview_id === id).length
	}));

	// Default to the first interview still pending tagging.
	const requested = url.searchParams.get('interview');
	const interviewId =
		requested && allIds.includes(requested)
			? requested
			: (interviewOptions.find((o) => o.status === 'pending')?.id ?? allIds[0] ?? null);

	if (!interviewId) {
		const empty: Record<string, Annotation> = {};
		return {
			interviewOptions,
			interviewId: null,
			turns: [] as Turn[],
			segments: [] as Segment[],
			existing: empty
		};
	}

	const interview = structured.interviews.find(
		(iv: { interview_id: string }) => iv.interview_id === interviewId
	);
	const turns: Turn[] = interview?.turns ?? [];

	const segments = (segData.segments as Segment[])
		.filter((s) => s.interview_id === interviewId)
		.sort((a, b) => a.turn_index - b.turn_index || a.segment_index - b.segment_index);

	// Existing annotations (re-tagging, or AI-proposed tags) prefill the form.
	const existing: Record<string, Annotation> = {};
	for (const a of tagData.annotations as Annotation[]) {
		if (a.interview_id === interviewId) existing[a.segment_id] = a;
	}

	return { interviewOptions, interviewId, turns, segments, existing };
};

export const actions: Actions = {
	saveTags: async ({ request }) => {
		const fd = await request.formData();
		const interviewId = String(fd.get('interviewId') ?? '').trim();
		if (!interviewId) return fail(400, { error: 'Missing interview id.' });

		let perSegment: Record<string, Partial<Annotation> & { discarded?: boolean }>;
		try {
			perSegment = JSON.parse(String(fd.get('annotations') ?? '{}'));
		} catch {
			return fail(400, { error: 'Invalid tag data.' });
		}

		const segData = read(SEGMENTS_PATH);
		const segments = (segData.segments as Segment[]).filter(
			(s) => s.interview_id === interviewId
		);
		if (segments.length === 0) {
			return fail(404, { error: `No segments found for ${interviewId}.` });
		}

		// One annotation per participant segment — empty tags are allowed (admin
		// or no-analytic-content segments), matching the build script.
		const annotations: Annotation[] = [];
		for (const seg of segments) {
			const raw = perSegment[seg.segment_id] ?? {};
			const note = typeof raw.reviewer_notes === 'string' ? raw.reviewer_notes.trim() : '';

			// A discarded segment carries no tags — just the review_status.
			if (raw.discarded) {
				annotations.push({
					segment_id: seg.segment_id,
					interview_id: interviewId,
					question_id: seg.question_id ?? null,
					themes: [],
					subthemes: [],
					emotions: [],
					sentiment: 0,
					semantic_tags: [],
					confidence: 1,
					source: 'human',
					review_status: 'discarded',
					reviewer_notes: note
				});
				continue;
			}

			const themes = [...new Set(Array.isArray(raw.themes) ? raw.themes : [])];
			const subthemes = [...new Set(Array.isArray(raw.subthemes) ? raw.subthemes : [])];
			const emotions = [...new Set(Array.isArray(raw.emotions) ? raw.emotions : [])];
			const semanticTags = [...new Set(Array.isArray(raw.semantic_tags) ? raw.semantic_tags : [])];
			let sentiment = Number(raw.sentiment ?? 0);
			if (!Number.isInteger(sentiment) || sentiment < -2 || sentiment > 2) sentiment = 0;

			for (const t of themes) {
				if (!THEME_IDS.has(t)) return fail(400, { error: `Unknown theme "${t}".` });
			}
			for (const e of emotions) {
				if (!EMOTION_IDS.has(e)) return fail(400, { error: `Unknown emotion "${e}".` });
			}
			for (const s of semanticTags) {
				if (!SEMANTIC_IDS.has(s)) return fail(400, { error: `Unknown semantic tag "${s}".` });
			}
			for (const s of subthemes) {
				const parent = SUBTHEME_PARENT.get(s);
				if (!parent) return fail(400, { error: `Unknown subtheme "${s}".` });
				if (!themes.includes(parent)) {
					return fail(400, {
						error: `Subtheme "${s}" needs its parent theme "${parent}" on segment ${seg.segment_id}.`
					});
				}
			}

			annotations.push({
				segment_id: seg.segment_id,
				interview_id: interviewId,
				question_id: seg.question_id ?? null,
				themes,
				subthemes,
				emotions,
				sentiment,
				semantic_tags: semanticTags,
				confidence: 1,
				source: 'human',
				review_status: 'confirmed',
				reviewer_notes: note
			});
		}

		// Merge: replace this interview's annotations, keep the rest.
		const tagData = read(TAGS_PATH);
		tagData.annotations = (tagData.annotations as Annotation[]).filter(
			(a) => a.interview_id !== interviewId
		);
		tagData.annotations.push(...annotations);
		tagData.annotations.sort((a: Annotation, b: Annotation) =>
			a.segment_id.localeCompare(b.segment_id)
		);

		tagData.meta.tagged_interviews = [
			...new Set<string>([...(tagData.meta.tagged_interviews ?? []), interviewId])
		].sort();
		tagData.meta.pending_interviews = (tagData.meta.pending_interviews ?? []).filter(
			(id: string) => id !== interviewId
		);
		tagData.meta.generated_at = new Date().toISOString();
		writeFileSync(resolve(TAGS_PATH), JSON.stringify(tagData, null, 2) + '\n', 'utf8');

		return {
			success: true,
			interviewId,
			segmentCount: annotations.length,
			themedCount: annotations.filter((a) => a.themes.length > 0).length,
			discardedCount: annotations.filter((a) => a.review_status === 'discarded').length
		};
	}
};
