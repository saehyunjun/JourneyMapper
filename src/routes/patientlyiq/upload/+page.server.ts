/**
 * Transcript upload — server actions.
 *
 * parse         — runs the deterministic pipeline stages on pasted/uploaded
 *                 transcript text: step 1 parse, step 4 segment. Writes the raw
 *                 text, interviews_structured.json, and segments.json. Returns
 *                 any existing question_map.json mappings so the review view
 *                 pre-fills with them.
 * saveQuestions — records the human review of question-normalization (step 3):
 *                 confirms/corrects the per-turn question, writes
 *                 question_map.json, and propagates question_ids into segments.
 *                 The initial mapping is auto-proposed by
 *                 scripts/propose-questions.mjs; this action only confirms it.
 *
 * Note: these write into the source tree, so they are dev/demo-time operations.
 */
import { fail } from '@sveltejs/kit';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { dev } from '$app/environment';
import type { Actions, PageServerLoad } from './$types';
import questionBank from '$lib/content/wctglpdemo-data/questions.json';
import bundledStructured from '$lib/content/wctglpdemo-data/interviews_structured.json';
import bundledSegments from '$lib/content/wctglpdemo-data/segments.json';
import bundledQuestionMap from '$lib/content/wctglpdemo-data/question_map.json';
import codebook from '$lib/content/wctglpdemo-data/codebook.json';
import { readHighlights } from '$lib/server/highlights';
import { readAnnotationsFor } from '$lib/server/segment-tags';
import { getJob, startAutotag, type AutotagJob } from '$lib/server/autotag';
import { startCorpusAutotag } from '$lib/server/corpus-autotag';
import { readProfile } from '$lib/server/participant-profiles';
import { loadDoc, saveDoc } from '$lib/server/kv-store';
import {
	listCorpusIds,
	loadCorpusManifest,
	saveCorpusManifest,
	loadCorpusFragments,
	saveCorpusFragments,
	loadCorpusAnnotations,
	saveCorpusAnnotations,
	loadCorpusIngestConfig,
	loadJourneySchema,
	loadFullCorpus,
	loadCorpusKeywordTags
} from '$lib/server/corpus-store';
import type { Annotation } from '$lib/types/segment-tags';
import type { ParticipantProfile } from '$lib/types/participant-profile';
import type {
	AnnotationFile,
	CorpusManifest,
	Fragment,
	FragmentAnnotation,
	JourneySchema,
	SegmentTagsAnnotation,
	StagesAnnotation
} from '$lib/content/corpora/types';
import type { ContentSourceId } from '$lib/content/registries/types';
import {
	addFragmentKeywordTag,
	removeFragmentKeywordTag,
	readFragmentKeywordTags
} from '$lib/server/fragment-keyword-tags';

// The parse action awaits the autotag chain in prod (two Claude calls +
// validation), which usually takes 1–4 minutes. 300s is the Hobby ceiling;
// Pro + Fluid Compute can take this up to 800.
export const config = { maxDuration: 299 };

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const STRUCTURED_PATH = `${DATA_DIR}/interviews_structured.json`;
const SEGMENTS_PATH = `${DATA_DIR}/segments.json`;
const QUESTION_MAP_PATH = `${DATA_DIR}/question_map.json`;
const UPLOADS_DIR = `${DATA_DIR}/uploads`;
const CORPORA_DIR = 'src/lib/content/corpora';
const JOURNEYS_DIR = 'src/lib/content/journeys';
// The wctglpdemo-data tree is a GLP-1/obesity interview corpus. Real per-
// dataset manifests would replace this when a second interview corpus arrives.
const INTERVIEW_DATASET_INDICATION = 'obesity';

// Codebook validation sets — used when confirming corpus fragment annotations.
// Mirrors the validation done by upsertAnnotation() for interview segments.
const CODEBOOK_THEMES = new Set(
	(codebook.themes as { id: string }[]).map((t) => t.id)
);
const CODEBOOK_SUBTHEMES = new Set(
	(codebook.themes as { id: string; subthemes?: { id: string }[] }[]).flatMap(
		(t) => (t.subthemes ?? []).map((s) => s.id)
	)
);
const CODEBOOK_EMOTIONS = new Set(
	(codebook.emotion_tags as { id: string }[]).map((e) => e.id)
);

// Tolerates `**interviewer:**`, `Interviewer:`, `Participant:` and similar.
const SPEAKER_RE = /^\s*\*{0,2}\s*(interviewer|participant)\s*:?\s*\*{0,2}\s*:?\s*/i;
const TITLE_PARTICIPANT_RE = /participant\s+(\d+)/i;

// Words that take a trailing period without ending a sentence.
const ABBREV = new Set([
	'dr', 'mr', 'mrs', 'ms', 'etc', 'vs', 'inc', 'st', 'jr', 'sr', 'no', 'fig',
	'dept', 'approx', 'ph', 'e.g', 'i.e', 'a.m', 'p.m', 'u.s', 'u.k'
]);

const VALID_QUESTION_IDS = new Set(questionBank.questions.map((q) => q.question_id));

type Turn = {
	turn_index: number;
	speaker: string;
	text: string;
	char_start: number;
	char_end: number;
};

type Segment = {
	segment_id: string;
	interview_id: string;
	turn_index: number;
	segment_index: number;
	question_id: string | null;
	speaker: string;
	text: string;
	char_start: number;
	char_end: number;
	word_count: number;
	flags: string[];
};

const pad = (n: number) => String(n).padStart(2, '0');

function parseGender(raw: string): string | null {
	const s = raw.toLowerCase();
	if (s.includes('female')) return 'female';
	if (s.includes('male')) return 'male';
	return null;
}

function isAbbrev(word: string): boolean {
	const w = word.toLowerCase().replace(/[^a-z.]/g, '');
	if (w.length === 1) return true; // single-letter initial
	return ABBREV.has(w) || ABBREV.has(w.replace(/\.$/, ''));
}

/** Port of splitSentences() from scripts/build-segments.mjs. */
function splitSentences(text: string): { text: string; start: number; end: number }[] {
	const boundaries: number[] = [];
	const re = /[.!?]+['"’”)\]]*(\s+|$)/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(text)) !== null) {
		const trailingWs = m[1];
		const termEnd = m.index + m[0].length - trailingWs.length;

		const before = text.slice(0, m.index);
		const lastWord = (before.match(/(\S+)$/) || [])[1] || '';
		if (isAbbrev(lastWord)) continue;

		const nextIdx = m.index + m[0].length;
		if (nextIdx < text.length && !/[A-Z0-9"'‘“(]/.test(text[nextIdx])) continue;

		boundaries.push(termEnd);
	}

	const segments: { text: string; start: number; end: number }[] = [];
	let prev = 0;
	for (const cut of [...boundaries, text.length]) {
		if (cut <= prev) continue;
		const raw = text.slice(prev, cut);
		const lead = raw.length - raw.trimStart().length;
		const trimmed = raw.trim();
		if (trimmed.length > 0) {
			segments.push({ text: trimmed, start: prev + lead, end: prev + lead + trimmed.length });
		}
		prev = cut;
	}
	return segments;
}

/** Port of parseTranscript() from scripts/parse-transcripts.mjs. */
function parseTranscript(text: string) {
	const lines = text.split('\n');
	const offsets: number[] = [];
	let cur = 0;
	for (const line of lines) {
		offsets.push(cur);
		cur += line.length + 1; // +1 for the consumed '\n'
	}

	// A leading title line is optional for pasted text.
	let startLine = 0;
	let titleLine = '';
	if (lines.length > 0 && lines[0].trim() !== '' && !SPEAKER_RE.test(lines[0])) {
		titleLine = lines[0];
		startLine = 1;
	}

	const warnings: string[] = [];
	const turns: Turn[] = [];
	const demographicsLines: string[] = [];
	let seenFirstSpeaker = false;
	let turnIndex = 0;

	for (let i = startLine; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === '') continue;

		const speaker = line.match(SPEAKER_RE);
		if (!speaker) {
			if (!seenFirstSpeaker) demographicsLines.push(line.replace(/^[#\-*\s]+/, '').trim());
			else warnings.push(`Line ${i + 1} skipped (not a speaker turn): "${line.trim().slice(0, 60)}"`);
			continue;
		}

		seenFirstSpeaker = true;
		const labelLen = speaker[0].length;
		const rawContent = line.slice(labelLen);
		const leading = rawContent.length - rawContent.trimStart().length;
		const turnText = rawContent.trim();
		if (turnText === '') {
			warnings.push(`Empty turn at line ${i + 1}, skipped.`);
			continue;
		}
		const charStart = offsets[i] + labelLen + leading;
		turns.push({
			turn_index: turnIndex++,
			speaker: speaker[1].toLowerCase(),
			text: turnText,
			char_start: charStart,
			char_end: charStart + turnText.length
		});
	}

	return {
		titleLine: titleLine.trim(),
		demographicsRaw: demographicsLines.filter(Boolean).join('; '),
		turns,
		warnings
	};
}

/** Port of the segmentation loop from scripts/build-segments.mjs. */
function buildSegments(interviewId: string, turns: Turn[]): Segment[] {
	const segments: Segment[] = [];
	for (const turn of turns) {
		if (turn.speaker !== 'participant') continue;
		const parts = splitSentences(turn.text);
		parts.forEach((part, segmentIndex) => {
			const charStart = turn.char_start + part.start;
			const wc = part.text.split(/\s+/).filter(Boolean).length;
			segments.push({
				segment_id: `${interviewId}_t${pad(turn.turn_index)}_s${pad(segmentIndex)}`,
				interview_id: interviewId,
				turn_index: turn.turn_index,
				segment_index: segmentIndex,
				question_id: null, // no question_map for a fresh upload
				speaker: 'participant',
				text: part.text,
				char_start: charStart,
				char_end: charStart + part.text.length,
				word_count: wc,
				flags: wc < 3 ? ['very_short'] : []
			});
		});
	}
	return segments;
}

type QuestionMapMapping = {
	turn_index: number;
	question_id: string;
	turn_role?: string;
	confidence?: number;
	source?: string;
	review_status?: string;
	reviewer_notes?: string;
};
type QuestionMapFile = {
	meta?: Record<string, unknown>;
	interviews: {
		interview_id: string;
		mapping_count?: number;
		mappings: QuestionMapMapping[];
	}[];
};

/** turn_index -> question_id from question_map.json, for one interview. */
function readQuestionMap(interviewId: string): { turn_index: number; question_id: string }[] {
	let qmap: QuestionMapFile;
	if (dev) {
		try {
			qmap = JSON.parse(readFileSync(resolve(QUESTION_MAP_PATH), 'utf8'));
		} catch {
			return [];
		}
	} else {
		qmap = bundledQuestionMap as QuestionMapFile;
	}
	const entry = qmap.interviews.find((iv) => iv.interview_id === interviewId);
	return (entry?.mappings ?? []).map((m) => ({
		turn_index: m.turn_index,
		question_id: m.question_id
	}));
}

// === Corpus mode helpers =====================================================

type CorpusSummary = { id: string; label: string; indications: string[] };

/** List every corpus. Reads disk in dev, bundled seeds + KV index in prod —
 *  see corpus-store.ts. */
async function listCorpora(): Promise<CorpusSummary[]> {
	const ids = await listCorpusIds();
	const out: CorpusSummary[] = [];
	for (const id of ids) {
		const m = await loadCorpusManifest(id);
		if (m) out.push({ id: m.id, label: m.label, indications: m.indications });
	}
	return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** Read one corpus's manifest + every fragment/annotation partition. Returns
 *  null when the manifest is missing or unreadable. Thin wrapper over
 *  corpus-store#loadFullCorpus to keep this file's call sites unchanged. */
async function readCorpus(corpusId: string): Promise<{
	manifest: CorpusManifest;
	fragments: Fragment[];
	annotations: Record<string, FragmentAnnotation>;
} | null> {
	return loadFullCorpus(corpusId);
}

/** Look up the journey schema for an indication. */
async function readJourneySchema(indicationId: string): Promise<JourneySchema | null> {
	return loadJourneySchema(indicationId);
}

// === Forum-row → fragment projection ========================================
// Port of the row-projection loop from scripts/import-forum-as-fragments.mjs.
// Kept inline (not imported from .mjs) for the same reason splitSentences is
// duplicated here: server modules stay self-contained TS and don't reach into
// scripts/. The script remains the authoritative path for fresh corpus seeding;
// this projection handles the analyst's UI paste-append.
const FORUM_INGEST_INLINE_VERSION = 'addToCorpus-inline@0.1';

type ForumRow = {
	'Anonymized Username'?: string;
	Username?: string;
	Timestamp?: string;
	Text?: string;
	Thread?: string | number;
	Conversation?: string | number;
	Comment?: string;
	Context?: string;
};

type ForumIngestConfig = {
	corpus_id?: string;
	label?: string;
	platform: string;
	indications: string[];
	license?: Fragment['license'];
	redistribute_verbatim?: boolean;
	deid_rules_version?: string;
	deidentifier_version?: string;
	context_to_speaker_attrs?: Record<string, Record<string, string>>;
	split_long_fragments?: {
		enabled?: boolean;
		min_chars?: number;
		min_sentences?: number;
		applies_to?: string[];
	};
};

const SPLIT_DEFAULTS = {
	enabled: true,
	min_chars: 400,
	min_sentences: 4,
	applies_to: ['social_post', 'social_comment']
};

const FORUM_WEIGHT_BASE: Record<string, number> = {
	social_post: 0.5,
	social_comment: 0.3
};

const HTML_ENTITIES: Record<string, string> = {
	'&lt;': '<',
	'&gt;': '>',
	'&amp;': '&',
	'&quot;': '"',
	'&#39;': "'",
	'&apos;': "'",
	'&nbsp;': ' '
};
// Zero-width spaces / joiners / BOM that leak from forum exports.
const ZERO_WIDTH_RE = /[​-‍﻿]/g;

/** Port of normalizeText() from scripts/lib/normalize-text.mjs. */
function normalizeForumText(s: string): string {
	let out = String(s ?? '');
	out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
		String.fromCharCode(parseInt(hex, 16))
	);
	for (const [k, v] of Object.entries(HTML_ENTITIES)) out = out.split(k).join(v);
	out = out.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
	out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
	out = out.replace(ZERO_WIDTH_RE, '');
	out = out.replace(/\n+/g, ' ');
	out = out.replace(/[ \t]+/g, ' ');
	return out.trim();
}

type ProjectionResult = {
	fragmentsByContentSource: { social_post: Fragment[]; social_comment: Fragment[] };
	errors: string[];
	stats: {
		inputRows: number;
		emittedFragments: number;
		skippedMetadataRows: number;
		splitParentRows: number;
		splitChildFragments: number;
		unsplittableLongRows: number;
		deletedReanonymized: number;
		usersWithContextConflict: number;
	};
};

function projectForumRows({
	corpusId,
	config,
	rows,
	seenThreadConv
}: {
	corpusId: string;
	config: ForumIngestConfig;
	rows: ForumRow[];
	seenThreadConv: Set<string>;
}): ProjectionResult {
	const splitCfg = { ...SPLIT_DEFAULTS, ...(config.split_long_fragments ?? {}) };
	const splitApplies = new Set(splitCfg.applies_to);
	const contextMap = config.context_to_speaker_attrs ?? {};
	const license: Fragment['license'] = config.license ?? 'research_fair_use';
	const redistribute = config.redistribute_verbatim ?? false;
	const deidRulesVersion = config.deid_rules_version ?? 'unspecified@v0';
	const deidentifierVersion = config.deidentifier_version ?? 'unspecified@v0';

	// [deleted] re-anonymization, matching the .mjs ingester's behavior. The
	// counter is local to this batch — if the same corpus already has
	// Anon_<id>_NNNN entries, fresh ids may collide. The dev-tool surface area
	// makes this acceptable; UI paste is not the path for bulk re-ingest.
	const deletedIdByRowIdx = new Map<number, string>();
	let deletedReanonymized = 0;
	for (let i = 0; i < rows.length; i += 1) {
		if (rows[i].Username === '[deleted]') {
			deletedIdByRowIdx.set(
				i,
				`Anon_${corpusId}_${String(deletedReanonymized).padStart(4, '0')}`
			);
			deletedReanonymized += 1;
		}
	}
	const userIdOf = (rowIdx: number, row: ForumRow): string | undefined =>
		deletedIdByRowIdx.get(rowIdx) ?? row['Anonymized Username'];

	// Per-user dominant context.
	const contextsByUser = new Map<string, Map<string, number>>();
	for (let i = 0; i < rows.length; i += 1) {
		const r = rows[i];
		const uid = userIdOf(i, r);
		if (!uid) continue;
		const c = (r.Context ?? '').trim();
		if (!c) continue;
		const cmap = contextsByUser.get(uid) ?? new Map<string, number>();
		cmap.set(c, (cmap.get(c) ?? 0) + 1);
		contextsByUser.set(uid, cmap);
	}
	const resolvedContextByUser = new Map<string, string>();
	let usersWithContextConflict = 0;
	for (const [uid, cmap] of contextsByUser.entries()) {
		if (cmap.size > 1) usersWithContextConflict += 1;
		const best = [...cmap.entries()].sort((a, b) => b[1] - a[1])[0];
		resolvedContextByUser.set(uid, best[0]);
	}

	function contentSourceOf(row: ForumRow): 'social_post' | 'social_comment' {
		const postId = `${corpusId}-T${row.Thread ?? '?'}-C${row.Conversation ?? '?'}`;
		if (seenThreadConv.has(postId)) return 'social_comment';
		seenThreadConv.add(postId);
		return 'social_post';
	}

	function speakerAttrsFor(uid: string | undefined): Record<string, unknown> {
		if (!uid) return {};
		const ctx = resolvedContextByUser.get(uid);
		if (!ctx) return {};
		const mapping = contextMap[ctx];
		if (!mapping) return {};
		const attrs: Record<string, { value: string; evidence: 'stated'; source_quote: string }> = {};
		for (const [k, v] of Object.entries(mapping)) {
			attrs[k] = { value: String(v), evidence: 'stated', source_quote: ctx };
		}
		return attrs;
	}

	function fragmentIdOf(row: ForumRow, rowIdx: number): string {
		const t = String(row.Thread ?? '').trim().replace(/\s+/g, '');
		const c = String(row.Conversation ?? '').trim().replace(/\s+/g, '');
		const m = String(row.Comment ?? '').trim().replace(/\s+/g, '_').toLowerCase();
		const base = [t, c, m].filter(Boolean).join('-');
		if (base) return `fc-${corpusId}-${base}`;
		return `fc-${corpusId}-row${String(rowIdx).padStart(5, '0')}`;
	}

	function shouldSplit(text: string, contentSource: string) {
		if (!splitCfg.enabled) return null;
		if (!splitApplies.has(contentSource)) return null;
		if (text.length < splitCfg.min_chars) return null;
		const sentences = splitSentences(text);
		if (sentences.length < splitCfg.min_sentences) return null;
		return sentences;
	}

	const errors: string[] = [];
	const fragmentsByContentSource: { social_post: Fragment[]; social_comment: Fragment[] } = {
		social_post: [],
		social_comment: []
	};
	const seenIds = new Set<string>();
	let skippedMetadataRows = 0;
	let splitParentRows = 0;
	let splitChildFragments = 0;
	let unsplittableLongRows = 0;
	const nowIso = new Date().toISOString();

	for (let i = 0; i < rows.length; i += 1) {
		const r = rows[i];
		const hasNoUsername = !r['Anonymized Username'] && !deletedIdByRowIdx.has(i);
		const normalizedText = normalizeForumText(String(r.Text ?? ''));
		const hasNoText = normalizedText.length === 0;
		// Thread-title / metadata-only row — skip silently.
		if (hasNoUsername && !r.Timestamp && hasNoText) {
			skippedMetadataRows += 1;
			continue;
		}
		if (hasNoUsername) {
			errors.push(`row ${i}: missing Anonymized Username`);
			continue;
		}
		if (!r.Timestamp) {
			errors.push(`row ${i}: missing Timestamp`);
			continue;
		}
		if (hasNoText) {
			errors.push(`row ${i}: empty Text`);
			continue;
		}

		const uid = userIdOf(i, r);
		const contentSource = contentSourceOf(r);
		const rowFragmentId = fragmentIdOf(r, i);
		const postId = `${corpusId}-T${r.Thread ?? '?'}-C${r.Conversation ?? '?'}`;
		const commentId = String(r.Comment ?? '').trim();

		const baseSourceRef = {
			kind: contentSource,
			platform: config.platform,
			post_id: postId,
			comment_id: commentId || undefined,
			author_handle_hash: uid
		};

		const baseFragment = {
			corpus_id: corpusId,
			indications: config.indications as Fragment['indications'],
			content_source: contentSource as ContentSourceId,
			lang: 'en',
			date_observed: String(r.Timestamp),
			date_referenced: null,
			speaker_attrs: speakerAttrsFor(uid),
			weight_base: FORUM_WEIGHT_BASE[contentSource] ?? 0.5,
			weight_signals: {},
			license,
			redistribute_verbatim: redistribute,
			deidentified_at: String(r.Timestamp),
			deidentifier_version: deidentifierVersion,
			deid_rules_version: deidRulesVersion,
			ingested_at: nowIso,
			ingester_version: FORUM_INGEST_INLINE_VERSION
		} as const;

		const sentences = shouldSplit(normalizedText, contentSource);
		if (sentences) {
			splitParentRows += 1;
			for (let s = 0; s < sentences.length; s += 1) {
				const part = sentences[s];
				if (normalizedText.slice(part.start, part.end) !== part.text) {
					errors.push(`row ${i} seg ${s}: split offsets do not round-trip against parent text`);
					continue;
				}
				const childId = `${rowFragmentId}_s${pad(s)}`;
				if (seenIds.has(childId)) {
					errors.push(`row ${i}: duplicate fragment_id ${childId}`);
					continue;
				}
				seenIds.add(childId);
				fragmentsByContentSource[contentSource].push({
					id: childId,
					...baseFragment,
					source_ref: { ...baseSourceRef, char_start: part.start, char_end: part.end },
					text: part.text
				} as Fragment);
				splitChildFragments += 1;
			}
			continue;
		}

		if (seenIds.has(rowFragmentId)) {
			errors.push(`row ${i}: duplicate fragment_id ${rowFragmentId}`);
			continue;
		}
		seenIds.add(rowFragmentId);

		const flags: string[] = [];
		if (
			splitCfg.enabled &&
			splitApplies.has(contentSource) &&
			normalizedText.length >= splitCfg.min_chars
		) {
			flags.push('unsplittable_long');
			unsplittableLongRows += 1;
		}

		fragmentsByContentSource[contentSource].push({
			id: rowFragmentId,
			...baseFragment,
			source_ref: baseSourceRef,
			text: normalizedText,
			...(flags.length > 0 ? { flags } : {})
		} as unknown as Fragment);
	}

	return {
		fragmentsByContentSource,
		errors,
		stats: {
			inputRows: rows.length,
			emittedFragments:
				fragmentsByContentSource.social_post.length +
				fragmentsByContentSource.social_comment.length,
			skippedMetadataRows,
			splitParentRows,
			splitChildFragments,
			unsplittableLongRows,
			deletedReanonymized,
			usersWithContextConflict
		}
	};
}

/** Locate which partition a fragment belongs to. Needed by the save action to
 *  know which annotations/<content_source>.json file to edit. */
async function findFragmentPartition(
	corpusId: string,
	fragmentId: string
): Promise<string | null> {
	const corpus = await readCorpus(corpusId);
	if (!corpus) return null;
	const f = corpus.fragments.find((x) => x.id === fragmentId);
	return f?.content_source ?? null;
}

// Page data: starred segment ids for the review view, the list of ingested
// interviews, and — when ?interview=<id> is set — that interview's turns,
// segments, and question mapping, so its review view reopens without the
// transcript being re-pasted and re-parsed.
//
// When ?source=corpus is set, switches to corpus-retag mode: returns fragments
// + annotations + the journey schema for the chosen corpus's primary indication.
//
// Both modes are filtered by the active indication from the parent layout's
// LexiconSlice, so toggling indication in the sidebar narrows the available
// corpora + interviews to what's relevant. The page renders an empty-state
// card when no data matches the active indication.
export const load: PageServerLoad = async ({ url, parent }) => {
	const { slice } = await parent();
	const activeIndication = slice.active_indication;
	const corpora = (await listCorpora()).filter((c) => c.indications.includes(activeIndication));
	const sourceParam = url.searchParams.get('source');

	if (sourceParam === 'corpus') {
		// Honor ?corpus=<id> only if it matches the active indication; otherwise
		// fall back to the first matching corpus, or no corpus at all.
		const requested = url.searchParams.get('corpus');
		const corpusId =
			requested && corpora.some((c) => c.id === requested)
				? requested
				: corpora[0]?.id ?? '';
		const view = (url.searchParams.get('view') === 'participant' ? 'participant' : 'thread') as
			| 'thread'
			| 'participant';
		const loaded = corpusId ? await readCorpus(corpusId) : null;
		const indication = loaded?.manifest.indications[0] ?? null;
		const journey = indication ? await readJourneySchema(indication) : null;
		// `starredSegmentIds` and `interviewIds` are kept as empty arrays so the
		// page.svelte init code can read them without guarding for `undefined`.
		const { starredFragmentIds } = await readHighlights();

		// Per-fragment keyword tags (corpus-side). Read once per partition; the
		// page filters per-fragment on demand. Read via the corpus-store so
		// staging gets the bundled seeds and dev keeps writing to disk via the
		// existing fragment-keyword-tags helper.
		const fragmentKeywordTags: ReturnType<typeof readFragmentKeywordTags> = [];
		if (loaded) {
			const partitions = new Set(loaded.fragments.map((f) => f.content_source));
			for (const partition of partitions) {
				const file = (await loadCorpusKeywordTags(loaded.manifest.id, partition)) as
					| { tags?: typeof fragmentKeywordTags }
					| null;
				if (file?.tags) for (const tag of file.tags) fragmentKeywordTags.push(tag);
			}
		}

		return {
			mode: 'corpus' as const,
			corpora,
			corpus: loaded
				? { id: loaded.manifest.id, label: loaded.manifest.label, indications: loaded.manifest.indications }
				: null,
			fragments: loaded?.fragments ?? [],
			fragmentAnnotations: loaded?.annotations ?? {},
			fragmentKeywordTags,
			journey,
			view,
			activeIndication,
			starredFragmentIds,
			starredSegmentIds: [] as string[],
			interviewIds: [] as string[],
			review: null
		};
	}

	const { starredSegmentIds, starredFragmentIds } = await readHighlights();

	// The only interview dataset on disk is the GLP-1/obesity corpus. When the
	// active indication is something else, we still render the mode but the
	// list is empty — the page surfaces an empty state.
	const indicationMatch = activeIndication === INTERVIEW_DATASET_INDICATION;

	// interviews_structured.json is owned by the upload pipeline (still fs-only
	// in prod), so in prod we use the bundled snapshot — new interviews can only
	// arrive via a redeploy.
	const structured: { interviews: { interview_id: string; turns: Turn[] }[] } = dev
		? JSON.parse(readFileSync(resolve(STRUCTURED_PATH), 'utf8'))
		: (bundledStructured as { interviews: { interview_id: string; turns: Turn[] }[] });
	const interviewIds: string[] = indicationMatch
		? structured.interviews.map((iv) => iv.interview_id).sort()
		: [];

	// Default to the first interview in the list when no ?interview= is given,
	// so the review view is populated the moment the page opens. The selector
	// dropdown can still navigate away from it.
	const wanted = url.searchParams.get('interview') ?? interviewIds[0] ?? '';
	let review:
		| {
				interviewId: string;
				turns: Turn[];
				segments: Segment[];
				questionMap: { turn_index: number; question_id: string }[];
				annotations: Record<string, Annotation>;
				autotagJob: AutotagJob | null;
				profile: ParticipantProfile;
		  }
		| null = null;
	if (wanted) {
		const interview = structured.interviews.find((iv) => iv.interview_id === wanted);
		if (interview) {
			// Reads from KV in prod, fs in dev — kept in sync with the migrated
			// merge/unmerge writers via the shared kv-store helper.
			const segData = await loadDoc<{ segments: Segment[] }>(
				'wctglpdemo:segments',
				SEGMENTS_PATH,
				bundledSegments as { segments: Segment[] }
			);
			const segments = segData.segments
				.filter((s) => s.interview_id === wanted)
				.sort((a, b) => a.segment_id.localeCompare(b.segment_id));
			const [annotations, profile, autotagJob] = await Promise.all([
				readAnnotationsFor(wanted),
				readProfile(wanted),
				getJob(wanted)
			]);
			review = {
				interviewId: wanted,
				turns: interview.turns as Turn[],
				segments,
				questionMap: readQuestionMap(wanted),
				annotations,
				autotagJob,
				profile
			};
		}
	}

	return {
		mode: 'interview' as const,
		corpora,
		activeIndication,
		starredSegmentIds,
		starredFragmentIds,
		interviewIds,
		review
	};
};

export const actions: Actions = {
	// --- Step 1 (parse) + step 4 (segment) ---
	parse: async ({ request }) => {
		const fd = await request.formData();
		const raw = String(fd.get('transcript') ?? '');
		const idField = String(fd.get('participantId') ?? '').trim();

		const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
		if (text.trim().length < 20) {
			return fail(400, { error: 'Paste a transcript before submitting.' });
		}

		let num: number | null = null;
		if (idField) {
			const d = idField.match(/\d+/);
			if (d) num = Number(d[0]);
		}
		if (num == null) {
			const titleMatch = (text.split('\n')[0] ?? '').match(TITLE_PARTICIPANT_RE);
			if (titleMatch) num = Number(titleMatch[1]);
		}
		if (num == null) {
			return fail(400, {
				error:
					'Could not determine the participant number. Enter it in the field, or include a "Participant N" title line.'
			});
		}

		const interviewId = `participant_${String(num).padStart(2, '0')}`;
		// .txt (not .md) so the file is not picked up by the content `import.meta.glob`
		// in src/lib/content/index.ts, which would trigger a Vite full-page reload.
		const sourceFile = `${UPLOADS_DIR}/${interviewId}.txt`;

		const { titleLine, demographicsRaw, turns, warnings } = parseTranscript(text);
		if (turns.length === 0) {
			return fail(400, {
				error: 'No speaker turns found. Expected lines like "Interviewer: …" and "Participant: …".'
			});
		}
		for (const t of turns) {
			if (text.slice(t.char_start, t.char_end) !== t.text) {
				return fail(500, { error: `Parse error: offset mismatch on turn ${t.turn_index}.` });
			}
		}

		const segments = buildSegments(interviewId, turns);
		for (const s of segments) {
			if (text.slice(s.char_start, s.char_end) !== s.text) {
				return fail(500, { error: `Segmentation error: offset mismatch on ${s.segment_id}.` });
			}
		}

		// The raw .txt archive is only useful for dev (the source-file lookup is
		// just metadata; nothing reads the file back). Skip it in prod, where
		// the function FS is read-only.
		if (dev) {
			mkdirSync(resolve(UPLOADS_DIR), { recursive: true });
			writeFileSync(resolve(sourceFile), text, 'utf8');
		}

		const structured = await loadDoc<typeof bundledStructured>(
			'wctglpdemo:interviews_structured',
			STRUCTURED_PATH,
			bundledStructured
		);
		const existed = structured.interviews.some((iv) => iv.interview_id === interviewId);
		structured.interviews = structured.interviews.filter(
			(iv) => iv.interview_id !== interviewId
		);
		structured.interviews.push({
			interview_id: interviewId,
			source_file: sourceFile,
			source_title: titleLine || null,
			ingested_via: 'upload',
			ingested_at: new Date().toISOString(),
			participant_metadata: {
				condition: 'GLP-1 weight maintenance',
				demographics_raw: demographicsRaw || null,
				gender: demographicsRaw ? parseGender(demographicsRaw) : null
			},
			turn_count: turns.length,
			turns
		} as unknown as (typeof structured.interviews)[number]);
		structured.interviews.sort((a, b) => a.interview_id.localeCompare(b.interview_id));
		(structured.meta as { generated_at?: string }).generated_at = new Date().toISOString();
		const sourceFiles = (structured.meta as { source_files?: string[] }).source_files;
		if (Array.isArray(sourceFiles) && !sourceFiles.includes(sourceFile)) {
			sourceFiles.push(sourceFile);
		}
		await saveDoc('wctglpdemo:interviews_structured', STRUCTURED_PATH, structured);

		const segData = await loadDoc<{ segments: Segment[]; meta: Record<string, unknown> }>(
			'wctglpdemo:segments',
			SEGMENTS_PATH,
			bundledSegments as { segments: Segment[]; meta: Record<string, unknown> }
		);
		segData.segments = segData.segments.filter((s) => s.interview_id !== interviewId);
		segData.segments.push(...segments);
		segData.segments.sort((a, b) => a.segment_id.localeCompare(b.segment_id));
		segData.meta.generated_at = new Date().toISOString();
		segData.meta.segment_count = segData.segments.length;
		await saveDoc('wctglpdemo:segments', SEGMENTS_PATH, segData);

		// AI judgement steps. In dev these spawn as background scripts and the
		// page polls. In prod we await the chain so the serverless function
		// instance stays alive until tagging completes (needs maxDuration set).
		const { completion } = await startAutotag(interviewId);
		if (!dev) await completion;

		return {
			stage: 'upload',
			success: true,
			interviewId,
			replaced: existed,
			turnCount: turns.length,
			interviewerTurns: turns.filter((t) => t.speaker === 'interviewer').length,
			participantTurns: turns.filter((t) => t.speaker === 'participant').length,
			segmentCount: segments.length,
			demographics: demographicsRaw || null,
			warnings
		};
	},

	// --- Step 3 (question normalization) — human-assigned ---
	saveQuestions: async ({ request }) => {
		const fd = await request.formData();
		const interviewId = String(fd.get('interviewId') ?? '').trim();
		if (!interviewId) return fail(400, { error: 'Missing interview id.' });

		let assignments: Record<string, string>;
		try {
			assignments = JSON.parse(String(fd.get('assignments') ?? '{}'));
		} catch {
			return fail(400, { error: 'Invalid question-assignment data.' });
		}

		// Keep only non-empty, valid question ids, keyed by turn index.
		const byTurn = new Map<number, string>();
		for (const [k, v] of Object.entries(assignments)) {
			if (!v) continue;
			if (!VALID_QUESTION_IDS.has(v)) {
				return fail(400, { error: `Unknown question id "${v}".` });
			}
			byTurn.set(Number(k), v);
		}

		const structured = await loadDoc<typeof bundledStructured>(
			'wctglpdemo:interviews_structured',
			STRUCTURED_PATH,
			bundledStructured
		);
		const interview = structured.interviews.find((iv) => iv.interview_id === interviewId);
		if (!interview) return fail(404, { error: `Interview ${interviewId} not found.` });

		const turns: Turn[] = (interview as unknown as { turns: Turn[] }).turns;
		const interviewerTurns = turns.filter((t) => t.speaker === 'interviewer');

		// Existing mappings — the AI proposal from propose-questions / autotag.
		// Confirming a proposed turn keeps its turn_role/notes; only a changed
		// question_id falls back to the plain "question" role.
		const qmap = await loadDoc<QuestionMapFile>(
			'wctglpdemo:question_map',
			QUESTION_MAP_PATH,
			bundledQuestionMap as QuestionMapFile
		);
		const priorEntry = qmap.interviews.find((iv) => iv.interview_id === interviewId);
		const priorByTurn = new Map<number, QuestionMapMapping>(
			(priorEntry?.mappings ?? []).map((m) => [m.turn_index, m])
		);

		// Mappings: only interviewer turns the reviewer actually assigned.
		const mappings: QuestionMapMapping[] = interviewerTurns
			.filter((t) => byTurn.has(t.turn_index))
			.map((t) => {
				const questionId = byTurn.get(t.turn_index)!;
				const prior = priorByTurn.get(t.turn_index);
				const kept = prior && prior.question_id === questionId;
				return {
					turn_index: t.turn_index,
					question_id: questionId,
					turn_role: kept ? (prior.turn_role ?? 'question') : 'question',
					confidence: 1,
					source: 'human',
					review_status: 'confirmed',
					reviewer_notes: kept ? (prior.reviewer_notes ?? '') : ''
				};
			});

		// Write question_map.
		qmap.interviews = qmap.interviews.filter((iv) => iv.interview_id !== interviewId);
		qmap.interviews.push({
			interview_id: interviewId,
			mapping_count: mappings.length,
			mappings
		});
		qmap.interviews.sort((a, b) => a.interview_id.localeCompare(b.interview_id));
		(qmap.meta ??= {}).generated_at = new Date().toISOString();
		await saveDoc('wctglpdemo:question_map', QUESTION_MAP_PATH, qmap);

		// Propagate question_id into segments — each inherits the most recent
		// assigned interviewer turn before it.
		const ordered = [...mappings].sort((a, b) => a.turn_index - b.turn_index);
		const inherited = (turnIndex: number): string | null => {
			let qid: string | null = null;
			for (const m of ordered) {
				if (m.turn_index < turnIndex) qid = m.question_id ?? null;
				else break;
			}
			return qid;
		};

		const segData = await loadDoc<{ segments: Segment[]; meta: Record<string, unknown> }>(
			'wctglpdemo:segments',
			SEGMENTS_PATH,
			bundledSegments as { segments: Segment[]; meta: Record<string, unknown> }
		);
		let segmentsUpdated = 0;
		for (const s of segData.segments) {
			if (s.interview_id !== interviewId) continue;
			s.question_id = inherited(s.turn_index);
			segmentsUpdated++;
		}
		segData.meta.generated_at = new Date().toISOString();
		await saveDoc('wctglpdemo:segments', SEGMENTS_PATH, segData);

		const segments: Segment[] = segData.segments
			.filter((s) => s.interview_id === interviewId)
			.sort((a, b) => a.segment_id.localeCompare(b.segment_id));

		return {
			stage: 'questionMap',
			success: true,
			interviewId,
			mappedCount: mappings.length,
			interviewerCount: interviewerTurns.length,
			segmentsUpdated,
			turns,
			segments,
			questionMap: mappings.map((m) => ({ turn_index: m.turn_index, question_id: m.question_id! })),
			annotations: await readAnnotationsFor(interviewId)
		};
	},

	// --- Corpus retag (fragment-side) ---
	// Saves a single dimension of one fragment's annotation back to
	// corpora/<corpus_id>/annotations/<content_source>.json. The form body
	// carries:
	//   corpus_id, fragment_id, dimension ('segment_tags' | 'stages'),
	//   payload (JSON-stringified, dimension-specific shape).
	// Unlike the interview flow, fragments are deidentified and never
	// rewritten — this action only touches annotation metadata.
	saveFragmentAnnotation: async ({ request }) => {
		const fd = await request.formData();
		const corpusId = String(fd.get('corpus_id') ?? '').trim();
		const fragmentId = String(fd.get('fragment_id') ?? '').trim();
		const dimension = String(fd.get('dimension') ?? '').trim();
		const rawPayload = String(fd.get('payload') ?? '');

		if (!corpusId || !fragmentId) {
			return fail(400, { error: 'Missing corpus_id or fragment_id.' });
		}
		if (dimension !== 'segment_tags' && dimension !== 'stages') {
			return fail(400, { error: `Unknown dimension "${dimension}".` });
		}
		let payload: unknown;
		try {
			payload = JSON.parse(rawPayload);
		} catch {
			return fail(400, { error: 'payload was not valid JSON.' });
		}
		if (!payload || typeof payload !== 'object') {
			return fail(400, { error: 'payload must be an object.' });
		}

		const contentSource = await findFragmentPartition(corpusId, fragmentId);
		if (!contentSource) {
			return fail(404, { error: `Fragment ${fragmentId} not found in corpus ${corpusId}.` });
		}

		// Reads via corpus-store (dev → disk, prod → KV with bundled seed
		// fallback). A null result means the partition hasn't been seeded yet
		// and Redis has no record — we stub one in below.
		const file: AnnotationFile = (await loadCorpusAnnotations(corpusId, contentSource)) ?? {
			meta: {
				schema_version: '1.0',
				corpus_id: corpusId,
				content_source: contentSource as ContentSourceId,
				updated_at: new Date().toISOString()
			},
			annotations: {}
		};
		file.annotations ??= {};
		const record: FragmentAnnotation = file.annotations[fragmentId] ?? {};

		const nowIso = new Date().toISOString();

		if (dimension === 'segment_tags') {
			const p = payload as Partial<SegmentTagsAnnotation>;
			const themes = Array.isArray(p.themes) ? p.themes.map(String) : [];
			const subthemes = Array.isArray(p.subthemes) ? p.subthemes.map(String) : [];
			const emotions = Array.isArray(p.emotions) ? p.emotions.map(String) : [];
			for (const id of themes) {
				if (!CODEBOOK_THEMES.has(id)) return fail(400, { error: `Unknown theme "${id}".` });
			}
			for (const id of subthemes) {
				if (!CODEBOOK_SUBTHEMES.has(id)) return fail(400, { error: `Unknown subtheme "${id}".` });
			}
			for (const id of emotions) {
				if (!CODEBOOK_EMOTIONS.has(id)) return fail(400, { error: `Unknown emotion "${id}".` });
			}
			const sentiment =
				typeof p.sentiment_score === 'number' && Number.isInteger(p.sentiment_score)
					? Math.max(-2, Math.min(2, p.sentiment_score))
					: null;

			const prior = record.segment_tags ?? ({} as SegmentTagsAnnotation);
			const next: SegmentTagsAnnotation = {
				themes,
				subthemes,
				emotions,
				topics: Array.isArray(prior.topics) ? prior.topics : [],
				sentiment_score: sentiment,
				confidence: prior.confidence ?? null,
				note: typeof p.note === 'string' ? p.note : (prior.note ?? ''),
				source: 'human',
				review_status: 'human_confirmed'
			};
			// Preserve themes-pass provenance so we can tell that a prior AI
			// proposal underpinned this record.
			if (prior.themes_generator) next.themes_generator = prior.themes_generator;
			if (prior.themes_generated_at) next.themes_generated_at = prior.themes_generated_at;
			if (prior.themes_confidence != null) next.themes_confidence = prior.themes_confidence;
			if (prior.themes_note) next.themes_note = prior.themes_note;

			record.segment_tags = next;
		} else {
			// stages
			const p = payload as Partial<StagesAnnotation>;
			if (!Array.isArray(p.values)) {
				return fail(400, { error: 'stages.values must be an array.' });
			}
			// Validate against the journey schema for this corpus's primary indication.
			const m = await loadCorpusManifest(corpusId);
			const primaryIndication = m?.indications[0] ?? null;
			const journey = primaryIndication ? await readJourneySchema(primaryIndication) : null;
			if (!journey) {
				return fail(400, { error: 'Journey schema unavailable; cannot validate stage ids.' });
			}
			const stageById = new Map(journey.stages.map((s) => [s.id, s]));
			const cleanedValues: StagesAnnotation['values'] = [];
			for (const v of p.values) {
				const sId = String((v as { stage_id?: unknown }).stage_id ?? '');
				const stage = stageById.get(sId);
				if (!stage) return fail(400, { error: `Unknown stage_id "${sId}".` });
				const rawStep = (v as { step_id?: unknown }).step_id;
				const stepId =
					rawStep == null || rawStep === '' ? null : String(rawStep);
				if (stepId && !stage.steps.some((step) => step.id === stepId)) {
					return fail(400, { error: `step_id "${stepId}" is not a step of "${sId}".` });
				}
				const conf = Number((v as { confidence?: unknown }).confidence);
				cleanedValues.push({
					stage_id: sId,
					step_id: stepId,
					confidence: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.5
				});
			}
			const overall = Number((payload as { overall_confidence?: unknown }).overall_confidence);
			const next: StagesAnnotation = {
				values: cleanedValues,
				overall_confidence: Number.isFinite(overall) ? Math.max(0, Math.min(1, overall)) : 0.5,
				note: typeof p.note === 'string' ? p.note : (record.stages?.note ?? ''),
				source: 'human',
				review_status: 'human_confirmed'
			};
			record.stages = next;
		}

		file.annotations[fragmentId] = record;
		file.meta.updated_at = nowIso;
		await saveCorpusAnnotations(corpusId, contentSource, file);

		// Touch the corpus manifest's updated_at so the picker can show staleness.
		try {
			const m = await loadCorpusManifest(corpusId);
			if (m) {
				m.updated_at = nowIso;
				await saveCorpusManifest(corpusId, m);
			}
		} catch {
			// Non-fatal — annotation is saved regardless.
		}

		return {
			stage: 'fragmentAnnotation' as const,
			success: true,
			corpusId,
			fragmentId,
			dimension,
			annotation: record
		};
	},

	// --- Corpus merge (combine N fragments into one comprehensive quote) ---
	// Coexist semantics: the source fragments stay in place; a new "derived"
	// fragment is added that references them via derived_from[]. Used when the
	// analyst wants a single quote that's stitched together from one user's OP
	// + a follow-up comment, or a multi-comment exchange that reads as one
	// point. Constraint: all sources must belong to the same thread (post_id).
	mergeFragments: async ({ request }) => {
		const fd = await request.formData();
		const corpusId = String(fd.get('corpus_id') ?? '').trim();
		const ids = (() => {
			try {
				const parsed = JSON.parse(String(fd.get('fragment_ids') ?? '[]'));
				return Array.isArray(parsed) ? parsed.map(String) : [];
			} catch {
				return [];
			}
		})();
		const analystNote = String(fd.get('note') ?? '');

		if (!corpusId) return fail(400, { error: 'Missing corpus_id.' });
		if (ids.length < 2) return fail(400, { error: 'Pick at least two fragments to merge.' });

		if (!dev) {
			return fail(503, {
				error:
					'Merging is dev-only — the function filesystem is read-only in prod.'
			});
		}

		const corpus = await readCorpus(corpusId);
		if (!corpus) return fail(404, { error: `Corpus ${corpusId} not found.` });

		const sources = ids.map((id) => corpus.fragments.find((f) => f.id === id)).filter(
			(f): f is Fragment => !!f
		);
		if (sources.length !== ids.length) {
			return fail(404, { error: 'One or more fragment ids not found in this corpus.' });
		}

		// Same-thread constraint — pull the post_id from social_post/social_comment
		// (and forum_/blog_ analogs); reject if any source has a non-forum ref.
		const postIds = new Set<string>();
		for (const f of sources) {
			const ref = f.source_ref;
			if (
				ref.kind === 'social_post' ||
				ref.kind === 'social_comment' ||
				ref.kind === 'forum_post' ||
				ref.kind === 'forum_comment' ||
				ref.kind === 'blog_post' ||
				ref.kind === 'blog_comment'
			) {
				postIds.add(ref.post_id);
			} else {
				return fail(400, {
					error: 'Merge is only supported for forum / social fragments.'
				});
			}
		}
		if (postIds.size !== 1) {
			return fail(400, {
				error: `All fragments must belong to one thread — got ${postIds.size}.`
			});
		}
		const [postId] = [...postIds];

		// Chronological order so the merged text reads naturally.
		const ordered = [...sources].sort(
			(a, b) => new Date(a.date_observed).getTime() - new Date(b.date_observed).getTime()
		);

		const mergedText = ordered.map((f) => f.text).join('\n\n');
		// Stable id derived from the sorted source ids — same inputs always
		// produce the same merged id, so a re-run is idempotent.
		const sortedIds = [...ordered.map((f) => f.id)].sort();
		const shortHash = createHash('sha256').update(sortedIds.join('|')).digest('hex').slice(0, 8);
		const mergedId = `${corpusId}-merged-${shortHash}`;

		const sharedAuthor = ordered.every(
			(f) =>
				(f.source_ref.kind === 'social_post' ||
					f.source_ref.kind === 'social_comment' ||
					f.source_ref.kind === 'forum_post' ||
					f.source_ref.kind === 'forum_comment' ||
					f.source_ref.kind === 'blog_post' ||
					f.source_ref.kind === 'blog_comment') &&
				f.source_ref.author_handle_hash === (ordered[0].source_ref as { author_handle_hash?: string }).author_handle_hash
		)
			? (ordered[0].source_ref as { author_handle_hash?: string }).author_handle_hash
			: undefined;

		const license = ordered[0].license;
		if (ordered.some((f) => f.license !== license)) {
			return fail(400, {
				error: 'Sources have mixed licenses; cannot merge.'
			});
		}
		const deidRulesVersion = ordered[0].deid_rules_version;
		const deidentifierVersion = ordered[0].deidentifier_version;
		const indications = [...new Set(ordered.flatMap((f) => f.indications))];
		const weightBase = Math.max(...ordered.map((f) => f.weight_base));
		const nowIso = new Date().toISOString();

		const platform =
			(ordered[0].source_ref as { platform?: string }).platform ?? 'unknown';

		const merged: Fragment = {
			id: mergedId,
			corpus_id: corpusId,
			indications,
			content_source: 'social_post',
			source_ref: {
				kind: 'social_post',
				platform,
				post_id: postId,
				author_handle_hash: sharedAuthor
			},
			text: mergedText,
			lang: ordered[0].lang,
			date_observed: ordered[0].date_observed,
			speaker_attrs: ordered[0].speaker_attrs,
			weight_base: weightBase,
			weight_signals: {},
			license,
			redistribute_verbatim: ordered.every((f) => f.redistribute_verbatim),
			derived_from: sortedIds,
			deidentified_at: ordered[0].deidentified_at,
			deidentifier_version: deidentifierVersion,
			deid_rules_version: deidRulesVersion,
			ingested_at: nowIso,
			ingester_version: 'analyst-merge@0.1'
		};

		// Persist the merged fragment.
		const fragmentsPath = resolve(CORPORA_DIR, corpusId, 'fragments', 'social_post.json');
		let fragmentsFile: { meta: Record<string, unknown>; fragments: Fragment[] };
		try {
			fragmentsFile = JSON.parse(readFileSync(fragmentsPath, 'utf8'));
		} catch (err) {
			return fail(500, {
				error: `Could not read social_post.json: ${(err as Error).message}`
			});
		}
		// Replace any existing merge with the same id (idempotent retry).
		fragmentsFile.fragments = fragmentsFile.fragments.filter((f) => f.id !== mergedId);
		fragmentsFile.fragments.push(merged);
		(fragmentsFile.meta as Record<string, unknown>).updated_at = nowIso;
		writeFileSync(fragmentsPath, JSON.stringify(fragmentsFile, null, 2) + '\n', 'utf8');

		// Build the merged annotation by unioning sources'. Marked human-confirmed
		// since the analyst chose this composition explicitly.
		const sourceAnnotations = ordered
			.map((f) => corpus.annotations[f.id])
			.filter((a): a is FragmentAnnotation => !!a);

		const themes = [
			...new Set(sourceAnnotations.flatMap((a) => a.segment_tags?.themes ?? []))
		];
		const subthemes = [
			...new Set(sourceAnnotations.flatMap((a) => a.segment_tags?.subthemes ?? []))
		];
		const emotions = [
			...new Set(sourceAnnotations.flatMap((a) => a.segment_tags?.emotions ?? []))
		];
		const topics = [
			...new Set(sourceAnnotations.flatMap((a) => a.segment_tags?.topics ?? []))
		];
		const sentimentScores = sourceAnnotations
			.map((a) => a.segment_tags?.sentiment_score)
			.filter((s): s is number => typeof s === 'number');
		const sentiment_score =
			sentimentScores.length > 0
				? Math.round(sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length)
				: null;
		const noteJoin = [
			analystNote.trim(),
			...sourceAnnotations.map((a) => a.segment_tags?.note ?? '').filter(Boolean)
		]
			.filter(Boolean)
			.join(' / ');

		const stageValues = [
			...new Map(
				sourceAnnotations
					.flatMap((a) => a.stages?.values ?? [])
					.map((v) => [`${v.stage_id}::${v.step_id ?? ''}`, v])
			).values()
		];
		const stageNoteJoin = sourceAnnotations
			.map((a) => a.stages?.note ?? '')
			.filter(Boolean)
			.join(' / ');

		const mergedAnnotation: FragmentAnnotation = {
			segment_tags: {
				themes,
				subthemes,
				emotions,
				topics,
				sentiment_score,
				confidence: null,
				note: noteJoin,
				source: 'human',
				review_status: 'human_confirmed'
			},
			...(stageValues.length > 0
				? {
						stages: {
							values: stageValues,
							overall_confidence: 0.9,
							note: stageNoteJoin,
							source: 'human' as const,
							review_status: 'human_confirmed' as const
						}
					}
				: {})
		};

		const annotationsPath = resolve(CORPORA_DIR, corpusId, 'annotations', 'social_post.json');
		let annotationsFile: AnnotationFile;
		try {
			annotationsFile = JSON.parse(readFileSync(annotationsPath, 'utf8'));
		} catch (err) {
			return fail(500, {
				error: `Could not read annotations/social_post.json: ${(err as Error).message}`
			});
		}
		annotationsFile.annotations[mergedId] = mergedAnnotation;
		annotationsFile.meta.updated_at = nowIso;
		writeFileSync(annotationsPath, JSON.stringify(annotationsFile, null, 2) + '\n', 'utf8');

		return {
			stage: 'fragmentMerge' as const,
			success: true,
			corpusId,
			mergedId,
			sourceIds: sortedIds,
			merged,
			annotation: mergedAnnotation
		};
	},

	// --- Edit fragment text (analyst rewrite of a phrase in fragment.text) ---
	editFragmentText: async ({ request }) => {
		const fd = await request.formData();
		const corpusId = String(fd.get('corpus_id') ?? '').trim();
		const fragmentId = String(fd.get('fragment_id') ?? '').trim();
		const find = String(fd.get('find') ?? '');
		const replace = String(fd.get('replace') ?? '');

		if (!corpusId || !fragmentId) {
			return fail(400, { error: 'Missing corpus_id or fragment_id.' });
		}
		if (!find) return fail(400, { error: 'Missing find text.' });

		if (!dev) {
			return fail(503, {
				error:
					'Fragment text edits are dev-only — the function filesystem is read-only in prod.'
			});
		}

		const corpus = await readCorpus(corpusId);
		if (!corpus) return fail(404, { error: `Corpus ${corpusId} not found.` });
		const fragment = corpus.fragments.find((f) => f.id === fragmentId);
		if (!fragment) return fail(404, { error: `Fragment ${fragmentId} not found.` });

		const idx = fragment.text.indexOf(find);
		if (idx < 0) {
			return fail(400, {
				error: 'The original phrase is no longer in the fragment — refresh and try again.'
			});
		}

		const before = fragment.text.slice(0, idx);
		const after = fragment.text.slice(idx + find.length);
		const cleanedReplace = replace.replace(/[ \t]+/g, ' ').trim();
		const newText = (before + cleanedReplace + after).replace(/[ \t]+/g, ' ').trim();

		// Rewrite the partition. We don't adjust keyword-tag offsets here — they
		// become approximate after edits, matching the interview convention
		// (segments-edit-text on the interview side has the same caveat).
		const fragmentsPath = resolve(
			CORPORA_DIR,
			corpusId,
			'fragments',
			`${fragment.content_source}.json`
		);
		let fragmentsFile: { meta: Record<string, unknown>; fragments: Fragment[] };
		try {
			fragmentsFile = JSON.parse(readFileSync(fragmentsPath, 'utf8'));
		} catch (err) {
			return fail(500, {
				error: `Could not read fragments file: ${(err as Error).message}`
			});
		}
		const onDiskIdx = fragmentsFile.fragments.findIndex((f) => f.id === fragmentId);
		if (onDiskIdx < 0) {
			return fail(500, { error: 'Fragment vanished between read and write.' });
		}
		fragmentsFile.fragments[onDiskIdx] = {
			...fragmentsFile.fragments[onDiskIdx],
			text: newText
		};
		(fragmentsFile.meta as Record<string, unknown>).updated_at = new Date().toISOString();
		writeFileSync(fragmentsPath, JSON.stringify(fragmentsFile, null, 2) + '\n', 'utf8');

		return {
			stage: 'fragmentTextEdit' as const,
			success: true,
			corpusId,
			fragmentId,
			text: newText
		};
	},

	// --- Append rows to a corpus (CSV / JSON paste from the UI) ---
	// Mirrors scripts/import-forum-as-fragments.mjs, but operates on rows
	// arriving from the analyst's paste instead of an on-disk input_file.
	// Reads the corpus's existing ingest.config.json for license / context map /
	// long-fragment-split thresholds. Upserts new fragments by id (idempotent on
	// the same rows), updates manifest partition counts + updated_at.
	addToCorpus: async ({ request }) => {
		const fd = await request.formData();
		const corpusId = String(fd.get('corpus_id') ?? '').trim();
		const rowsRaw = String(fd.get('rows') ?? '');
		// dry_run=1 returns the projection breakdown without touching disk. The
		// dialog calls this first so the analyst sees how many fragments would
		// be NEW vs OVERWRITE existing ids before committing — the original
		// silent-clobber behavior was the bug that motivated this flow.
		const dryRun = String(fd.get('dry_run') ?? '') === '1';
		// run_autotag=1 (only sent on the real write, not the dry-run preview)
		// kicks off propose-fragment-themes/sentiment/stages in the background
		// after the write succeeds. Opt-in because Claude calls aren't free,
		// and an analyst re-ingesting a known-good source rarely wants to
		// re-spend on tagging.
		const runAutotag = String(fd.get('run_autotag') ?? '') === '1';
		if (!corpusId) return fail(400, { error: 'Missing corpus_id.' });

		// Read/write paths go through corpus-store: dev hits disk, prod hits
		// Redis with bundled seeds as fallback. The action now runs in both
		// environments — the prior dev-only gate is gone.

		let inputRows: ForumRow[];
		try {
			const parsed = JSON.parse(rowsRaw);
			if (!Array.isArray(parsed)) throw new Error('rows must be an array');
			inputRows = parsed as ForumRow[];
		} catch (err) {
			return fail(400, { error: `rows was not a valid JSON array: ${(err as Error).message}` });
		}
		if (inputRows.length === 0) {
			return fail(400, { error: 'No rows to add.' });
		}

		const config = await loadCorpusIngestConfig<ForumIngestConfig>(corpusId);
		if (!config) {
			return fail(404, {
				error: `Corpus "${corpusId}" has no ingest.config.json — append-from-UI is only supported for corpora with an ingest config.`
			});
		}
		if (config.corpus_id && config.corpus_id !== corpusId) {
			return fail(400, {
				error: `Config corpus_id "${config.corpus_id}" disagrees with route arg "${corpusId}".`
			});
		}

		// Load the existing corpus so we can append onto its existing fragments
		// rather than overwriting them.
		const existing = await readCorpus(corpusId);
		if (!existing) {
			return fail(404, { error: `Corpus "${corpusId}" manifest not readable.` });
		}

		// Seed the (Thread, Conversation) → social_post/comment classifier with
		// every (Thread, Conversation) pair already present in the corpus, so a
		// row whose thread already has an OP becomes a comment (not a duplicate OP).
		const seenThreadConv = new Set<string>();
		for (const f of existing.fragments) {
			const ref = f.source_ref;
			if (
				ref.kind === 'social_post' ||
				ref.kind === 'social_comment' ||
				ref.kind === 'forum_post' ||
				ref.kind === 'forum_comment' ||
				ref.kind === 'blog_post' ||
				ref.kind === 'blog_comment'
			) {
				// post_id encodes Thread + Conversation as `${corpusId}-T<n>-C<n>`,
				// so the pair-key is implicit in the post_id itself.
				seenThreadConv.add(ref.post_id);
			}
		}

		const projection = projectForumRows({
			corpusId,
			config,
			rows: inputRows,
			seenThreadConv
		});
		if (projection.errors.length > 0) {
			return fail(400, {
				error: `Validation failed: ${projection.errors.slice(0, 5).join('; ')}${
					projection.errors.length > 5 ? ` (+${projection.errors.length - 5} more)` : ''
				}`
			});
		}
		const allNew = [
			...projection.fragmentsByContentSource.social_post,
			...projection.fragmentsByContentSource.social_comment
		];
		if (allNew.length === 0) {
			return fail(400, { error: 'No fragments produced from the input rows.' });
		}

		// Compute new vs overwrite breakdown. Same map used to drive both the
		// dry-run preview and the real write — keeps the count the dialog shows
		// identical to what actually lands on disk.
		const existingIds = new Set(existing.fragments.map((f) => f.id));
		type PartitionPlan = { newIds: string[]; overwriteIds: string[] };
		const plan: Record<string, PartitionPlan> = {};
		for (const [contentSource, fresh] of Object.entries(projection.fragmentsByContentSource)) {
			if (fresh.length === 0) continue;
			plan[contentSource] = { newIds: [], overwriteIds: [] };
			for (const f of fresh) {
				if (existingIds.has(f.id)) plan[contentSource].overwriteIds.push(f.id);
				else plan[contentSource].newIds.push(f.id);
			}
		}
		const summary = {
			totalNew: Object.values(plan).reduce((n, p) => n + p.newIds.length, 0),
			totalOverwrite: Object.values(plan).reduce((n, p) => n + p.overwriteIds.length, 0),
			perPartition: Object.fromEntries(
				Object.entries(plan).map(([k, v]) => [
					k,
					{ new: v.newIds.length, overwrite: v.overwriteIds.length }
				])
			),
			overwriteSample: Object.values(plan)
				.flatMap((p) => p.overwriteIds)
				.slice(0, 5)
		};

		if (dryRun) {
			return {
				stage: 'corpusAppendPreview' as const,
				success: true,
				corpusId,
				summary,
				stats: projection.stats
			};
		}

		// Persist per-partition via corpus-store. Upsert by id so a re-run with
		// overlapping rows updates rather than duplicates.
		const nowIso = new Date().toISOString();
		const partitionCounts: Record<string, number> = {};
		for (const [contentSource, fresh] of Object.entries(projection.fragmentsByContentSource)) {
			if (fresh.length === 0) continue;
			const existingPart = await loadCorpusFragments(corpusId, contentSource);
			const file: { meta: Record<string, unknown>; fragments: Fragment[] } = existingPart ?? {
				meta: {
					schema_version: '1.0',
					corpus_id: corpusId,
					content_source: contentSource,
					platform: config.platform,
					generated_at: nowIso,
					generator: 'src/routes/patientlyiq/upload addToCorpus action',
					ingester_version: FORUM_INGEST_INLINE_VERSION,
					sources: ['ui-paste'],
					fragment_count: 0,
					notes: ['Created by analyst paste in /patientlyiq/upload (corpus mode).']
				},
				fragments: []
			};
			const byId = new Map(file.fragments.map((f) => [f.id, f] as const));
			for (const f of fresh) byId.set(f.id, f);
			file.fragments = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
			(file.meta as Record<string, unknown>).fragment_count = file.fragments.length;
			(file.meta as Record<string, unknown>).updated_at = nowIso;
			await saveCorpusFragments(corpusId, contentSource, file);
			partitionCounts[contentSource] = file.fragments.length;

			// Make sure an annotations doc exists for the partition — the retag
			// drawer assumes one is present even when empty.
			const annExisting = await loadCorpusAnnotations(corpusId, contentSource);
			if (!annExisting) {
				await saveCorpusAnnotations(corpusId, contentSource, {
					meta: {
						schema_version: '1.0',
						corpus_id: corpusId,
						content_source: contentSource as ContentSourceId,
						updated_at: nowIso
					},
					annotations: {}
				});
			}
		}

		// Refresh the manifest partition list — keep existing partition entries
		// that weren't touched, update or add the ones we wrote.
		const manifest = (await loadCorpusManifest(corpusId)) as CorpusManifest;
		const partitionsById = new Map(manifest.partitions.map((p) => [p.content_source, p]));
		for (const [contentSource, count] of Object.entries(partitionCounts)) {
			partitionsById.set(contentSource as ContentSourceId, {
				content_source: contentSource as ContentSourceId,
				fragment_count: count,
				ingester_version: FORUM_INGEST_INLINE_VERSION,
				last_ingested_at: nowIso
			});
		}
		manifest.partitions = [...partitionsById.values()];
		manifest.updated_at = nowIso;
		await saveCorpusManifest(corpusId, manifest);

		// Kick off the AI tagging chain if the analyst opted in. The
		// propose-fragment-* steps self-target only batches whose fragments
		// lack a *_generator marker, so they naturally tag only the new ones
		// we just wrote.
		//
		// In dev the chain runs as background spawns; we return immediately
		// and the page polls /patientlyiq/autotag-corpus. In prod we await
		// the chain so the serverless function instance stays alive until it
		// finishes — same pattern as the interview `parse` action's autotag.
		let autotagStarted = false;
		let autotagError: string | null = null;
		if (runAutotag) {
			try {
				const { started, completion } = await startCorpusAutotag(corpusId);
				autotagStarted = started;
				if (!dev) await completion;
			} catch (err) {
				autotagError = (err as Error).message;
			}
		}

		return {
			stage: 'corpusAppend' as const,
			success: true,
			corpusId,
			added: allNew.length,
			summary,
			partitions: partitionCounts,
			stats: projection.stats,
			autotagStarted,
			autotagError
		};
	},

	// --- Per-instance keyword tag for a fragment (tag / untag) ---
	saveFragmentKeywordTag: async ({ request }) => {
		const fd = await request.formData();
		const corpusId = String(fd.get('corpus_id') ?? '').trim();
		const fragmentId = String(fd.get('fragment_id') ?? '').trim();
		const keywordId = String(fd.get('keyword_id') ?? '').trim();
		const action = String(fd.get('action') ?? 'tag');
		const charStart = Number(fd.get('char_start'));
		const charEnd = Number(fd.get('char_end'));
		const expectedSurface = fd.get('expected_surface');
		const reviewerNotes = String(fd.get('reviewer_notes') ?? '');

		if (!corpusId || !fragmentId || !keywordId) {
			return fail(400, { error: 'Missing corpus_id / fragment_id / keyword_id.' });
		}
		if (!Number.isInteger(charStart) || !Number.isInteger(charEnd)) {
			return fail(400, { error: 'char_start / char_end must be integers.' });
		}
		if (action !== 'tag' && action !== 'untag') {
			return fail(400, { error: `Unknown action "${action}".` });
		}

		if (!dev) {
			return fail(503, {
				error:
					'Fragment keyword tagging is dev-only — the function filesystem is read-only in prod.'
			});
		}

		const corpus = await readCorpus(corpusId);
		if (!corpus) return fail(404, { error: `Corpus ${corpusId} not found.` });
		const fragment = corpus.fragments.find((f) => f.id === fragmentId);
		if (!fragment) return fail(404, { error: `Fragment ${fragmentId} not found.` });

		if (action === 'untag') {
			const result = removeFragmentKeywordTag({
				corpusId,
				contentSource: fragment.content_source,
				fragmentId,
				keywordId,
				charStart,
				charEnd
			});
			return { stage: 'fragmentKeywordTag' as const, success: true, action, tags: result.tags };
		}

		// Validate the cluster against the active indication's lexicon slice.
		// readCorpus() already filtered to this corpus's primary indication;
		// load the slice fresh to avoid a stale closure.
		const indication = corpus.manifest.indications[0];
		const slice = (await import('$lib/server/lexicon')).getLexiconSlice(indication);
		const sliceVal = await slice;
		const clusterIds = new Set(sliceVal.clusters.map((c) => c.id));

		const result = addFragmentKeywordTag({
			corpusId,
			fragment,
			keywordId,
			charStart,
			charEnd,
			expectedSurface: typeof expectedSurface === 'string' ? expectedSurface : undefined,
			reviewerNotes: reviewerNotes || undefined,
			clusterIds
		});
		if (!result.ok) return fail(400, { error: result.error });

		return {
			stage: 'fragmentKeywordTag' as const,
			success: true,
			action,
			tags: result.tags
		};
	}
};
