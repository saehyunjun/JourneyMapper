/**
 * propose-questions.mjs
 *
 * Step 3 of the interview analysis system: question normalization.
 *
 * Maps every interviewer turn in `interviews_structured.json` to a canonical
 * `question_id` from `questions.json`, plus a `turn_role` (question / probe /
 * acknowledgment / admin) and a `confidence`.
 *
 * Replaces the old hand-coded LABELS table inside build-question-map.mjs with a
 * Claude API call — exactly the migration propose-segment-tags.mjs did for the
 * step-5 TAGS table. The interviewer no longer hand-assigns questions on the
 * upload page; this script proposes them and the upload review view pre-fills
 * with the proposal so an analyst only confirms or corrects.
 *
 * One API call per interview. The model sees the whole transcript (both
 * speakers, in turn order) for context and maps only the interviewer turns.
 * question_id and turn_role are JSON-schema-enum-constrained, so the model
 * cannot emit an id outside questions.json. Coverage is re-checked here.
 *
 * Output is unreviewed: every mapping is written `source: "ai_proposed"`,
 * `review_status: "pending"`. Interviews already mapped `source: "human"`
 * (analyst-confirmed) are left untouched unless named explicitly.
 *
 * Run:
 *   node scripts/propose-questions.mjs                  # interviews with no map
 *   node scripts/propose-questions.mjs participant_08   # one interview
 *   node scripts/propose-questions.mjs participant_09 --force  # re-propose
 *
 * Requires ANTHROPIC_API_KEY in the environment.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const STRUCTURED_FILE = 'src/lib/content/wctglpdemo-data/interviews_structured.json';
const QUESTIONS_FILE = 'src/lib/content/wctglpdemo-data/questions.json';
const QUESTION_MAP_FILE = 'src/lib/content/wctglpdemo-data/question_map.json';
const SEGMENTS_FILE = 'src/lib/content/wctglpdemo-data/segments.json';

// Swap to 'claude-sonnet-4-6' for a cheaper run.
const MODEL = 'claude-opus-4-7';

const VALID_ROLES = ['question', 'probe', 'acknowledgment', 'admin'];

// Load ANTHROPIC_API_KEY from JourneyMapper/.env if present (.env is gitignored).
if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));

if (!process.env.ANTHROPIC_API_KEY) {
	console.error('x ANTHROPIC_API_KEY is not set.');
	console.error('  Add it to JourneyMapper/.env  (ANTHROPIC_API_KEY=sk-ant-...)  or export it.');
	process.exit(1);
}

// --- Load inputs ---
const structured = JSON.parse(readFileSync(resolve(ROOT, STRUCTURED_FILE), 'utf8'));
const codebook = JSON.parse(readFileSync(resolve(ROOT, QUESTIONS_FILE), 'utf8'));
const questionIds = codebook.questions.map((q) => q.question_id);
const validQuestionIds = new Set(questionIds);

const interviewById = new Map(structured.interviews.map((iv) => [iv.interview_id, iv]));
const allInterviews = [...interviewById.keys()].sort();

let questionMap = { meta: {}, interviews: [] };
if (existsSync(resolve(ROOT, QUESTION_MAP_FILE))) {
	questionMap = JSON.parse(readFileSync(resolve(ROOT, QUESTION_MAP_FILE), 'utf8'));
}
const mapByInterview = new Map(questionMap.interviews.map((iv) => [iv.interview_id, iv]));

const isMapped = (iv) => mapByInterview.has(iv);
// An interview an analyst has already confirmed — never re-propose without an
// explicit interview id, or human work would be silently overwritten.
const isHumanConfirmed = (iv) => {
	const entry = mapByInterview.get(iv);
	return !!entry && entry.mappings.length > 0 && entry.mappings.every((m) => m.source === 'human');
};

// --- Resolve target interviews ---
const args = process.argv.slice(2);
const force = args.includes('--force');
const argInterviews = args.filter((a) => !a.startsWith('-'));

for (const iv of argInterviews) {
	if (!interviewById.has(iv)) {
		console.error(`x Unknown interview "${iv}". Known: ${allInterviews.join(', ')}`);
		process.exit(1);
	}
}

const targets = argInterviews.length
	? argInterviews
	: allInterviews.filter((iv) => (!isMapped(iv) || force) && !isHumanConfirmed(iv));

if (targets.length === 0) {
	console.log('Nothing to do — every interview is already mapped (or analyst-confirmed).');
	console.log('Pass an interview id, or add --force, to re-propose.');
	process.exit(0);
}

for (const iv of targets) {
	if (isHumanConfirmed(iv)) {
		console.warn(`! ${iv} is analyst-confirmed — re-proposing will overwrite confirmed mappings.`);
	}
}

// --- Schema + cached system prompt ---
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
					turn_role: { type: 'string', enum: VALID_ROLES },
					confidence: { type: 'number' },
					note: { type: 'string' }
				},
				required: ['turn_index', 'question_id', 'turn_role', 'confidence', 'note']
			}
		}
	},
	required: ['mappings']
};

const SYSTEM_PROMPT = `You normalize interviewer turns in research-interview transcripts to a fixed bank of canonical study questions, for the WCT GLP-1 weight-maintenance trial study.

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
${JSON.stringify(codebook.questions, null, 2)}`;

// --- Propose mappings for one interview (one API call) ---
const client = new Anthropic();

async function proposeForInterview(interviewId) {
	const interview = interviewById.get(interviewId);
	const payload = interview.turns.map((t) => ({
		turn_index: t.turn_index,
		speaker: t.speaker,
		text: t.text
	}));

	const stream = client.messages.stream({
		model: MODEL,
		max_tokens: 16000,
		thinking: { type: 'adaptive' },
		output_config: { effort: 'high', format: { type: 'json_schema', schema: responseSchema } },
		system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
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
	const u = msg.usage;
	console.log(
		`  usage: in=${u.input_tokens} cache_write=${u.cache_creation_input_tokens} ` +
			`cache_read=${u.cache_read_input_tokens} out=${u.output_tokens}`
	);
	if (msg.stop_reason === 'max_tokens') {
		throw new Error(`${interviewId}: response hit max_tokens — output truncated. Raise max_tokens.`);
	}
	if (msg.stop_reason === 'refusal') throw new Error(`${interviewId}: model refused to respond.`);

	const textBlock = msg.content.find((b) => b.type === 'text');
	if (!textBlock) throw new Error(`${interviewId}: no text block in response.`);
	let parsed;
	try {
		parsed = JSON.parse(textBlock.text);
	} catch (e) {
		throw new Error(`${interviewId}: response was not valid JSON — ${e.message}`);
	}
	if (!Array.isArray(parsed.mappings)) {
		throw new Error(`${interviewId}: response had no "mappings" array.`);
	}
	return parsed.mappings;
}

// --- Main ---
console.log(`Model: ${MODEL}`);
console.log(`Proposing question mappings for: ${targets.join(', ')}\n`);

for (const iv of targets) {
	const interview = interviewById.get(iv);
	const interviewerIndices = interview.turns
		.filter((t) => t.speaker === 'interviewer')
		.map((t) => t.turn_index);
	console.log(`${iv} (${interviewerIndices.length} interviewer turns)...`);

	const raw = await proposeForInterview(iv);

	// Coverage: exactly one mapping per interviewer turn, nothing else mapped.
	const got = new Map(raw.map((m) => [m.turn_index, m]));
	const expected = new Set(interviewerIndices);
	const missing = interviewerIndices.filter((idx) => !got.has(idx));
	const extra = [...got.keys()].filter((idx) => !expected.has(idx));
	if (missing.length || extra.length || got.size !== raw.length) {
		console.error(`x ${iv}: coverage mismatch — no files written.`);
		if (missing.length) console.error(`  missing turns: ${missing.join(', ')}`);
		if (extra.length) console.error(`  turns mapped but not interviewer turns: ${extra.join(', ')}`);
		if (got.size !== raw.length) console.error(`  duplicate turn_index in response.`);
		process.exit(1);
	}

	const mappings = interviewerIndices
		.sort((a, b) => a - b)
		.map((idx) => {
			const m = got.get(idx);
			if (!validQuestionIds.has(m.question_id)) {
				console.error(`x ${iv} turn ${idx}: unknown question_id "${m.question_id}".`);
				process.exit(1);
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

	mapByInterview.set(iv, { interview_id: iv, mapping_count: mappings.length, mappings });
	const byRole = {};
	for (const m of mappings) byRole[m.turn_role] = (byRole[m.turn_role] ?? 0) + 1;
	const roleStr = Object.entries(byRole)
		.map(([r, n]) => `${r}: ${n}`)
		.join(', ');
	console.log(`  ${iv}: ${mappings.length} interviewer turns (${roleStr})\n`);
}

// --- Propagate question_id into segments.json ---
// Each participant segment inherits the question_id of the most recent mapped
// interviewer turn before it — same rule build-segments.mjs applies.
function inheritedQuestionId(interviewId, turnIndex) {
	const entry = mapByInterview.get(interviewId);
	if (!entry) return null;
	let qid = null;
	for (const m of [...entry.mappings].sort((a, b) => a.turn_index - b.turn_index)) {
		if (m.turn_index < turnIndex) qid = m.question_id;
		else break;
	}
	return qid;
}

let segmentsUpdated = 0;
if (existsSync(resolve(ROOT, SEGMENTS_FILE))) {
	const segData = JSON.parse(readFileSync(resolve(ROOT, SEGMENTS_FILE), 'utf8'));
	const targetSet = new Set(targets);
	for (const s of segData.segments) {
		if (!targetSet.has(s.interview_id)) continue;
		s.question_id = inheritedQuestionId(s.interview_id, s.turn_index);
		segmentsUpdated++;
	}
	if (segmentsUpdated > 0) {
		segData.meta.generated_at = new Date().toISOString();
		writeFileSync(resolve(ROOT, SEGMENTS_FILE), JSON.stringify(segData, null, 2) + '\n', 'utf8');
	}
}

// --- Write question_map.json ---
const mappedInterviews = [...mapByInterview.values()].sort((a, b) =>
	a.interview_id.localeCompare(b.interview_id)
);
const output = {
	meta: {
		...questionMap.meta,
		schema_version: '1.0',
		study_id: structured.meta.study_id,
		generated_at: new Date().toISOString(),
		generator: 'scripts/propose-questions.mjs',
		sources: [STRUCTURED_FILE, QUESTIONS_FILE],
		labels_status: 'ai_proposed',
		model: MODEL,
		notes: [
			'Maps interviewer turns to canonical question_ids. AI-proposed mappings are written by scripts/propose-questions.mjs.',
			'Every AI mapping has review_status "pending"; confirm or correct it on the upload review view, which writes source "human".',
			'turn_role distinguishes canonical questions from probes, acknowledgments, and admin turns.',
			'Acknowledgment/admin turns carry the surrounding question_id for response continuity.'
		]
	},
	interviews: mappedInterviews
};
writeFileSync(resolve(ROOT, QUESTION_MAP_FILE), JSON.stringify(output, null, 2) + '\n', 'utf8');

console.log(`Wrote ${QUESTION_MAP_FILE} (${mappedInterviews.length} interviews)`);
if (segmentsUpdated > 0) {
	console.log(`Wrote ${SEGMENTS_FILE} (${segmentsUpdated} segments re-inherited question_id)`);
}
const lowConf = targets
	.flatMap((iv) => mapByInterview.get(iv).mappings.map((m) => ({ iv, ...m })))
	.filter((m) => m.confidence < 0.8);
console.log(`  ${lowConf.length} mapping(s) below 0.8 confidence flagged for priority review:`);
for (const m of lowConf) {
	console.log(`    ${m.iv} turn ${m.turn_index} -> ${m.question_id} (${m.confidence}) ${m.reviewer_notes}`);
}
console.log(`Next: review the question mapping on /wctglpdemo/upload, then confirm it.`);
