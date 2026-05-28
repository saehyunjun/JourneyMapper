/**
 * propose-persona-goals-barriers.mjs
 *
 * Per-participant goals/barriers, generated from their tagged segments.
 *
 * For each participant with at least one annotation, sends every tagged
 * segment (with sentiment + theme/subtheme labels + raw text) to Claude in
 * one call and gets back exactly 3 goals + 3 barriers, each as a short,
 * specific paraphrase plus the segment_ids it's grounded on. Writes the
 * merged result to persona_goals_barriers.json.
 *
 * Design notes:
 *  - One API call per participant. The codebook + voice/style instructions
 *    are a cached system prefix so every participant after the first is a
 *    prompt-cache hit.
 *  - Output is constrained with a JSON-schema enum: every cited segment_id
 *    must belong to the participant; every subtheme_id must be in the
 *    codebook. Coverage and subtheme integrity are re-checked client-side.
 *  - Each goal/barrier carries 1–2 supporting segment_ids so the persona
 *    page can deep-link a click into the existing segment drawer.
 *
 * Run:
 *   node scripts/propose-persona-goals-barriers.mjs                  # every participant w/ tags
 *   node scripts/propose-persona-goals-barriers.mjs participant_06   # just one
 *   node scripts/propose-persona-goals-barriers.mjs --force          # re-generate all
 *   node scripts/propose-persona-goals-barriers.mjs participant_06 --force
 *
 * Requires ANTHROPIC_API_KEY in the environment (loaded from JourneyMapper/.env if present).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SEGMENTS_FILE = 'src/lib/content/wctglpdemo-data/segments.json';
const TAGS_FILE = 'src/lib/content/wctglpdemo-data/segment_tags.json';
const CODEBOOK_FILE = 'src/lib/content/wctglpdemo-data/codebook.json';
const OUTPUT_FILE = 'src/lib/content/wctglpdemo-data/persona_goals_barriers.json';

const MODEL = 'claude-opus-4-7';

if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));

if (!process.env.ANTHROPIC_API_KEY) {
	console.error('x ANTHROPIC_API_KEY is not set.');
	console.error('  Add it to JourneyMapper/.env  (ANTHROPIC_API_KEY=sk-ant-...)  or export it.');
	process.exit(1);
}

// --- Load inputs ---
const segmentsData = JSON.parse(readFileSync(resolve(ROOT, SEGMENTS_FILE), 'utf8'));
const tagsData = JSON.parse(readFileSync(resolve(ROOT, TAGS_FILE), 'utf8'));
const codebook = JSON.parse(readFileSync(resolve(ROOT, CODEBOOK_FILE), 'utf8'));

const segmentById = new Map(segmentsData.segments.map((s) => [s.segment_id, s]));
const annotationsBySegment = new Map(tagsData.annotations.map((a) => [a.segment_id, a]));

const subthemeIds = codebook.themes.flatMap((t) => (t.subthemes ?? []).map((s) => s.id));
const subthemeLabelById = new Map();
for (const t of codebook.themes) {
	for (const s of t.subthemes ?? []) {
		subthemeLabelById.set(s.id, s.label ?? s.id);
	}
}

// Tagged participants: anyone with at least one annotation that carries a
// theme or subtheme. Participants with only bare-affirmation segments aren't
// useful inputs here.
const taggedByParticipant = new Map();
for (const a of tagsData.annotations) {
	if (!a.themes?.length && !a.subthemes?.length) continue;
	if (!taggedByParticipant.has(a.interview_id)) taggedByParticipant.set(a.interview_id, []);
	taggedByParticipant.get(a.interview_id).push(a);
}
const allParticipants = [...taggedByParticipant.keys()].sort();

// --- Resolve targets ---
const args = process.argv.slice(2);
const force = args.includes('--force');
const argParticipants = args.filter((a) => !a.startsWith('-'));

for (const p of argParticipants) {
	if (!taggedByParticipant.has(p)) {
		console.error(`x Unknown or untagged participant "${p}". Tagged: ${allParticipants.join(', ')}`);
		process.exit(1);
	}
}

let existing = { meta: {}, personas: {} };
if (existsSync(resolve(ROOT, OUTPUT_FILE))) {
	existing = JSON.parse(readFileSync(resolve(ROOT, OUTPUT_FILE), 'utf8'));
}
const personas = { ...(existing.personas ?? {}) };

// Drop any cached entries whose participant no longer has annotations.
let prunedStale = 0;
for (const id of Object.keys(personas)) {
	if (!taggedByParticipant.has(id)) {
		delete personas[id];
		prunedStale++;
	}
}
if (prunedStale > 0) {
	console.log(`Pruned ${prunedStale} stale entry/entries for participants no longer tagged.`);
}

const targets = argParticipants.length
	? argParticipants
	: allParticipants.filter((p) => force || !personas[p]);

if (targets.length === 0) {
	console.log('Nothing to generate — every tagged participant already has goals/barriers.');
	console.log('Pass a participant id, or add --force, to re-generate.');
	process.exit(0);
}

// --- System prompt — cached prefix ---
const SYSTEM_PROMPT = `You are a qualitative-research analyst writing the "Goals" and "Barriers" panels of a per-participant persona profile for the WCT GLP-1 study.

For ONE participant you will receive every segment of their interview that was tagged with a theme or subtheme, in transcript order, with the segment text, the subtheme labels we applied, and the sentiment we coded (-2 most negative … +2 most positive).

Return exactly 3 goals and exactly 3 barriers. Each item must be:
- ONE sentence, 8–18 words. No leading "wants to" / "struggles to" boilerplate.
- Specific to THIS participant: name the medication, condition, family role, work situation, geography, or life event they actually talked about. If they mentioned ozempic-mounjaro confusion, semaglutide cost, a sister with diabetes, fear of needles, a cruise next year, a previous diagnosis — those details belong in the copy.
- Grounded in the participant's own perspective and emotional register. If they were resigned, the copy should sound resigned; if defiant, defiant.
- Tied to 1 or 2 supporting segment_ids that the reader could click on to verify the claim.
- Optionally tied to one subtheme_id from the codebook that best frames the goal/barrier.

What counts:
- A GOAL is something the participant is reaching for, hoping to keep, or actively working toward — not just a positive sentiment. Look at positive- or neutral-sentiment segments where they talk about plans, motivations, decision factors, or what they want their life to look like.
- A BARRIER is a specific obstacle, gap, or friction they hit — clinical, financial, informational, social, logistical, or emotional. Look at negative-sentiment segments and at any segment that names a thing standing in their way.

Avoid:
- Generic phrases ("wants better care", "lacks information", "faces stigma"). Replace with the specific care, information, or stigma they described.
- Restating subtheme labels back to us ("Barriers to treatment access"). The subtheme_id is metadata; the summary should be in plain English about THIS person.
- Mixing pieces from different topics into one item. Each item should feel like one coherent thought.

CODEBOOK subtheme ids (for optional subtheme_id field):
${JSON.stringify(
	codebook.themes.map((t) => ({
		theme: t.id,
		subthemes: (t.subthemes ?? []).map((s) => ({ id: s.id, label: s.label }))
	})),
	null,
	2
)}`;

// --- Per-participant call ---
const client = new Anthropic();

function buildSchema(allowedSegmentIds) {
	// Anthropic structured-output rejects array minItems/maxItems other than 0 or 1.
	// Counts (3 goals / 3 barriers, 1-2 supporting_segment_ids per item) are
	// stated in the system prompt and verified client-side after the call.
	const itemSchema = {
		type: 'object',
		additionalProperties: false,
		properties: {
			summary: { type: 'string' },
			supporting_segment_ids: {
				type: 'array',
				items: { type: 'string', enum: allowedSegmentIds }
			},
			subtheme_id: {
				anyOf: [{ type: 'string', enum: subthemeIds }, { type: 'null' }]
			}
		},
		required: ['summary', 'supporting_segment_ids', 'subtheme_id']
	};
	return {
		type: 'object',
		additionalProperties: false,
		properties: {
			goals: { type: 'array', items: itemSchema },
			barriers: { type: 'array', items: itemSchema }
		},
		required: ['goals', 'barriers']
	};
}

async function proposeForParticipant(participantId) {
	const annotations = taggedByParticipant.get(participantId);

	// Build the payload: every tagged segment for this participant, with text +
	// labels + sentiment. Sorted by transcript order so the model reads the
	// conversation as it unfolded.
	const payload = annotations
		.map((a) => {
			const seg = segmentById.get(a.segment_id);
			if (!seg) return null;
			return {
				segment_id: a.segment_id,
				turn_index: seg.turn_index,
				segment_index: seg.segment_index,
				text: seg.text,
				subthemes: (a.subthemes ?? []).map((id) => ({
					id,
					label: subthemeLabelById.get(id) ?? id
				})),
				themes: a.themes ?? [],
				sentiment: a.sentiment,
				emotions: a.emotions ?? []
			};
		})
		.filter(Boolean)
		.sort((a, b) =>
			a.turn_index !== b.turn_index
				? a.turn_index - b.turn_index
				: a.segment_index - b.segment_index
		);

	const allowedSegmentIds = payload.map((p) => p.segment_id);
	const schema = buildSchema(allowedSegmentIds);

	const stream = client.messages.stream({
		model: MODEL,
		max_tokens: 8000,
		thinking: { type: 'adaptive' },
		output_config: { effort: 'high', format: { type: 'json_schema', schema } },
		system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
		messages: [
			{
				role: 'user',
				content:
					`Participant "${participantId}". Return 3 goals + 3 barriers grounded in these tagged ` +
					`segments (in transcript order):\n\n${JSON.stringify(payload, null, 2)}`
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
		throw new Error(`${participantId}: response hit max_tokens — output truncated. Raise max_tokens.`);
	}
	if (msg.stop_reason === 'refusal') {
		throw new Error(`${participantId}: model refused to respond.`);
	}

	const textBlock = msg.content.find((b) => b.type === 'text');
	if (!textBlock) throw new Error(`${participantId}: no text block in response.`);

	let parsed;
	try {
		parsed = JSON.parse(textBlock.text);
	} catch (e) {
		throw new Error(`${participantId}: response was not valid JSON — ${e.message}`);
	}

	for (const kind of ['goals', 'barriers']) {
		if (!Array.isArray(parsed[kind]) || parsed[kind].length < 3) {
			throw new Error(`${participantId}: expected at least 3 ${kind}, got ${parsed[kind]?.length}.`);
		}
		if (parsed[kind].length > 3) {
			console.log(`  trimmed ${kind} from ${parsed[kind].length} to top 3.`);
			parsed[kind] = parsed[kind].slice(0, 3);
		}
		for (const item of parsed[kind]) {
			const n = item.supporting_segment_ids?.length ?? 0;
			if (n < 1) {
				throw new Error(
					`${participantId}: ${kind} item must cite at least one supporting_segment_id.`
				);
			}
			for (const sid of item.supporting_segment_ids) {
				if (!allowedSegmentIds.includes(sid)) {
					throw new Error(
						`${participantId}: ${kind} item cited segment_id "${sid}" not in this participant's tagged set.`
					);
				}
			}
			if (item.subtheme_id !== null && !subthemeIds.includes(item.subtheme_id)) {
				throw new Error(
					`${participantId}: ${kind} item cited unknown subtheme_id "${item.subtheme_id}".`
				);
			}
		}
	}

	return parsed;
}

// --- Main ---
console.log(`Model: ${MODEL}`);
console.log(`Generating goals/barriers for: ${targets.join(', ')}\n`);

for (const p of targets) {
	const tagged = taggedByParticipant.get(p);
	console.log(`${p} (${tagged.length} tagged segments)...`);
	const result = await proposeForParticipant(p);
	personas[p] = result;
	console.log(`  ${p}: 3 goals + 3 barriers OK.\n`);
}

// --- Write merged output ---
const output = {
	meta: {
		schema_version: '1.0',
		study_id: tagsData.meta.study_id,
		generated_at: new Date().toISOString(),
		generator: 'scripts/propose-persona-goals-barriers.mjs',
		model: MODEL,
		codebook_schema_version: codebook.meta.schema_version,
		segment_tags_generated_at: tagsData.meta.generated_at,
		participants: Object.keys(personas).sort(),
		notes: [
			'AI-generated persona goals (3) and barriers (3) per participant, grounded in their tagged segments.',
			'Each item carries 1–2 supporting_segment_ids and optionally one subtheme_id.',
			'supporting_segment_ids are constrained to the participant\'s own segments at generation time.',
			'Re-generate one participant with: node scripts/propose-persona-goals-barriers.mjs <participant_id> --force'
		]
	},
	personas: Object.fromEntries(Object.keys(personas).sort().map((k) => [k, personas[k]]))
};

writeFileSync(resolve(ROOT, OUTPUT_FILE), JSON.stringify(output, null, 2) + '\n', 'utf8');

console.log(`Wrote ${OUTPUT_FILE}`);
console.log(`  ${Object.keys(personas).length} participants covered.`);
