/**
 * propose-fragment-stages.mjs
 *
 * AI-proposed journey-stage tags for any corpus + content_source. Reads the
 * corpus's manifest to discover what to tag, then asks Claude which journey
 * stage(s) — from the indication's journey taxonomy — each fragment is
 * *about*. Multi-label allowed (0..N stages per fragment) with optional
 * step_id refinement.
 *
 * This is the FRAGMENT STAGE TAG ("what is this fragment about"), not the
 * SPEAKER JOURNEY POSITION ("where is the speaker in their own journey").
 *
 * Design notes:
 *  - One API call per "batch." For interview content_sources, the batch is
 *    one interview (preserves transcript-order context). For forum / social
 *    content_sources, the batch is one (Thread, Conversation) — typically a
 *    post + its replies — so the model has thread context for each reply.
 *  - System prompt is cached. Stage / step ids are enum-constrained to the
 *    indication's journey taxonomy via JSON schema.
 *  - Output lives at corpora/<corpus>/annotations/<content_source>.json under
 *    the `stages` dimension. Other dimensions (segment_tags, etc.) on the same
 *    fragment are preserved across runs.
 *
 * Run:
 *   node scripts/propose-fragment-stages.mjs <corpus_id>
 *   node scripts/propose-fragment-stages.mjs <corpus_id> --source interview
 *   node scripts/propose-fragment-stages.mjs <corpus_id> --batch participant_07
 *   node scripts/propose-fragment-stages.mjs <corpus_id> --force
 *
 * Requires ANTHROPIC_API_KEY in the environment. If a shell-exported key is
 * stale, prefix with `env -u ANTHROPIC_API_KEY` so .env wins.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const MODEL = 'claude-opus-4-7';

if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));
if (!process.env.ANTHROPIC_API_KEY) {
	console.error('x ANTHROPIC_API_KEY is not set.');
	console.error('  Add it to JourneyMapper/.env, or export it. If a stale shell key shadows .env,');
	console.error('  prefix the command with `env -u ANTHROPIC_API_KEY`.');
	process.exit(1);
}

// === CLI ====================================================================

const args = process.argv.slice(2);
const corpusId = args.find((a) => !a.startsWith('--'));
if (!corpusId) {
	console.error('x Usage: node scripts/propose-fragment-stages.mjs <corpus_id> [--source <name>] [--batch <id>] [--force]');
	process.exit(1);
}
const force = args.includes('--force');
const sourceFilter = (() => {
	const idx = args.indexOf('--source');
	return idx >= 0 ? args[idx + 1] : null;
})();
const batchFilter = (() => {
	const idx = args.indexOf('--batch');
	return idx >= 0 ? args[idx + 1] : null;
})();

// === Load corpus + journey ==================================================

const CORPUS_DIR = `src/lib/content/corpora/${corpusId}`;
const MANIFEST_FILE = `${CORPUS_DIR}/manifest.json`;
if (!existsSync(resolve(ROOT, MANIFEST_FILE))) {
	console.error(`x Corpus manifest not found: ${MANIFEST_FILE}`);
	process.exit(1);
}
const manifest = JSON.parse(readFileSync(resolve(ROOT, MANIFEST_FILE), 'utf8'));
const indication = manifest.indications?.[0];
if (!indication) {
	console.error(`x Corpus ${corpusId} has no indications in its manifest.`);
	process.exit(1);
}

const JOURNEY_FILE = `src/lib/content/journeys/${indication}.json`;
if (!existsSync(resolve(ROOT, JOURNEY_FILE))) {
	console.error(`x Journey taxonomy not found: ${JOURNEY_FILE}`);
	process.exit(1);
}
const journey = JSON.parse(readFileSync(resolve(ROOT, JOURNEY_FILE), 'utf8'));

const stageIds = journey.stages.map((s) => s.id);
const stepIds = journey.stages.flatMap((s) => s.steps.map((step) => step.id));
const stepToParentStage = new Map();
for (const s of journey.stages) for (const step of s.steps) stepToParentStage.set(step.id, s.id);

// === Load fragments per content_source ======================================

const FRAGMENTS_DIR = `${CORPUS_DIR}/fragments`;
if (!existsSync(resolve(ROOT, FRAGMENTS_DIR))) {
	console.error(`x No fragments directory: ${FRAGMENTS_DIR}`);
	process.exit(1);
}

const partitionFiles = readdirSync(resolve(ROOT, FRAGMENTS_DIR))
	.filter((f) => f.endsWith('.json'));

const partitions = []; // [{ content_source, fragments[] }]
for (const f of partitionFiles) {
	const doc = JSON.parse(readFileSync(resolve(ROOT, FRAGMENTS_DIR, f), 'utf8'));
	const contentSource = doc.meta?.content_source ?? f.replace(/\.json$/, '');
	if (sourceFilter && contentSource !== sourceFilter) continue;
	partitions.push({ content_source: contentSource, fragments: doc.fragments ?? [] });
}

if (partitions.length === 0) {
	console.error(
		`x No partitions to tag${sourceFilter ? ` (filtered to --source ${sourceFilter})` : ''}.`
	);
	process.exit(1);
}

// === Helpers ================================================================

/** Derive the batching key per fragment. Interview content groups by
 *  interview_id; forum / social content groups by post_id. */
function batchKeyOf(fragment) {
	const r = fragment.source_ref;
	if (r.kind === 'interview') return r.interview_id;
	if (
		r.kind === 'social_post' ||
		r.kind === 'social_comment' ||
		r.kind === 'forum_post' ||
		r.kind === 'blog_post'
	) {
		return r.post_id;
	}
	return fragment.id;
}

// === Build the enum-constrained output schema =================================

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
					fragment_id: { type: 'string' },
					stages: {
						type: 'array',
						items: {
							type: 'object',
							additionalProperties: false,
							properties: {
								stage_id: { type: 'string', enum: stageIds },
								step_id: { type: 'string', enum: [...stepIds, ''] },
								confidence: { type: 'number' }
							},
							required: ['stage_id', 'step_id', 'confidence']
						}
					},
					confidence: { type: 'number' },
					note: { type: 'string' }
				},
				required: ['fragment_id', 'stages', 'confidence', 'note']
			}
		}
	},
	required: ['annotations']
};

const journeyForPrompt = journey.stages.map((s) => ({
	id: s.id,
	order: s.order,
	label: s.label,
	description: s.description,
	steps: s.steps.map((step) => ({
		id: step.id,
		label: step.label,
		description: step.description
	}))
}));

const SYSTEM_PROMPT = `You are a qualitative-research analyst tagging fragments of patient/caregiver voice with the journey stage(s) they discuss.

You are given a per-indication CLINICAL JOURNEY TAXONOMY below. For each fragment, decide which stage(s) the fragment is genuinely ABOUT — not which stage the speaker is currently in (a person in maintenance can reminisce about diagnosis; a community member can ask about a stage they aren't in). Multi-label is allowed and expected; many fragments straddle two adjacent stages.

For every fragment you return:
- stages: an array of { stage_id, step_id, confidence }.
  - 0 stages when the fragment is admin / off-topic / a bare affirmation / well-wishes-only / content-free.
  - 1 stage when the fragment is clearly anchored.
  - 2+ stages when the fragment genuinely spans (e.g. "I went off it because the cost was too much, and then I started gaining again" → discontinuation/cost AND post-discontinuation/regain).
  - step_id is the finer-grained sub-step inside the stage. Use "" (empty string) when the fragment is about the stage broadly but no specific step applies.
  - confidence is your confidence in THAT stage assignment, 0.0–1.0.
- confidence: overall confidence in the whole annotation, 0.0–1.0.
- note: a short reviewer note, or "" if none. Use it to flag ambiguity or explain a low-confidence call (e.g. "off-topic for this indication's taxonomy" or "ambiguous between stages X and Y").

Guidance:
- Use ONLY stage_ids and step_ids in the taxonomy below. Do not invent ids. step_id MUST be a step inside the chosen stage_id (validated after).
- Forum / social fragments include a lot of well-wishes, congrats, and short questions. These get stages=[] with a note explaining why (e.g. "bare well-wishes, no substantive content").
- Read the surrounding fragments (same batch, in posted order) for context, but tag each fragment on its own content.
- A fragment that mentions a stage in passing without being substantively about it should NOT get tagged with that stage.
- Hypothetical or attitudinal framing ("if I tried CAR-T, I'd worry about the chemo conditioning") still tags into the stage being discussed.
- For patient/caregiver community forums, reflect the speaker's framing: a caregiver describing their loved one's CAR-T hospitalization tags into the in-trial-experience stages, even though the caregiver isn't the patient.

CLINICAL JOURNEY TAXONOMY — ${journey.meta.label}:
${JSON.stringify(journeyForPrompt, null, 2)}`;

// === Per-partition processing ===============================================

const client = new Anthropic();
const INGESTER_VERSION = 'propose-fragment-stages@0.2';

for (const { content_source, fragments: partitionFragments } of partitions) {
	const ANNOTATIONS_FILE = `${CORPUS_DIR}/annotations/${content_source}.json`;
	console.log(`\n=== ${corpusId} / ${content_source} (${partitionFragments.length} fragments) ===`);

	// Group by batching key.
	const batches = new Map();
	for (const f of partitionFragments) {
		const key = batchKeyOf(f);
		if (!batches.has(key)) batches.set(key, []);
		batches.get(key).push(f);
	}
	const allBatches = [...batches.keys()].sort();

	// Existing annotations (per content_source).
	let existing = { meta: {}, annotations: {} };
	if (existsSync(resolve(ROOT, ANNOTATIONS_FILE))) {
		existing = JSON.parse(readFileSync(resolve(ROOT, ANNOTATIONS_FILE), 'utf8'));
	}
	const currentFragmentIds = new Set(partitionFragments.map((f) => f.id));
	const annotations = {};
	let prunedStale = 0;
	for (const [id, ann] of Object.entries(existing.annotations ?? {})) {
		if (currentFragmentIds.has(id)) annotations[id] = ann;
		else prunedStale += 1;
	}
	if (prunedStale > 0) {
		console.log(`  Pruned ${prunedStale} stale annotation(s).`);
	}

	const isFullyAnnotated = (key) =>
		batches.get(key).every((f) => annotations[f.id]?.stages != null);

	// Choose target batches.
	let targets;
	if (batchFilter) {
		if (!batches.has(batchFilter)) {
			console.log(`  --batch "${batchFilter}" not in this partition; skipping.`);
			continue;
		}
		targets = [batchFilter];
	} else {
		targets = allBatches.filter((k) => force || !isFullyAnnotated(k));
	}

	if (targets.length === 0) {
		console.log('  Nothing to propose — every batch already annotated.');
		continue;
	}
	console.log(`  Proposing stages for ${targets.length} batch(es): ${targets.join(', ')}`);

	for (const key of targets) {
		const batchFragments = batches.get(key);
		console.log(`  ${key} (${batchFragments.length} fragments)...`);

		const payload = batchFragments.map((f) => ({ fragment_id: f.id, text: f.text }));

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
						`Tag every fragment of batch "${key}". ` +
						`Return exactly one annotation per fragment, using the same fragment_id. ` +
						`Fragments, in posted order:\n\n${JSON.stringify(payload, null, 2)}`
				}
			]
		});

		const msg = await stream.finalMessage();
		const u = msg.usage;
		console.log(
			`    usage: in=${u.input_tokens} cache_write=${u.cache_creation_input_tokens} ` +
				`cache_read=${u.cache_read_input_tokens} out=${u.output_tokens}`
		);

		if (msg.stop_reason === 'max_tokens') {
			console.error(`x ${key}: response hit max_tokens — output truncated.`);
			process.exit(1);
		}
		if (msg.stop_reason === 'refusal') {
			console.error(`x ${key}: model refused.`);
			process.exit(1);
		}

		const textBlock = msg.content.find((b) => b.type === 'text');
		if (!textBlock) {
			console.error(`x ${key}: no text block in response.`);
			process.exit(1);
		}

		let parsed;
		try {
			parsed = JSON.parse(textBlock.text);
		} catch (e) {
			console.error(`x ${key}: response was not valid JSON — ${e.message}`);
			process.exit(1);
		}
		if (!Array.isArray(parsed.annotations)) {
			console.error(`x ${key}: response had no "annotations" array.`);
			process.exit(1);
		}

		const got = new Map(parsed.annotations.map((a) => [a.fragment_id, a]));
		const expected = batchFragments.map((f) => f.id);
		const missing = expected.filter((id) => !got.has(id));
		const extra = [...got.keys()].filter((id) => !expected.includes(id));
		if (missing.length || extra.length || got.size !== parsed.annotations.length) {
			console.error(`x ${key}: coverage mismatch — annotations not written.`);
			if (missing.length) console.error(`    missing ${missing.length}: ${missing.slice(0, 6).join(', ')}`);
			if (extra.length) console.error(`    extra ${extra.length}: ${extra.slice(0, 6).join(', ')}`);
			process.exit(1);
		}

		// Validate step_id ∈ stage_id (schema enum can't express parent-child).
		for (const id of expected) {
			const a = got.get(id);
			for (const s of a.stages) {
				if (s.step_id !== '' && stepToParentStage.get(s.step_id) !== s.stage_id) {
					console.error(
						`x ${id}: step_id "${s.step_id}" does not belong to stage_id "${s.stage_id}"`
					);
					process.exit(1);
				}
			}
		}

		for (const id of expected) {
			const a = got.get(id);
			if (!annotations[id]) annotations[id] = {};
			annotations[id].stages = {
				values: a.stages.map((s) => ({
					stage_id: s.stage_id,
					step_id: s.step_id || null,
					confidence: s.confidence
				})),
				overall_confidence: a.confidence,
				note: a.note ?? '',
				source: 'ai_proposed',
				review_status: 'pending'
			};
		}
		console.log(`    ${key}: ${expected.length} fragments tagged.`);
	}

	// Write annotations file for this content_source.
	const annotatedBatches = allBatches.filter((k) =>
		batches.get(k).every((f) => annotations[f.id]?.stages != null)
	);

	const priorMeta = existing.meta && typeof existing.meta === 'object' ? existing.meta : {};
	const priorDimensions =
		priorMeta.dimensions && typeof priorMeta.dimensions === 'object' ? priorMeta.dimensions : {};
	const nowIso = new Date().toISOString();

	const output = {
		meta: {
			schema_version: '1.0',
			corpus_id: corpusId,
			content_source,
			updated_at: nowIso,
			dimensions: {
				...priorDimensions,
				stages: {
					generator: 'scripts/propose-fragment-stages.mjs',
					model: MODEL,
					indication,
					journey_schema_version: journey.meta.schema_version,
					last_generated_at: nowIso,
					annotated_batches: annotatedBatches
				}
			},
			notes: [
				'Multi-dimensional annotation file. Each fragment may carry multiple dimension keys (stages, segment_tags, ...).',
				'stages dimension: AI-proposed journey-stage tags, multi-label per fragment. Enum-constrained at generation time.',
				'Every stages entry is source: ai_proposed, review_status: pending.',
				'Re-propose with: node scripts/propose-fragment-stages.mjs <corpus> [--source <name>] [--batch <id>] [--force]'
			]
		},
		annotations: Object.fromEntries(
			Object.keys(annotations).sort().map((k) => [k, annotations[k]])
		)
	};

	const outPath = resolve(ROOT, ANNOTATIONS_FILE);
	mkdirSync(dirname(outPath), { recursive: true });
	writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');

	console.log(`  Wrote ${ANNOTATIONS_FILE}`);
	console.log(`    ${Object.keys(annotations).length} annotations; batches: ${annotatedBatches.join(', ')}`);
}
