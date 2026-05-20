/**
 * propose-segment-tags.mjs
 *
 * Step 5a of the interview analysis system: AI-proposed segment tags.
 *
 * Replaces the old hand-coded TAGS table inside build-segment-tags.mjs. For each
 * untagged interview it sends every segment of that interview to Claude in one
 * call and gets back theme/subtheme/emotion/sentiment tags, then merges
 * the result into segment_tags.proposed.json.
 *
 * This is the judgement step. Output is unreviewed: build-segment-tags.mjs
 * re-validates every annotation and writes it review_status "pending".
 *
 * Design notes:
 *  - One API call per interview. Segments are sent in transcript order so the
 *    model has cross-segment context; it still tags each segment on its own.
 *  - The codebook + tagging instructions are a stable, cached system prefix —
 *    every interview after the first in a run is a prompt-cache hit.
 *  - Tag ids are constrained with a JSON-schema enum, so the model cannot emit a
 *    tag that isn't in the codebook. build-segment-tags.mjs is the backstop.
 *
 * Run:
 *   node scripts/propose-segment-tags.mjs                  # all untagged interviews
 *   node scripts/propose-segment-tags.mjs participant_06   # one interview
 *   node scripts/propose-segment-tags.mjs participant_09 --force  # re-tag
 *
 * Requires ANTHROPIC_API_KEY in the environment.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SEGMENTS_FILE = 'src/lib/content/wctglpdemo-data/segments.json';
const CODEBOOK_FILE = 'src/lib/content/wctglpdemo-data/codebook.json';
const PROPOSED_FILE = 'src/lib/content/wctglpdemo-data/segment_tags.proposed.json';

// Swap to 'claude-sonnet-4-6' for a cheaper run; quality is close for this task.
const MODEL = 'claude-opus-4-7';

// Load ANTHROPIC_API_KEY from JourneyMapper/.env if present (.env is gitignored).
if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));

if (!process.env.ANTHROPIC_API_KEY) {
	console.error('x ANTHROPIC_API_KEY is not set.');
	console.error('  Add it to JourneyMapper/.env  (ANTHROPIC_API_KEY=sk-ant-...)  or export it.');
	process.exit(1);
}

// --- Load inputs ---
const segmentsData = JSON.parse(readFileSync(resolve(ROOT, SEGMENTS_FILE), 'utf8'));
const codebook = JSON.parse(readFileSync(resolve(ROOT, CODEBOOK_FILE), 'utf8'));

const segmentsByInterview = new Map();
for (const s of segmentsData.segments) {
	if (!segmentsByInterview.has(s.interview_id)) segmentsByInterview.set(s.interview_id, []);
	segmentsByInterview.get(s.interview_id).push(s);
}
const allInterviews = [...segmentsByInterview.keys()].sort();

let existing = { meta: {}, proposals: {} };
if (existsSync(resolve(ROOT, PROPOSED_FILE))) {
	existing = JSON.parse(readFileSync(resolve(ROOT, PROPOSED_FILE), 'utf8'));
}

// Carry forward existing proposals, but drop any whose segment_id is no longer
// in segments.json. Re-segmentation can delete or renumber segments, and a
// stale proposal key would otherwise linger here forever and fail the
// integrity check in build-segment-tags.mjs.
const currentSegmentIds = new Set(segmentsData.segments.map((s) => s.segment_id));
const proposals = {};
let prunedStale = 0;
for (const [id, proposal] of Object.entries(existing.proposals ?? {})) {
	if (currentSegmentIds.has(id)) proposals[id] = proposal;
	else prunedStale++;
}
if (prunedStale > 0) {
	console.log(`Pruned ${prunedStale} stale proposal(s) for segments no longer in segments.json.`);
}

const isFullyProposed = (iv) =>
	segmentsByInterview.get(iv).every((s) => s.segment_id in proposals);

// --- Resolve target interviews ---
const args = process.argv.slice(2);
const force = args.includes('--force');
const argInterviews = args.filter((a) => !a.startsWith('-'));

for (const iv of argInterviews) {
	if (!segmentsByInterview.has(iv)) {
		console.error(`x Unknown interview "${iv}". Known: ${allInterviews.join(', ')}`);
		process.exit(1);
	}
}

const targets = argInterviews.length
	? argInterviews
	: allInterviews.filter((iv) => force || !isFullyProposed(iv));

if (targets.length === 0) {
	console.log('Nothing to propose — every interview already has proposals.');
	console.log('Pass an interview id, or add --force, to re-tag.');
	process.exit(0);
}

// --- Codebook → enum lists + cached system prompt ---
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

const SYSTEM_PROMPT = `You are a qualitative-research analyst tagging interview-transcript segments for the WCT GLP-1 study.

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

// --- Propose tags for one interview (one API call) ---
const client = new Anthropic();

async function proposeForInterview(interviewId) {
	const segs = segmentsByInterview.get(interviewId);
	// question_id is intentionally NOT sent: the model must tag what the
	// participant's words are about, not what was asked. Including the
	// eliciting question biases sentiment on negation-shaped prompts
	// (e.g. "why would you stop") toward question-anchored codes.
	const payload = segs.map((s) => ({
		segment_id: s.segment_id,
		turn_index: s.turn_index,
		segment_index: s.segment_index,
		flags: s.flags,
		text: s.text
	}));

	const stream = client.messages.stream({
		model: MODEL,
		max_tokens: 32000,
		thinking: { type: 'adaptive' },
		output_config: { effort: 'high', format: { type: 'json_schema', schema: annotationSchema } },
		system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
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
	const u = msg.usage;
	console.log(
		`  usage: in=${u.input_tokens} cache_write=${u.cache_creation_input_tokens} ` +
			`cache_read=${u.cache_read_input_tokens} out=${u.output_tokens}`
	);

	if (msg.stop_reason === 'max_tokens') {
		throw new Error(`${interviewId}: response hit max_tokens — output truncated. Raise max_tokens.`);
	}
	if (msg.stop_reason === 'refusal') {
		throw new Error(`${interviewId}: model refused to respond.`);
	}

	const textBlock = msg.content.find((b) => b.type === 'text');
	if (!textBlock) throw new Error(`${interviewId}: no text block in response.`);

	let parsed;
	try {
		parsed = JSON.parse(textBlock.text);
	} catch (e) {
		throw new Error(`${interviewId}: response was not valid JSON — ${e.message}`);
	}
	if (!Array.isArray(parsed.annotations)) {
		throw new Error(`${interviewId}: response had no "annotations" array.`);
	}
	return parsed.annotations;
}

// --- Main ---
console.log(`Model: ${MODEL}`);
console.log(`Proposing tags for: ${targets.join(', ')}\n`);

for (const iv of targets) {
	const segs = segmentsByInterview.get(iv);
	console.log(`${iv} (${segs.length} segments)...`);
	const annotations = await proposeForInterview(iv);

	// Coverage check: exactly one annotation per segment, ids match.
	const got = new Map(annotations.map((a) => [a.segment_id, a]));
	const expected = segs.map((s) => s.segment_id);
	const missing = expected.filter((id) => !got.has(id));
	const extra = [...got.keys()].filter((id) => !expected.includes(id));
	if (missing.length || extra.length || got.size !== annotations.length) {
		console.error(`x ${iv}: coverage mismatch — segment_tags.proposed.json not written.`);
		if (missing.length) console.error(`  missing ${missing.length}: ${missing.slice(0, 6).join(', ')}`);
		if (extra.length) console.error(`  extra ${extra.length}: ${extra.slice(0, 6).join(', ')}`);
		if (got.size !== annotations.length) console.error(`  duplicate segment_ids in response.`);
		process.exit(1);
	}

	for (const id of expected) {
		const a = got.get(id);
		proposals[id] = {
			themes: a.themes,
			subthemes: a.subthemes,
			emotions: a.emotions,
			sentiment: a.sentiment,
			confidence: a.confidence,
			note: a.note ?? ''
		};
	}
	console.log(`  ${iv}: ${expected.length} segments tagged.\n`);
}

// --- Write merged proposals ---
const proposedInterviews = allInterviews.filter((iv) =>
	segmentsByInterview.get(iv).every((s) => s.segment_id in proposals)
);

const output = {
	meta: {
		schema_version: '1.0',
		study_id: segmentsData.meta.study_id,
		generated_at: new Date().toISOString(),
		generator: 'scripts/propose-segment-tags.mjs',
		model: MODEL,
		codebook_schema_version: codebook.meta.schema_version,
		proposed_interviews: proposedInterviews,
		notes: [
			'AI-proposed theme/subtheme/emotion/sentiment tags, one entry per segment_id.',
			'Tag ids are constrained to codebook.json at generation time (JSON-schema enum) and re-validated by build-segment-tags.mjs.',
			'Every entry is unreviewed — build-segment-tags.mjs writes them as review_status "pending".',
			'Re-propose an interview with: node scripts/propose-segment-tags.mjs <interview_id> --force'
		]
	},
	proposals: Object.fromEntries(Object.keys(proposals).sort().map((k) => [k, proposals[k]]))
};

writeFileSync(resolve(ROOT, PROPOSED_FILE), JSON.stringify(output, null, 2) + '\n', 'utf8');

console.log(`Wrote ${PROPOSED_FILE}`);
console.log(`  ${Object.keys(proposals).length} proposals; proposed interviews: ${proposedInterviews.join(', ')}`);
console.log(`Next: node scripts/build-segment-tags.mjs`);
