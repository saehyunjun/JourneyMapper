/**
 * Autotag pipeline — in-process port of scripts/propose-questions.mjs,
 * scripts/propose-segment-tags.mjs, and scripts/build-segment-tags.mjs.
 *
 * Lets the upload action run the AI judgement chain inline on Vercel, where
 * child processes aren't available. Each step reads and writes via the KV
 * shim, so dev (fs) and prod (KV) share one code path. The standalone .mjs
 * scripts are unchanged — they remain the source of truth for CLI runs.
 *
 * Requires ANTHROPIC_API_KEY in the environment.
 */
import Anthropic from '@anthropic-ai/sdk';
import bundledStructured from '$lib/content/wctglpdemo-data/interviews_structured.json';
import bundledSegments from '$lib/content/wctglpdemo-data/segments.json';
import bundledQuestions from '$lib/content/wctglpdemo-data/questions.json';
import bundledQuestionMap from '$lib/content/wctglpdemo-data/question_map.json';
import bundledCodebook from '$lib/content/wctglpdemo-data/codebook.json';
import bundledProposed from '$lib/content/wctglpdemo-data/segment_tags.proposed.json';
import bundledTopics from '$lib/content/wctglpdemo-data/topics.json';
import bundledTopicAssignments from '$lib/content/wctglpdemo-data/topic_tags.proposed.json';
import { loadDoc, saveDoc } from './kv-store';

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const STRUCTURED_PATH = `${DATA_DIR}/interviews_structured.json`;
const QUESTION_MAP_PATH = `${DATA_DIR}/question_map.json`;
const SEGMENTS_PATH = `${DATA_DIR}/segments.json`;
const PROPOSED_PATH = `${DATA_DIR}/segment_tags.proposed.json`;
const TAGS_PATH = `${DATA_DIR}/segment_tags.json`;

const STRUCTURED_KEY = 'wctglpdemo:interviews_structured';
const QUESTION_MAP_KEY = 'wctglpdemo:question_map';
const SEGMENTS_KEY = 'wctglpdemo:segments';
const PROPOSED_KEY = 'wctglpdemo:segment_tags_proposed';
const TAGS_KEY = 'wctglpdemo:segment_tags';

const MODEL = 'claude-opus-4-7';

// --- Shared types ---------------------------------------------------------

type Turn = {
	turn_index: number;
	speaker: string;
	text: string;
};

type Interview = {
	interview_id: string;
	turns: Turn[];
	[k: string]: unknown;
};

type StructuredFile = {
	meta: { study_id: string; [k: string]: unknown };
	interviews: Interview[];
};

type Segment = {
	segment_id: string;
	interview_id: string;
	turn_index: number;
	segment_index: number;
	question_id: string | null;
	flags: string[];
	text: string;
	[k: string]: unknown;
};

type SegmentsFile = {
	meta: { study_id: string; generated_at?: string; segment_count?: number; [k: string]: unknown };
	segments: Segment[];
};

type QuestionMapEntry = {
	interview_id: string;
	mapping_count: number;
	mappings: {
		turn_index: number;
		question_id: string;
		turn_role: string;
		confidence: number;
		source: string;
		review_status: string;
		reviewer_notes: string;
	}[];
};

type QuestionMapFile = {
	meta: Record<string, unknown>;
	interviews: QuestionMapEntry[];
};

type CodebookTheme = { id: string; subthemes?: { id: string }[] };
type CodebookFile = {
	meta: { schema_version: string; sentiment_scale?: unknown; [k: string]: unknown };
	themes: CodebookTheme[];
	emotion_tags: { id: string }[];
};

type Proposal = {
	themes: string[];
	subthemes: string[];
	emotions: string[];
	sentiment: number;
	confidence: number;
	note: string;
};

type ProposedFile = {
	meta: Record<string, unknown>;
	proposals: Record<string, Proposal>;
};

type Annotation = {
	segment_id: string;
	interview_id: string;
	question_id: string | null;
	topics: string[];
	themes: string[];
	subthemes: string[];
	emotions: string[];
	sentiment: number;
	confidence: number;
	source: 'ai_proposed' | 'human';
	review_status: 'pending' | 'confirmed' | 'discarded';
	reviewer_notes: string;
};

type TagsFile = {
	meta: { tagged_interviews?: string[]; pending_interviews?: string[]; [k: string]: unknown };
	annotations: Annotation[];
};

// --- Step 1: propose questions for one interview --------------------------

const QUESTION_ROLES = ['question', 'probe', 'acknowledgment', 'admin'];

function buildQuestionSystemPrompt(questions: typeof bundledQuestions.questions): string {
	return `You normalize interviewer turns in research-interview transcripts to a fixed bank of canonical study questions, for the WCT GLP-1 weight-maintenance trial study.

You are given the full transcript of one interview as an ordered list of turns (interviewer and participant). Map EVERY interviewer turn — and only interviewer turns — to:
- turn_index: the turn's index, copied exactly from the input.
- question_id: the canonical question from the QUESTION BANK below that this turn belongs to. A turn that newly poses a question takes that question's id; a follow-up/probe or an acknowledgment takes the id of the question topic currently open.
- turn_role: one of
    "question"        — poses a canonical question for the first time in the interview.
    "probe"           — follow-up, clarification, or sub-item within an already-open question.
    "acknowledgment"  — no question (e.g. "Oh, okay"); inherits the surrounding topic for response continuity.
    "admin"           — logistics, introduction, or closing; not analytical content.
- confidence: your confidence in the mapping, 0.0–1.0.
- note: a short reviewer note, or "" if none. Use it to flag ambiguity or explain a low-confidence call.

Rules:
- Read the participant turns for context, but return a mapping ONLY for interviewer turns.
- Return exactly one mapping per interviewer turn. Do not map participant turns.
- Use ONLY question_ids from the bank below. Do not invent ids.
- Interviews do not always follow the guide order; match on what the turn is actually asking, not its position.

QUESTION BANK — the only valid question_ids:
${JSON.stringify(questions, null, 2)}`;
}

/**
 * Map every interviewer turn of one interview to a canonical question_id.
 * Writes the result into question_map and propagates question_id into segments
 * (each participant segment inherits the most recent mapped interviewer turn).
 */
export async function proposeQuestions(interviewId: string): Promise<void> {
	const [structured, questionMap, segData] = await Promise.all([
		loadDoc<StructuredFile>(STRUCTURED_KEY, STRUCTURED_PATH, bundledStructured as StructuredFile),
		loadDoc<QuestionMapFile>(QUESTION_MAP_KEY, QUESTION_MAP_PATH, bundledQuestionMap as QuestionMapFile),
		loadDoc<SegmentsFile>(SEGMENTS_KEY, SEGMENTS_PATH, bundledSegments as SegmentsFile)
	]);

	const interview = structured.interviews.find((iv) => iv.interview_id === interviewId);
	if (!interview) throw new Error(`Unknown interview "${interviewId}".`);

	const questionIds = bundledQuestions.questions.map((q) => q.question_id);
	const validQuestionIds = new Set(questionIds);

	const responseSchema = {
		type: 'object',
		additionalProperties: false,
		properties: {
			mappings: {
				type: 'array',
				items: {
					type: 'object',
					additionalProperties: false,
					properties: {
						turn_index: { type: 'integer' },
						question_id: { type: 'string', enum: questionIds },
						turn_role: { type: 'string', enum: QUESTION_ROLES },
						confidence: { type: 'number' },
						note: { type: 'string' }
					},
					required: ['turn_index', 'question_id', 'turn_role', 'confidence', 'note']
				}
			}
		},
		required: ['mappings']
	};

	const interviewerIndices = interview.turns
		.filter((t) => t.speaker === 'interviewer')
		.map((t) => t.turn_index);

	const payload = interview.turns.map((t) => ({
		turn_index: t.turn_index,
		speaker: t.speaker,
		text: t.text
	}));

	const client = new Anthropic();
	const stream = client.messages.stream({
		model: MODEL,
		max_tokens: 16000,
		thinking: { type: 'adaptive' },
		output_config: { effort: 'high', format: { type: 'json_schema', schema: responseSchema } },
		system: [
			{
				type: 'text',
				text: buildQuestionSystemPrompt(bundledQuestions.questions),
				cache_control: { type: 'ephemeral' }
			}
		],
		messages: [
			{
				role: 'user',
				content:
					`Map every interviewer turn of interview "${interviewId}". ` +
					`Return exactly one mapping per interviewer turn, keyed by turn_index. ` +
					`Turns, in transcript order:\n\n${JSON.stringify(payload, null, 2)}`
			}
		]
	});
	const msg = await stream.finalMessage();
	if (msg.stop_reason === 'max_tokens') {
		throw new Error(`${interviewId}: response hit max_tokens — output truncated.`);
	}
	if (msg.stop_reason === 'refusal') throw new Error(`${interviewId}: model refused to respond.`);

	const textBlock = msg.content.find((b) => b.type === 'text');
	if (!textBlock || textBlock.type !== 'text') {
		throw new Error(`${interviewId}: no text block in response.`);
	}
	const parsed = JSON.parse(textBlock.text) as {
		mappings: { turn_index: number; question_id: string; turn_role: string; confidence: number; note?: string }[];
	};
	if (!Array.isArray(parsed.mappings)) {
		throw new Error(`${interviewId}: response had no "mappings" array.`);
	}

	const got = new Map(parsed.mappings.map((m) => [m.turn_index, m]));
	const expected = new Set(interviewerIndices);
	const missing = interviewerIndices.filter((idx) => !got.has(idx));
	const extra = [...got.keys()].filter((idx) => !expected.has(idx));
	if (missing.length || extra.length || got.size !== parsed.mappings.length) {
		throw new Error(
			`${interviewId}: coverage mismatch (missing=${missing.length}, extra=${extra.length}).`
		);
	}

	const mappings = interviewerIndices
		.sort((a, b) => a - b)
		.map((idx) => {
			const m = got.get(idx)!;
			if (!validQuestionIds.has(m.question_id)) {
				throw new Error(`${interviewId} turn ${idx}: unknown question_id "${m.question_id}".`);
			}
			return {
				turn_index: idx,
				question_id: m.question_id,
				turn_role: m.turn_role,
				confidence: m.confidence,
				source: 'ai_proposed',
				review_status: 'pending',
				reviewer_notes: m.note ?? ''
			};
		});

	// Upsert into question_map.
	const mapByInterview = new Map(questionMap.interviews.map((iv) => [iv.interview_id, iv]));
	mapByInterview.set(interviewId, {
		interview_id: interviewId,
		mapping_count: mappings.length,
		mappings
	});
	questionMap.interviews = [...mapByInterview.values()].sort((a, b) =>
		a.interview_id.localeCompare(b.interview_id)
	);
	questionMap.meta = {
		...questionMap.meta,
		generated_at: new Date().toISOString(),
		generator: 'autotag-pipeline',
		labels_status: 'ai_proposed',
		model: MODEL
	};
	await saveDoc(QUESTION_MAP_KEY, QUESTION_MAP_PATH, questionMap);

	// Propagate question_id into segments for this interview.
	const sortedMappings = [...mappings].sort((a, b) => a.turn_index - b.turn_index);
	const inheritedQuestionId = (turnIndex: number): string | null => {
		let qid: string | null = null;
		for (const m of sortedMappings) {
			if (m.turn_index < turnIndex) qid = m.question_id ?? null;
			else break;
		}
		return qid;
	};
	let touched = 0;
	for (const s of segData.segments) {
		if (s.interview_id !== interviewId) continue;
		s.question_id = inheritedQuestionId(s.turn_index);
		touched++;
	}
	if (touched > 0) {
		segData.meta.generated_at = new Date().toISOString();
		await saveDoc(SEGMENTS_KEY, SEGMENTS_PATH, segData);
	}
}

// --- Step 2: propose segment tags for one interview -----------------------

function buildTagsSystemPrompt(codebook: CodebookFile): string {
	return `You are a qualitative-research analyst tagging interview-transcript segments for the WCT GLP-1 study.

Each segment is one sentence of participant speech. For every segment you are given, assign:
- themes: theme ids the segment is genuinely about (0 or more).
- subthemes: subtheme ids (0 or more). A subtheme may ONLY be used if its parent theme is also in "themes".
- emotions: emotion ids the participant expresses (0 or more; often none — do not over-tag).
- sentiment: an integer on the scale below.
- confidence: your confidence in the annotation, 0.0–1.0.
- note: a short reviewer note, or "" if none. Use it to flag ambiguity or explain a low-confidence call.

Guidance:
- Admin exchanges, bare affirmations ("Yeah", "mm-hmm"), and content-free fragments get empty tag arrays, sentiment 0, confidence ~0.5, and a note saying why.
- Segments flagged "very_short" are usually low-confidence.
- Apply a theme only when the segment is substantively about it — not on a passing mention.
- Read the surrounding segments (same interview, in transcript order) for context, but tag each segment on its own content.
- Use ONLY the tag ids in the codebook below. Do not invent ids.

Sentiment scale:
${JSON.stringify(codebook.meta.sentiment_scale, null, 2)}

CODEBOOK — the only valid tag ids:

THEMES (with their subthemes):
${JSON.stringify(codebook.themes, null, 2)}

EMOTIONS:
${JSON.stringify(codebook.emotion_tags, null, 2)}`;
}

/**
 * Tag every segment of one interview. Writes the proposals into the
 * segment_tags.proposed doc (preserving proposals for other interviews, and
 * pruning any whose segment_id no longer exists in segments).
 */
export async function proposeSegmentTags(interviewId: string): Promise<void> {
	const [segData, codebook, existing] = await Promise.all([
		loadDoc<SegmentsFile>(SEGMENTS_KEY, SEGMENTS_PATH, bundledSegments as SegmentsFile),
		loadDoc<CodebookFile>('wctglpdemo:codebook', `${DATA_DIR}/codebook.json`, bundledCodebook as CodebookFile),
		loadDoc<ProposedFile>(PROPOSED_KEY, PROPOSED_PATH, bundledProposed as ProposedFile)
	]);

	const segs = segData.segments.filter((s) => s.interview_id === interviewId);
	if (segs.length === 0) throw new Error(`No segments for interview "${interviewId}".`);

	// Prune stale proposal keys whose segments no longer exist.
	const currentSegmentIds = new Set(segData.segments.map((s) => s.segment_id));
	const proposals: Record<string, Proposal> = {};
	for (const [id, p] of Object.entries(existing.proposals ?? {})) {
		if (currentSegmentIds.has(id)) proposals[id] = p;
	}

	const themeIds = codebook.themes.map((t) => t.id);
	const subthemeIds = codebook.themes.flatMap((t) => (t.subthemes ?? []).map((s) => s.id));
	const emotionIds = codebook.emotion_tags.map((e) => e.id);

	const annotationSchema = {
		type: 'object',
		additionalProperties: false,
		properties: {
			annotations: {
				type: 'array',
				items: {
					type: 'object',
					additionalProperties: false,
					properties: {
						segment_id: { type: 'string' },
						themes: { type: 'array', items: { type: 'string', enum: themeIds } },
						subthemes: { type: 'array', items: { type: 'string', enum: subthemeIds } },
						emotions: { type: 'array', items: { type: 'string', enum: emotionIds } },
						sentiment: { type: 'integer', enum: [-2, -1, 0, 1, 2] },
						confidence: { type: 'number' },
						note: { type: 'string' }
					},
					required: [
						'segment_id',
						'themes',
						'subthemes',
						'emotions',
						'sentiment',
						'confidence',
						'note'
					]
				}
			}
		},
		required: ['annotations']
	};

	const payload = segs.map((s) => ({
		segment_id: s.segment_id,
		turn_index: s.turn_index,
		segment_index: s.segment_index,
		question_id: s.question_id,
		flags: s.flags,
		text: s.text
	}));

	const client = new Anthropic();
	const stream = client.messages.stream({
		model: MODEL,
		max_tokens: 32000,
		thinking: { type: 'adaptive' },
		output_config: { effort: 'high', format: { type: 'json_schema', schema: annotationSchema } },
		system: [
			{
				type: 'text',
				text: buildTagsSystemPrompt(codebook),
				cache_control: { type: 'ephemeral' }
			}
		],
		messages: [
			{
				role: 'user',
				content:
					`Tag every segment of interview "${interviewId}". ` +
					`Return exactly one annotation per segment, using the same segment_id. ` +
					`Segments, in transcript order:\n\n${JSON.stringify(payload, null, 2)}`
			}
		]
	});
	const msg = await stream.finalMessage();
	if (msg.stop_reason === 'max_tokens') {
		throw new Error(`${interviewId}: response hit max_tokens — output truncated.`);
	}
	if (msg.stop_reason === 'refusal') throw new Error(`${interviewId}: model refused to respond.`);

	const textBlock = msg.content.find((b) => b.type === 'text');
	if (!textBlock || textBlock.type !== 'text') {
		throw new Error(`${interviewId}: no text block in response.`);
	}
	const parsed = JSON.parse(textBlock.text) as {
		annotations: (Proposal & { segment_id: string })[];
	};
	if (!Array.isArray(parsed.annotations)) {
		throw new Error(`${interviewId}: response had no "annotations" array.`);
	}

	const got = new Map(parsed.annotations.map((a) => [a.segment_id, a]));
	const expected = segs.map((s) => s.segment_id);
	const missing = expected.filter((id) => !got.has(id));
	const extra = [...got.keys()].filter((id) => !expected.includes(id));
	if (missing.length || extra.length || got.size !== parsed.annotations.length) {
		throw new Error(
			`${interviewId}: coverage mismatch (missing=${missing.length}, extra=${extra.length}).`
		);
	}

	for (const id of expected) {
		const a = got.get(id)!;
		proposals[id] = {
			themes: a.themes,
			subthemes: a.subthemes,
			emotions: a.emotions,
			sentiment: a.sentiment,
			confidence: a.confidence,
			note: a.note ?? ''
		};
	}

	const output: ProposedFile = {
		meta: {
			...existing.meta,
			schema_version: '1.0',
			study_id: segData.meta.study_id,
			generated_at: new Date().toISOString(),
			generator: 'autotag-pipeline',
			model: MODEL,
			codebook_schema_version: codebook.meta.schema_version
		},
		proposals: Object.fromEntries(Object.keys(proposals).sort().map((k) => [k, proposals[k]]))
	};
	await saveDoc(PROPOSED_KEY, PROPOSED_PATH, output);
}

// --- Step 3: build segment_tags (validation, no LLM) ----------------------

/**
 * Validate AI-proposed tags against the codebook and emit segment_tags.
 * Pure data — no Claude calls. Preserves human-confirmed annotations from
 * the existing segment_tags doc; only ai_proposed entries are regenerated.
 */
export async function buildSegmentTags(): Promise<void> {
	const [segData, codebook, proposedData, existingTags] = await Promise.all([
		loadDoc<SegmentsFile>(SEGMENTS_KEY, SEGMENTS_PATH, bundledSegments as SegmentsFile),
		loadDoc<CodebookFile>('wctglpdemo:codebook', `${DATA_DIR}/codebook.json`, bundledCodebook as CodebookFile),
		loadDoc<ProposedFile>(PROPOSED_KEY, PROPOSED_PATH, bundledProposed as ProposedFile),
		loadDoc<TagsFile>(TAGS_KEY, TAGS_PATH, { meta: {}, annotations: [] } as TagsFile)
	]);

	const PROPOSALS = proposedData.proposals ?? {};

	const topicAssignmentsFile = bundledTopicAssignments as {
		assignments?: Record<string, string[]>;
	};
	const topicsFile = bundledTopics as { topics: { id: string }[] };
	const topicAssignments = topicAssignmentsFile.assignments ?? {};
	const validTopics = new Set(topicsFile.topics?.map((t) => t.id) ?? []);
	const topicsStatus =
		Object.keys(topicAssignments).length > 0 && validTopics.size > 0 ? 'present' : 'not_run';

	const validThemes = new Set(codebook.themes.map((t) => t.id));
	const validEmotions = new Set(codebook.emotion_tags.map((t) => t.id));
	const subthemeParent = new Map<string, string>();
	for (const theme of codebook.themes) {
		for (const sub of theme.subthemes ?? []) subthemeParent.set(sub.id, theme.id);
	}

	const segmentsById = new Map(segData.segments.map((s) => [s.segment_id, s]));
	const segmentsByInterview = new Map<string, Segment[]>();
	for (const s of segData.segments) {
		if (!segmentsByInterview.has(s.interview_id)) segmentsByInterview.set(s.interview_id, []);
		segmentsByInterview.get(s.interview_id)!.push(s);
	}

	const errors: string[] = [];

	for (const id of Object.keys(PROPOSALS)) {
		if (!segmentsById.has(id)) errors.push(`Proposal for unknown segment_id "${id}".`);
	}

	const taggedInterviews: string[] = [];
	const pendingInterviews: string[] = [];
	for (const [interviewId, segs] of [...segmentsByInterview].sort((a, b) =>
		a[0].localeCompare(b[0])
	)) {
		const have = segs.filter((s) => s.segment_id in PROPOSALS).length;
		if (have === 0) {
			pendingInterviews.push(interviewId);
			continue;
		}
		if (have !== segs.length) {
			errors.push(`${interviewId}: partial coverage — ${have}/${segs.length} segments proposed.`);
		}
		taggedInterviews.push(interviewId);
	}

	// Preserve human-confirmed annotations; ai_proposed entries are regenerated.
	const humanById = new Map<string, Annotation>();
	for (const a of existingTags.annotations ?? []) {
		if (a.source === 'human') humanById.set(a.segment_id, a);
	}

	const annotations: Annotation[] = [];
	for (const [segmentId, value] of Object.entries(PROPOSALS)) {
		const seg = segmentsById.get(segmentId);
		if (!seg) continue;

		// If the analyst has confirmed this segment, keep their annotation.
		const human = humanById.get(segmentId);
		if (human) {
			annotations.push(human);
			continue;
		}

		const themes = value.themes ?? [];
		const subthemes = value.subthemes ?? [];
		const emotions = value.emotions ?? [];
		const { sentiment, confidence } = value;
		const note = value.note ?? '';

		for (const t of themes) if (!validThemes.has(t)) errors.push(`${segmentId}: unknown theme "${t}".`);
		for (const e of emotions)
			if (!validEmotions.has(e)) errors.push(`${segmentId}: unknown emotion "${e}".`);
		for (const st of subthemes) {
			const parent = subthemeParent.get(st);
			if (!parent) errors.push(`${segmentId}: unknown subtheme "${st}".`);
			else if (!themes.includes(parent)) {
				errors.push(
					`${segmentId}: subtheme "${st}" requires parent theme "${parent}" to also be applied.`
				);
			}
		}
		if (!Number.isInteger(sentiment) || sentiment < -2 || sentiment > 2) {
			errors.push(`${segmentId}: sentiment must be an integer in [-2, 2], got ${sentiment}.`);
		}
		if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
			errors.push(`${segmentId}: confidence must be between 0 and 1, got ${confidence}.`);
		}

		const topics = topicAssignments[segmentId] ?? [];
		for (const tp of topics) {
			if (!validTopics.has(tp)) errors.push(`${segmentId}: unknown topic "${tp}".`);
		}

		annotations.push({
			segment_id: segmentId,
			interview_id: seg.interview_id,
			question_id: seg.question_id,
			topics,
			themes,
			subthemes,
			emotions,
			sentiment,
			confidence,
			source: 'ai_proposed',
			review_status: 'pending',
			reviewer_notes: note
		});
	}

	if (errors.length > 0) {
		throw new Error(`Validation failed:\n  ${errors.slice(0, 10).join('\n  ')}`);
	}

	annotations.sort((a, b) => a.segment_id.localeCompare(b.segment_id));

	const output: TagsFile = {
		meta: {
			...existingTags.meta,
			schema_version: '1.2',
			study_id: segData.meta.study_id,
			generated_at: new Date().toISOString(),
			generator: 'autotag-pipeline',
			labels_status: 'ai_proposed',
			labels_model: proposedData.meta?.model ?? MODEL,
			topics_status: topicsStatus,
			tagged_interviews: taggedInterviews,
			pending_interviews: pendingInterviews
		},
		annotations
	};
	await saveDoc(TAGS_KEY, TAGS_PATH, output);
}
