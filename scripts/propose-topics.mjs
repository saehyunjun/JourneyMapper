/**
 * propose-topics.mjs
 *
 * Step 5c of the interview analysis system: emergent conversation-topic tags.
 *
 * Theme tagging (propose-segment-tags.mjs) draws from a fixed, pre-authored
 * codebook and is enum-locked. Topics are different: an OPEN, growing
 * vocabulary. topics.json starts empty; each interview processed here either
 * reuses existing topics or proposes new ones — so transcripts that do not
 * follow a question script still get conversational structure.
 *
 * One Claude API call per interview. The model sees the current topic
 * vocabulary and is told to strongly prefer reuse over creation. New topics
 * (only those actually used) are appended to topics.json; per-segment
 * assignments are written to topic_tags.proposed.json.
 *
 * Because the vocabulary is open it cannot be enum-constrained the way themes
 * are — run normalize-topics.mjs periodically to merge near-duplicates.
 *
 * Run:
 *   node scripts/propose-topics.mjs                  # all interviews without topics
 *   node scripts/propose-topics.mjs participant_06   # one interview
 *   node scripts/propose-topics.mjs participant_09 --force  # re-tag
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
const TOPICS_FILE = 'src/lib/content/wctglpdemo-data/topics.json';
const ASSIGNMENTS_FILE = 'src/lib/content/wctglpdemo-data/topic_tags.proposed.json';

// Swap to 'claude-sonnet-4-6' for a cheaper run.
const MODEL = 'claude-opus-4-7';

// Load ANTHROPIC_API_KEY from JourneyMapper/.env if present (.env is gitignored).
if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));

if (!process.env.ANTHROPIC_API_KEY) {
	console.error('x ANTHROPIC_API_KEY is not set.');
	console.error('  Add it to JourneyMapper/.env  (ANTHROPIC_API_KEY=sk-ant-...)  or export it.');
	process.exit(1);
}

/** Lowercase snake_case slug, alphanumerics only. */
function slugify(s) {
	return String(s)
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 60);
}

// --- Load inputs ---
const segmentsData = JSON.parse(readFileSync(resolve(ROOT, SEGMENTS_FILE), 'utf8'));

const segmentsByInterview = new Map();
for (const s of segmentsData.segments) {
	if (!segmentsByInterview.has(s.interview_id)) segmentsByInterview.set(s.interview_id, []);
	segmentsByInterview.get(s.interview_id).push(s);
}
const allInterviews = [...segmentsByInterview.keys()].sort();

let topicsData = { meta: {}, topics: [] };
if (existsSync(resolve(ROOT, TOPICS_FILE))) {
	topicsData = JSON.parse(readFileSync(resolve(ROOT, TOPICS_FILE), 'utf8'));
}
const topicsById = new Map(topicsData.topics.map((t) => [t.id, t]));

let assignmentsData = { meta: {}, assignments: {} };
if (existsSync(resolve(ROOT, ASSIGNMENTS_FILE))) {
	assignmentsData = JSON.parse(readFileSync(resolve(ROOT, ASSIGNMENTS_FILE), 'utf8'));
}
const assignments = { ...assignmentsData.assignments };

const isProcessed = (iv) =>
	segmentsByInterview.get(iv).every((s) => s.segment_id in assignments);

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
	: allInterviews.filter((iv) => force || !isProcessed(iv));

if (targets.length === 0) {
	console.log('Nothing to do — every interview already has topic assignments.');
	console.log('Pass an interview id, or add --force, to re-tag.');
	process.exit(0);
}

// --- Schema + cached system prompt ---
const responseSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		new_topics: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					slug: { type: 'string' },
					label: { type: 'string' },
					description: { type: 'string' }
				},
				required: ['slug', 'label', 'description']
			}
		},
		assignments: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					segment_id: { type: 'string' },
					topics: { type: 'array', items: { type: 'string' } }
				},
				required: ['segment_id', 'topics']
			}
		}
	},
	required: ['new_topics', 'assignments']
};

const SYSTEM_PROMPT = `You identify the conversation topics in interview-transcript segments.

A TOPIC is what a stretch of conversation is concretely about — for example "continue glucose monitoring", "financial compensation for participation", "switching GLP-1 medication", "monthly vs weekly injection". Topics are:
- Concrete: a specific subject being discussed, not an abstract analytic interpretation.
- Reusable: phrased so the same topic recurs across many segments and across different transcripts.
- Multi-label: a single segment may belong to several topics; a topic spans many segments.

Topics are NOT analytic themes — they describe WHAT is being discussed, not what it means.

You are given the CURRENT TOPIC VOCABULARY. Rules:
- Strongly prefer assigning an EXISTING topic id. Reuse is the default.
- Create a new topic ONLY when nothing in the vocabulary fits. Keep new topics at the same level of generality as existing ones — avoid one-off, hyper-specific topics that will never recur.
- Assign zero or more topic ids to every segment. Admin exchanges, bare affirmations ("Yeah", "mm-hmm"), and content-free fragments get an empty list.
- Read surrounding segments (same interview, transcript order) for context, but tag each segment on its own content.

For each genuinely new topic, return: a snake_case "slug" (a short id suggestion), a short human "label", and a one-sentence "description". Only return new topics you actually use in an assignment.

In "assignments", the "topics" strings must each be either an existing topic id or the slug of a topic you returned in "new_topics".`;

// --- Propose topics for one interview (one API call) ---
const client = new Anthropic();

async function proposeForInterview(interviewId) {
	const segs = segmentsByInterview.get(interviewId);
	const payload = segs.map((s) => ({
		segment_id: s.segment_id,
		turn_index: s.turn_index,
		segment_index: s.segment_index,
		flags: s.flags,
		text: s.text
	}));
	const vocab = topicsData.topics.map((t) => ({
		id: t.id,
		label: t.label,
		description: t.description
	}));

	const stream = client.messages.stream({
		model: MODEL,
		max_tokens: 32000,
		thinking: { type: 'adaptive' },
		output_config: { effort: 'high', format: { type: 'json_schema', schema: responseSchema } },
		system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
		messages: [
			{
				role: 'user',
				content:
					`CURRENT TOPIC VOCABULARY (${vocab.length} topics — reuse these ids wherever they fit):\n` +
					`${JSON.stringify(vocab, null, 2)}\n\n` +
					`INTERVIEW "${interviewId}" — assign topics to every segment, in transcript order:\n\n` +
					`${JSON.stringify(payload, null, 2)}`
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
		throw new Error(`${interviewId}: response hit max_tokens — output truncated.`);
	}
	if (msg.stop_reason === 'refusal') throw new Error(`${interviewId}: model refused.`);

	const textBlock = msg.content.find((b) => b.type === 'text');
	if (!textBlock) throw new Error(`${interviewId}: no text block in response.`);
	let parsed;
	try {
		parsed = JSON.parse(textBlock.text);
	} catch (e) {
		throw new Error(`${interviewId}: response was not valid JSON — ${e.message}`);
	}
	return parsed;
}

// --- Main ---
console.log(`Model: ${MODEL}`);
console.log(`Proposing topics for: ${targets.join(', ')}`);
console.log(`Starting vocabulary: ${topicsData.topics.length} topics\n`);

let newTopicCount = 0;

for (const iv of targets) {
	const segs = segmentsByInterview.get(iv);
	console.log(`${iv} (${segs.length} segments)...`);
	const resp = await proposeForInterview(iv);

	// Register new topics actually used, with collision-safe slugs.
	const newBySlug = new Map();
	for (const nt of resp.new_topics ?? []) {
		const baseId = slugify(nt.slug || nt.label);
		if (!baseId) continue;
		newBySlug.set(slugify(nt.slug || nt.label), { ...nt, slug: nt.slug, label: nt.label, description: nt.description });
	}

	// Resolve every assignment topic string to a real id.
	const got = new Map((resp.assignments ?? []).map((a) => [a.segment_id, a.topics]));
	const expected = segs.map((s) => s.segment_id);
	const missing = expected.filter((id) => !got.has(id));
	const extra = [...got.keys()].filter((id) => !expected.includes(id));
	if (missing.length || extra.length) {
		console.error(`x ${iv}: coverage mismatch — files not written.`);
		if (missing.length) console.error(`  missing ${missing.length}: ${missing.slice(0, 6).join(', ')}`);
		if (extra.length) console.error(`  extra ${extra.length}: ${extra.slice(0, 6).join(', ')}`);
		process.exit(1);
	}

	const usedNew = new Set();
	const resolved = {};
	const unknown = new Set();
	for (const segId of expected) {
		const ids = [];
		for (const raw of got.get(segId)) {
			if (topicsById.has(raw)) {
				ids.push(raw);
			} else {
				const s = slugify(raw);
				if (topicsById.has(s)) {
					ids.push(s);
				} else if (newBySlug.has(s)) {
					ids.push(s);
					usedNew.add(s);
				} else {
					unknown.add(raw);
				}
			}
		}
		resolved[segId] = [...new Set(ids)];
	}
	if (unknown.size) {
		console.error(`x ${iv}: assignment references topics not in the vocabulary or new_topics:`);
		console.error(`  ${[...unknown].join(', ')}`);
		process.exit(1);
	}

	// Commit new topics (only those actually assigned to a segment).
	for (const id of usedNew) {
		if (topicsById.has(id)) continue;
		const nt = newBySlug.get(id);
		const topic = {
			id,
			label: nt.label,
			description: nt.description,
			first_seen: iv,
			added_at: new Date().toISOString()
		};
		topicsData.topics.push(topic);
		topicsById.set(id, topic);
		newTopicCount++;
	}

	Object.assign(assignments, resolved);
	const assignedTopics = new Set(Object.values(resolved).flat());
	console.log(`  ${iv}: ${expected.length} segments, ${assignedTopics.size} distinct topics, +${usedNew.size} new\n`);
}

// --- Write outputs ---
topicsData.topics.sort((a, b) => a.id.localeCompare(b.id));
const topicsOut = {
	meta: {
		...topicsData.meta,
		schema_version: '1.0',
		study_id: segmentsData.meta.study_id,
		generated_at: new Date().toISOString(),
		generator: 'scripts/propose-topics.mjs',
		topic_count: topicsData.topics.length
	},
	topics: topicsData.topics
};
writeFileSync(resolve(ROOT, TOPICS_FILE), JSON.stringify(topicsOut, null, 2) + '\n', 'utf8');

const processedInterviews = allInterviews.filter((iv) =>
	segmentsByInterview.get(iv).every((s) => s.segment_id in assignments)
);
const assignmentsOut = {
	meta: {
		schema_version: '1.0',
		study_id: segmentsData.meta.study_id,
		generated_at: new Date().toISOString(),
		generator: 'scripts/propose-topics.mjs',
		model: MODEL,
		processed_interviews: processedInterviews,
		notes: [
			'AI-proposed conversation-topic ids, keyed by segment_id; a segment may carry 0+ topics.',
			'Topic ids resolve against topics.json (an open, growing vocabulary).',
			'build-segment-tags.mjs folds these into segment_tags.json as a `topics` array.',
			'Run normalize-topics.mjs to merge near-duplicate topics across transcripts.'
		]
	},
	assignments: Object.fromEntries(Object.keys(assignments).sort().map((k) => [k, assignments[k]]))
};
writeFileSync(resolve(ROOT, ASSIGNMENTS_FILE), JSON.stringify(assignmentsOut, null, 2) + '\n', 'utf8');

console.log(`Wrote ${TOPICS_FILE} (${topicsData.topics.length} topics, +${newTopicCount} new)`);
console.log(`Wrote ${ASSIGNMENTS_FILE} (${Object.keys(assignments).length} segments)`);
console.log(`  processed interviews: ${processedInterviews.join(', ')}`);
console.log(`Next: node scripts/normalize-topics.mjs   (then node scripts/build-segment-tags.mjs)`);
