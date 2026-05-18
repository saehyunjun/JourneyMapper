/**
 * normalize-topics.mjs
 *
 * Maintenance step for the emergent topic vocabulary.
 *
 * propose-topics.mjs grows topics.json one interview at a time, so the vocabulary
 * drifts: the same conversational subject can land under several near-duplicate
 * ids ("financial_incentive" / "monetary_compensation" / "cash_incentive"). This
 * script asks Claude to find true synonym groups, then merges them — rewriting
 * topics.json and remapping every id in topic_tags.proposed.json.
 *
 * It only merges genuine restatements of the same topic, never merely related
 * topics. Use --dry-run to review the proposed merges without writing anything.
 *
 * Run:
 *   node scripts/normalize-topics.mjs --dry-run   # preview merges
 *   node scripts/normalize-topics.mjs             # apply merges
 *
 * Requires ANTHROPIC_API_KEY in the environment.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const TOPICS_FILE = 'src/lib/content/wctglpdemo-data/topics.json';
const ASSIGNMENTS_FILE = 'src/lib/content/wctglpdemo-data/topic_tags.proposed.json';

const MODEL = 'claude-opus-4-7';
const dryRun = process.argv.includes('--dry-run');

// Load ANTHROPIC_API_KEY from JourneyMapper/.env if present (.env is gitignored).
if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));

if (!process.env.ANTHROPIC_API_KEY) {
	console.error('x ANTHROPIC_API_KEY is not set.');
	console.error('  Add it to JourneyMapper/.env  (ANTHROPIC_API_KEY=sk-ant-...)  or export it.');
	process.exit(1);
}
if (!existsSync(resolve(ROOT, TOPICS_FILE))) {
	console.error(`x ${TOPICS_FILE} not found. Run propose-topics.mjs first.`);
	process.exit(1);
}

const topicsData = JSON.parse(readFileSync(resolve(ROOT, TOPICS_FILE), 'utf8'));
if (topicsData.topics.length < 2) {
	console.log(`Only ${topicsData.topics.length} topic(s) — nothing to normalize.`);
	process.exit(0);
}

const mergeSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		merges: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					canonical_id: { type: 'string' },
					duplicate_ids: { type: 'array', items: { type: 'string' } },
					rationale: { type: 'string' }
				},
				required: ['canonical_id', 'duplicate_ids', 'rationale']
			}
		}
	},
	required: ['merges']
};

const SYSTEM_PROMPT = `You consolidate an emergent topic vocabulary built up across many interview transcripts.

You are given a list of topics (id, label, description). Find groups of topics that are DUPLICATES or near-duplicates — different ids that refer to the same conversational subject and should be a single topic.

Rules:
- Merge ONLY true synonyms / restatements of the same subject. Do NOT merge topics that are merely related, adjacent, or in a parent/child relationship — keep distinct subjects distinct.
- For each group, choose the clearest, most general existing id as "canonical_id"; list the others in "duplicate_ids".
- Each topic id may appear in at most one group, and a canonical id must not also be a duplicate id.
- If nothing should be merged, return an empty "merges" array.`;

const client = new Anthropic();

const stream = client.messages.stream({
	model: MODEL,
	max_tokens: 16000,
	thinking: { type: 'adaptive' },
	output_config: { effort: 'high', format: { type: 'json_schema', schema: mergeSchema } },
	system: SYSTEM_PROMPT,
	messages: [
		{
			role: 'user',
			content:
				`Consolidate this topic vocabulary (${topicsData.topics.length} topics):\n\n` +
				JSON.stringify(
					topicsData.topics.map((t) => ({ id: t.id, label: t.label, description: t.description })),
					null,
					2
				)
		}
	]
});

const msg = await stream.finalMessage();
if (msg.stop_reason === 'max_tokens') {
	console.error('x Response hit max_tokens — output truncated.');
	process.exit(1);
}
const textBlock = msg.content.find((b) => b.type === 'text');
const { merges } = JSON.parse(textBlock.text);

// --- Validate the proposed merges ---
const topicIds = new Set(topicsData.topics.map((t) => t.id));
const errors = [];
const seen = new Set();
for (const m of merges) {
	if (!topicIds.has(m.canonical_id)) errors.push(`unknown canonical_id "${m.canonical_id}".`);
	if (seen.has(m.canonical_id)) errors.push(`"${m.canonical_id}" appears in more than one merge group.`);
	seen.add(m.canonical_id);
	for (const d of m.duplicate_ids) {
		if (!topicIds.has(d)) errors.push(`unknown duplicate_id "${d}".`);
		if (d === m.canonical_id) errors.push(`"${d}" is both canonical and duplicate.`);
		if (seen.has(d)) errors.push(`"${d}" appears in more than one merge group.`);
		seen.add(d);
	}
}
if (errors.length) {
	console.error(`x Invalid merge proposal — nothing written:`);
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
}

if (merges.length === 0) {
	console.log('No near-duplicate topics found — vocabulary is already clean.');
	process.exit(0);
}

console.log(`Proposed ${merges.length} merge group(s):`);
for (const m of merges) {
	console.log(`  ${m.duplicate_ids.join(', ')}  ->  ${m.canonical_id}`);
	console.log(`    ${m.rationale}`);
}

if (dryRun) {
	console.log('\n--dry-run: no files written. Re-run without --dry-run to apply.');
	process.exit(0);
}

// --- Apply: build remap, drop duplicate topics, remap assignments ---
const remap = new Map();
for (const m of merges) for (const d of m.duplicate_ids) remap.set(d, m.canonical_id);

topicsData.topics = topicsData.topics.filter((t) => !remap.has(t.id));
topicsData.topics.sort((a, b) => a.id.localeCompare(b.id));
topicsData.meta = {
	...topicsData.meta,
	generated_at: new Date().toISOString(),
	topic_count: topicsData.topics.length,
	last_normalized_at: new Date().toISOString()
};
writeFileSync(resolve(ROOT, TOPICS_FILE), JSON.stringify(topicsData, null, 2) + '\n', 'utf8');

let remappedSegments = 0;
if (existsSync(resolve(ROOT, ASSIGNMENTS_FILE))) {
	const assignmentsData = JSON.parse(readFileSync(resolve(ROOT, ASSIGNMENTS_FILE), 'utf8'));
	for (const [segId, ids] of Object.entries(assignmentsData.assignments)) {
		const next = [...new Set(ids.map((id) => remap.get(id) ?? id))];
		if (JSON.stringify(next) !== JSON.stringify(ids)) remappedSegments++;
		assignmentsData.assignments[segId] = next;
	}
	assignmentsData.meta.generated_at = new Date().toISOString();
	assignmentsData.meta.last_normalized_at = new Date().toISOString();
	writeFileSync(resolve(ROOT, ASSIGNMENTS_FILE), JSON.stringify(assignmentsData, null, 2) + '\n', 'utf8');
}

console.log(`\nApplied. ${remap.size} topic(s) merged away; ${topicsData.topics.length} remain.`);
console.log(`Remapped ${remappedSegments} segment assignment(s).`);
console.log(`Next: node scripts/build-segment-tags.mjs`);
