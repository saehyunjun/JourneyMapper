/**
 * propose-fragment-themes.mjs
 *
 * AI-proposed theme + subtheme tags for fragments in any corpus. Uses the
 * study-agnostic codebook (3 universal themes × 21 subthemes) — the same one
 * the GLP-1 interview pipeline writes to via propose-segment-tags.mjs.
 *
 * Lives in the same `segment_tags` annotation dimension as sentiment +
 * emotions; this script ONLY touches the `themes` / `subthemes` fields,
 * preserving sentiment_score, emotions, etc. The per-annotation field
 * `themes_generator` distinguishes "tagged with no themes applicable" from
 * "themes never proposed."
 *
 * Subtheme FK validation: every subtheme must belong to one of the chosen
 * themes (codebook enforces this structurally). Post-hoc check rejects
 * orphans.
 *
 * Run:
 *   node scripts/propose-fragment-themes.mjs <corpus_id>
 *   node scripts/propose-fragment-themes.mjs <corpus_id> --source social_comment
 *   node scripts/propose-fragment-themes.mjs <corpus_id> --batch <key>
 *   node scripts/propose-fragment-themes.mjs <corpus_id> --force
 *
 * Requires ANTHROPIC_API_KEY.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const MODEL = 'claude-opus-4-7';
const SCRIPT_VERSION = 'propose-fragment-themes@0.1';

if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));
if (!process.env.ANTHROPIC_API_KEY) {
	console.error('x ANTHROPIC_API_KEY is not set.');
	console.error('  Add to .env or export; if a stale shell key shadows .env, prefix with `env -u ANTHROPIC_API_KEY`.');
	process.exit(1);
}

// === CLI ====================================================================

const args = process.argv.slice(2);
const corpusId = args.find((a) => !a.startsWith('--'));
if (!corpusId) {
	console.error('x Usage: node scripts/propose-fragment-themes.mjs <corpus_id> [--source <name>] [--batch <id>] [--force]');
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

const CODEBOOK_FILE = 'src/lib/content/wctglpdemo-data/codebook.json';
const codebook = JSON.parse(readFileSync(resolve(ROOT, CODEBOOK_FILE), 'utf8'));
const themeIds = codebook.themes.map((t) => t.id);
const subthemeIds = codebook.themes.flatMap((t) => (t.subthemes ?? []).map((s) => s.id));
const subthemeToParentTheme = new Map();
for (const t of codebook.themes) {
	for (const s of t.subthemes ?? []) subthemeToParentTheme.set(s.id, t.id);
}

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
					themes: { type: 'array', items: { type: 'string', enum: themeIds } },
					subthemes: { type: 'array', items: { type: 'string', enum: subthemeIds } },
					confidence: { type: 'number' },
					note: { type: 'string' }
				},
				required: ['fragment_id', 'themes', 'subthemes', 'confidence', 'note']
			}
		}
	},
	required: ['annotations']
};

// === System prompt ==========================================================

const codebookForPrompt = codebook.themes.map((t) => ({
	id: t.id,
	label: t.label,
	description: t.description,
	subthemes: (t.subthemes ?? []).map((s) => ({
		id: s.id,
		label: s.label,
		description: s.description
	}))
}));

const SYSTEM_PROMPT = `You are a qualitative-research analyst tagging fragments of patient/caregiver voice with the codebook themes / subthemes they substantively touch.

The codebook below is STUDY-AGNOSTIC — three universal themes (Treatment, Clinical Trials, Condition-Specific), each with subthemes following a shared spine. Tag the same way regardless of which condition the corpus is about.

For every fragment you return:
- themes: an array of theme ids the fragment is genuinely ABOUT. 0 or more. Empty for admin / off-topic / bare-affirmation fragments.
- subthemes: an array of subtheme ids. 0 or more. A subtheme may ONLY appear if its parent theme is also in the themes array (validated after — DO NOT emit orphan subthemes).
- confidence: 0.0–1.0.
- note: short reviewer note, or "".

Guidance:
- Tag substantively, not on passing mentions. "I'm so excited for you!" gets themes=[], NOT clinical_trials.
- Many fragments touch one theme via several subthemes (e.g., a comment about cost + travel + caregiver burden could be clinical_trials × [trial_barriers, trial_decision_factors]).
- Cross-theme is common — e.g., refractory-treatment fragments often touch BOTH treatment (negative_experiences) AND clinical_trials (trial_motivators).
- Use ONLY ids from the codebook. Do not invent.
- For forum / social corpora: bare well-wishes, congrats, and questions without substantive content get themes=[], subthemes=[], confidence ~0.5, note explaining why.
- Read surrounding fragments (same batch, posted order) for context, but tag each on its own content.

CODEBOOK:
${JSON.stringify(codebookForPrompt, null, 2)}`;

// === Per-partition processing ===============================================

const client = new Anthropic();

for (const { content_source, fragments: partitionFragments } of partitions) {
	const ANNOTATIONS_FILE = `${CORPUS_DIR}/annotations/${content_source}.json`;
	console.log(`\n=== ${corpusId} / ${content_source} (${partitionFragments.length} fragments) ===`);

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

	// "Already annotated" = the themes proposer has run for the fragment.
	// Empty `themes: []` from a prior sentiment-only pass DOES NOT count.
	const isFullyAnnotated = (key) =>
		batches.get(key).every((f) => annotations[f.id]?.segment_tags?.themes_generator != null);

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
		console.log('  Nothing to propose — every batch already themes-annotated.');
		continue;
	}
	console.log(`  Proposing themes for ${targets.length} batch(es): ${targets.join(', ')}`);

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
						`Tag every fragment of batch "${key}" with themes + subthemes. ` +
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
			console.error(`x ${key}: coverage mismatch — annotations not written.`);
			if (missing.length) console.error(`    missing ${missing.length}: ${missing.slice(0, 6).join(', ')}`);
			if (extra.length) console.error(`    extra ${extra.length}: ${extra.slice(0, 6).join(', ')}`);
			process.exit(1);
		}

		// Validate every subtheme's parent theme is in the same annotation's themes.
		// Two failure modes: (1) unknown subtheme — the LLM hallucinated an id not
		// in the codebook, which IS fatal (no parent to rescue with); (2) known
		// subtheme but the LLM forgot to also include the parent theme — recover
		// by auto-adding the parent and warning, since intent is unambiguous.
		for (const id of expected) {
			const a = got.get(id);
			for (const sub of a.subthemes) {
				const parent = subthemeToParentTheme.get(sub);
				if (!parent) {
					console.error(`x ${id}: subtheme "${sub}" is not in the codebook.`);
					process.exit(1);
				}
				if (!a.themes.includes(parent)) {
					console.warn(`! ${id}: subtheme "${sub}" present but parent "${parent}" was missing from themes — auto-adding.`);
					a.themes = [...a.themes, parent];
				}
			}
		}

		const nowIso = new Date().toISOString();
		for (const id of expected) {
			const a = got.get(id);
			if (!annotations[id]) annotations[id] = {};
			const prior = annotations[id].segment_tags ?? {};
			annotations[id].segment_tags = {
				themes: a.themes,
				subthemes: a.subthemes,
				emotions: prior.emotions ?? [],
				topics: prior.topics ?? [],
				sentiment_score: prior.sentiment_score ?? null,
				confidence: prior.confidence ?? null,
				note: prior.note ?? '',
				source: prior.source ?? 'ai_proposed',
				review_status: prior.review_status ?? 'pending',
				themes_generator: SCRIPT_VERSION,
				themes_generated_at: nowIso,
				themes_confidence: a.confidence,
				themes_note: a.note ?? ''
			};
		}
		console.log(`    ${key}: ${expected.length} fragments tagged.`);
	}

	const annotatedBatches = allBatches.filter((k) =>
		batches.get(k).every((f) => annotations[f.id]?.segment_tags?.themes_generator != null)
	);

	const priorMeta = existing.meta && typeof existing.meta === 'object' ? existing.meta : {};
	const priorDimensions =
		priorMeta.dimensions && typeof priorMeta.dimensions === 'object' ? priorMeta.dimensions : {};
	const priorSegmentTagsDim =
		(priorDimensions.segment_tags && typeof priorDimensions.segment_tags === 'object'
			? priorDimensions.segment_tags
			: {}) ?? {};
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
					...priorSegmentTagsDim,
					themes_generator: 'scripts/propose-fragment-themes.mjs',
					themes_model: MODEL,
					themes_codebook_schema_version: codebook.meta?.schema_version ?? null,
					themes_last_generated_at: nowIso,
					themes_annotated_batches: annotatedBatches,
					fields_populated: [
						...(priorSegmentTagsDim.fields_populated ?? []).filter(
							(f) => f !== 'themes' && f !== 'subthemes'
						),
						'themes',
						'subthemes'
					]
				}
			},
			notes: priorMeta.notes ?? []
		},
		annotations: Object.fromEntries(
			Object.keys(annotations).sort().map((k) => [k, annotations[k]])
		)
	};

	const outPath = resolve(ROOT, ANNOTATIONS_FILE);
	mkdirSync(dirname(outPath), { recursive: true });
	writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');

	console.log(`  Wrote ${ANNOTATIONS_FILE}`);
	console.log(`    ${Object.keys(annotations).length} annotations; themes-annotated batches: ${annotatedBatches.join(', ')}`);
}
