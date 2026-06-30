/**
 * propose-fragment-sentiment.mjs
 *
 * AI-proposed sentiment + emotion tags for fragments in any corpus. The
 * fragment-native counterpart to the interview-side propose-segment-tags.mjs.
 *
 * Output lives at corpora/<corpus>/annotations/<content_source>.json under
 * the `segment_tags` dimension key (kept as `segment_tags` for backward
 * compatibility with the migrated GLP-1 annotations — the dimension is now
 * actually source-agnostic but renaming would churn the consumers).
 *
 * Fields written per fragment:
 *   sentiment_score: integer in [-2, 2]
 *   emotions:       array of emotion ids from the codebook
 *   themes:         []   (left empty; codebook themes are indication-specific
 *                         and are not the focus of this script)
 *   subthemes:      []
 *   topics:         []
 *   confidence, note, source, review_status
 *
 * Design notes:
 *  - Same batching as propose-fragment-stages.mjs: interview content groups
 *    by interview_id, forum/social content groups by post_id.
 *  - System prompt is cached. Emotion ids + sentiment values are enum-
 *    constrained via JSON schema.
 *  - Re-runs only touch the segment_tags dimension; other dimensions
 *    (stages, future) on the same fragment annotation are preserved.
 *
 * Run:
 *   node scripts/propose-fragment-sentiment.mjs <corpus_id>
 *   node scripts/propose-fragment-sentiment.mjs <corpus_id> --source social_comment
 *   node scripts/propose-fragment-sentiment.mjs <corpus_id> --batch <key>
 *   node scripts/propose-fragment-sentiment.mjs <corpus_id> --force
 *
 * Requires ANTHROPIC_API_KEY.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Model is overridable for cost/quality A-B: `TAG_MODEL=claude-sonnet-4-6 node …`
// or `--model claude-sonnet-4-6`. Defaults to Opus.
const MODEL =
	process.env.TAG_MODEL ||
	(process.argv.includes('--model') ? process.argv[process.argv.indexOf('--model') + 1] : null) ||
	'claude-opus-4-7';
const INGESTER_VERSION = 'propose-fragment-sentiment@0.1';

if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));
if (!process.env.ANTHROPIC_API_KEY) {
	console.error('x ANTHROPIC_API_KEY is not set.');
	console.error('  Add to .env or export; if a stale shell key shadows .env, prefix with `env -u ANTHROPIC_API_KEY`.');
	process.exit(1);
}

// === CLI ====================================================================

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--source', '--batch', '--model']);
const corpusId = (() => {
	for (let i = 0; i < args.length; i++) {
		if (args[i].startsWith('--')) {
			if (VALUE_FLAGS.has(args[i])) i++; // skip its value
			continue;
		}
		return args[i];
	}
	return null;
})();
if (!corpusId) {
	console.error('x Usage: node scripts/propose-fragment-sentiment.mjs <corpus_id> [--source <name>] [--batch <id>] [--model <id>] [--force]');
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

// === Load corpus + codebook =================================================

const CORPUS_DIR = `src/lib/content/corpora/${corpusId}`;
const MANIFEST_FILE = `${CORPUS_DIR}/manifest.json`;
if (!existsSync(resolve(ROOT, MANIFEST_FILE))) {
	console.error(`x Corpus manifest not found: ${MANIFEST_FILE}`);
	process.exit(1);
}
const manifest = JSON.parse(readFileSync(resolve(ROOT, MANIFEST_FILE), 'utf8'));

// Codebook lives in the GLP-1 demo folder but its `emotion_tags` and
// `sentiment_scale` are indication-agnostic and serve as the universal
// reference for sentiment/emotion enums.
const CODEBOOK_FILE = 'src/lib/content/wctglpdemo-data/codebook.json';
const codebook = JSON.parse(readFileSync(resolve(ROOT, CODEBOOK_FILE), 'utf8'));
const emotionIds = codebook.emotion_tags.map((e) => e.id);

// === Load fragments per content_source ======================================

const FRAGMENTS_DIR = `${CORPUS_DIR}/fragments`;
if (!existsSync(resolve(ROOT, FRAGMENTS_DIR))) {
	console.error(`x No fragments directory: ${FRAGMENTS_DIR}`);
	process.exit(1);
}

const partitions = [];
for (const f of readdirSync(resolve(ROOT, FRAGMENTS_DIR)).filter((f) => f.endsWith('.json'))) {
	const doc = JSON.parse(readFileSync(resolve(ROOT, FRAGMENTS_DIR, f), 'utf8'));
	const contentSource = doc.meta?.content_source ?? f.replace(/\.json$/, '');
	if (sourceFilter && contentSource !== sourceFilter) continue;
	partitions.push({ content_source: contentSource, fragments: doc.fragments ?? [] });
}

if (partitions.length === 0) {
	console.error(`x No partitions to tag${sourceFilter ? ` (filtered to --source ${sourceFilter})` : ''}.`);
	process.exit(1);
}

// === Helpers ================================================================

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

// === Output schema ==========================================================

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
					sentiment_score: { type: 'integer', enum: [-2, -1, 0, 1, 2] },
					emotions: { type: 'array', items: { type: 'string', enum: emotionIds } },
					confidence: { type: 'number' },
					note: { type: 'string' }
				},
				required: ['fragment_id', 'sentiment_score', 'emotions', 'confidence', 'note']
			}
		}
	},
	required: ['annotations']
};

// === System prompt ==========================================================

const SYSTEM_PROMPT = `You are a qualitative-research analyst tagging fragments of patient/caregiver voice for sentiment and emotion.

For every fragment you return:
- sentiment_score: an integer on this scale:
${JSON.stringify(codebook.meta.sentiment_scale, null, 2)}
- emotions: array with 0 OR 1 entry — pick the SINGLE best primary emotion (e.g. "joy", "fear", "sadness") OR a single Plutchik dyad (e.g. "hope" = anticipation+trust, "despair" = fear+sadness, "love" = joy+trust). Never more than one. If two feel close, pick the dyad that captures both, or the dominant one. A bare "good luck!" or "congrats" is best left empty, or one low-confidence entry.
- confidence: overall confidence in the annotation, 0.0–1.0.
- note: short reviewer note or "" if none. Use it for ambiguity or low-confidence calls.

Guidance:
- Bare affirmations, well-wishes, congrats, and content-free fragments: sentiment 0 or +1, emotions [] or one low-confidence emotion, confidence ~0.5, note explaining "bare well-wishes" or similar.
- Reflect the SPEAKER's emotional state in this fragment — not what the topic generally evokes. ("CAR-T is intense" said matter-of-factly is sentiment 0; "I'm terrified of CAR-T" is sentiment -1 or -2 with fear/apprehension.)
- For caregivers describing a loved one's experience, capture the caregiver's emotion (often grief, fear, hope), not the loved one's.
- Use ONLY emotion ids from the list below. Do not invent ids.
- Read the surrounding fragments (same batch, in posted order) for context, but tag each fragment on its own content.

EMOTION VOCABULARY (the only valid ids):
${JSON.stringify(emotionIds, null, 2)}`;

// === Per-partition processing ===============================================

const client = new Anthropic();

for (const { content_source, fragments: partitionFragments } of partitions) {
	const ANNOTATIONS_FILE = `${CORPUS_DIR}/annotations/${content_source}.json`;
	console.log(`\n=== ${corpusId} / ${content_source} (${partitionFragments.length} fragments) ===`);

	// Per-batch checkpoint helper. Same shape as the end-of-partition flush
	// so an interrupted run leaves a consistent file.
	function writePartitionAnnotations(annsObj, allBatchKeys, batchesMap, existingFile) {
		const annotatedBatches = allBatchKeys.filter((k) =>
			batchesMap.get(k).every((f) => annsObj[f.id]?.segment_tags?.sentiment_score != null)
		);
		const priorMeta = existingFile.meta && typeof existingFile.meta === 'object' ? existingFile.meta : {};
		const priorDimensions =
			priorMeta.dimensions && typeof priorMeta.dimensions === 'object' ? priorMeta.dimensions : {};
		const nowIso = new Date().toISOString();
		const doc = {
			meta: {
				schema_version: '1.0',
				corpus_id: corpusId,
				content_source,
				updated_at: nowIso,
				dimensions: {
					...priorDimensions,
					segment_tags: {
						generator: 'scripts/propose-fragment-sentiment.mjs',
						model: MODEL,
						codebook_schema_version: codebook.meta?.schema_version ?? null,
						last_generated_at: nowIso,
						annotated_batches: annotatedBatches,
						fields_populated: ['sentiment_score', 'emotions', 'confidence', 'note'],
						fields_unpopulated: ['themes', 'subthemes', 'topics']
					}
				},
				notes: (priorMeta.notes ?? []).filter(
					(n) => !n.startsWith('segment_tags dimension:')
				).concat([
					'segment_tags dimension: AI-proposed sentiment + emotion. themes/subthemes/topics left empty (codebook is indication-specific; not in scope here).',
					'Re-propose with: node scripts/propose-fragment-sentiment.mjs <corpus> [--source <name>] [--batch <id>] [--force]'
				])
			},
			annotations: Object.fromEntries(
				Object.keys(annsObj).sort().map((k) => [k, annsObj[k]])
			)
		};
		const outPath = resolve(ROOT, ANNOTATIONS_FILE);
		mkdirSync(dirname(outPath), { recursive: true });
		writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
	}

	const batches = new Map();
	for (const f of partitionFragments) {
		const key = batchKeyOf(f);
		if (!batches.has(key)) batches.set(key, []);
		batches.get(key).push(f);
	}
	const allBatches = [...batches.keys()].sort();

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
	if (prunedStale > 0) console.log(`  Pruned ${prunedStale} stale annotation(s).`);

	// Gate on the sentiment-specific field — not on segment_tags presence,
	// since propose-fragment-themes.mjs writes the same segment_tags record
	// with themes/subthemes filled and sentiment_score absent. Mirrors the
	// pattern in propose-fragment-themes.mjs (gates on themes_generator) and
	// propose-fragment-stages.mjs (gates on stages dimension).
	const isFullyAnnotated = (key) =>
		batches.get(key).every((f) => annotations[f.id]?.segment_tags?.sentiment_score != null);

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
	console.log(`  Proposing sentiment for ${targets.length} batch(es): ${targets.join(', ')}`);

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
						`Tag every fragment of batch "${key}" for sentiment and emotion. ` +
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
			console.error(`x ${key}: hit max_tokens.`);
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
			console.error(`x ${key}: no "annotations" array in response.`);
			process.exit(1);
		}

		const got = new Map(parsed.annotations.map((a) => [a.fragment_id, a]));
		const expected = batchFragments.map((f) => f.id);
		const missing = expected.filter((id) => !got.has(id));
		const extra = [...got.keys()].filter((id) => !expected.includes(id));
		if (missing.length || extra.length || got.size !== parsed.annotations.length) {
			// Skip rather than exit — paired with the per-batch checkpoint write
			// below, an interrupted run preserves work on earlier batches.
			console.error(`x ${key}: coverage mismatch — SKIPPING this batch.`);
			if (missing.length) console.error(`    missing ${missing.length}: ${missing.slice(0, 6).join(', ')}`);
			if (extra.length) console.error(`    extra ${extra.length}: ${extra.slice(0, 6).join(', ')}`);
			continue;
		}

		for (const id of expected) {
			const a = got.get(id);
			if (!annotations[id]) annotations[id] = {};
			// Preserve any pre-existing segment_tags fields we don't overwrite
			// (e.g. legacy themes/subthemes/topics from the migrate-segment-tags
			// pass on the GLP-1 corpus). For LN, those start fresh as [].
			const prior = annotations[id].segment_tags ?? {};
			annotations[id].segment_tags = {
				themes: prior.themes ?? [],
				subthemes: prior.subthemes ?? [],
				emotions: Array.isArray(a.emotions) ? a.emotions.slice(0, 1) : [],
				topics: prior.topics ?? [],
				sentiment_score: a.sentiment_score,
				confidence: a.confidence,
				note: a.note ?? '',
				source: 'ai_proposed',
				review_status: 'pending'
			};
		}
		console.log(`    ${key}: ${expected.length} fragments tagged.`);

		// Per-batch checkpoint — see writePartitionAnnotations docstring above.
		writePartitionAnnotations(annotations, allBatches, batches, existing);
	}

	const annotatedBatches = allBatches.filter((k) =>
		batches.get(k).every((f) => annotations[f.id]?.segment_tags?.sentiment_score != null)
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
				segment_tags: {
					generator: 'scripts/propose-fragment-sentiment.mjs',
					model: MODEL,
					codebook_schema_version: codebook.meta?.schema_version ?? null,
					last_generated_at: nowIso,
					annotated_batches: annotatedBatches,
					fields_populated: ['sentiment_score', 'emotions', 'confidence', 'note'],
					fields_unpopulated: ['themes', 'subthemes', 'topics']
				}
			},
			notes: (priorMeta.notes ?? []).filter(
				(n) => !n.startsWith('segment_tags dimension:')
			).concat([
				'segment_tags dimension: AI-proposed sentiment + emotion. themes/subthemes/topics left empty (codebook is indication-specific; not in scope here).',
				'Re-propose with: node scripts/propose-fragment-sentiment.mjs <corpus> [--source <name>] [--batch <id>] [--force]'
			])
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
