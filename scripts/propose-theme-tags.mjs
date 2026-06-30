/**
 * propose-theme-tags.mjs
 *
 * Phase 4 of the codebook migration. Reads a corpus and emits per-span
 * ThemeTag rows keyed off the new 27-theme taxonomy (CODEBOOK_TAXONOMY.md).
 * Sibling of the existing propose-fragment-themes.mjs — that one tags
 * whole fragments with theme + subtheme arrays under the legacy 3-theme
 * codebook; this one tags character SPANS within fragments using the new
 * 4-axis (hrqol/util/trial/life) themes.
 *
 * Output: `<corpus>/theme_tags/<source>.json` — separate file from the
 * existing annotations/ tree so the two systems run independently during
 * the migration. Phase 5 will consolidate.
 *
 * Schema (per-fragment): an array of tags, each carrying span (start, end,
 * text), theme_id, confidence, and a short rationale. Multi-tag is the
 * default — same span can carry 2+ theme_ids when the speaker means more
 * than one.
 *
 * Run:
 *   node scripts/propose-theme-tags.mjs <corpus_id>
 *   node scripts/propose-theme-tags.mjs <corpus_id> --source social_post
 *   node scripts/propose-theme-tags.mjs <corpus_id> --sample 40
 *   node scripts/propose-theme-tags.mjs <corpus_id> --force
 *
 * Requires ANTHROPIC_API_KEY. If a shell-exported key shadows .env, prefix
 * with `env -u ANTHROPIC_API_KEY` per the propose-* family convention.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DEFAULT_MODEL = 'claude-haiku-4-5';
const SCRIPT_VERSION = 'propose-theme-tags@0.2';

if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));
if (!process.env.ANTHROPIC_API_KEY) {
	console.error('x ANTHROPIC_API_KEY is not set.');
	console.error('  Add to .env or export; if a stale shell key shadows .env, prefix with `env -u ANTHROPIC_API_KEY`.');
	process.exit(1);
}

// === CLI ====================================================================

const args = process.argv.slice(2);
const flagNames = new Set(['--source', '--sample', '--model']);
const corpusId = (() => {
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a.startsWith('--')) {
			if (flagNames.has(a)) i++;
			continue;
		}
		return a;
	}
	return null;
})();
if (!corpusId) {
	console.error('x Usage: node scripts/propose-theme-tags.mjs <corpus_id> [--source <name>] [--sample N] [--force] [--model <id>]');
	console.error(`  Default model: ${DEFAULT_MODEL}. Override with --model claude-sonnet-4-6 or claude-opus-4-7.`);
	process.exit(1);
}
const MODEL = (() => {
	const idx = args.indexOf('--model');
	return idx >= 0 ? args[idx + 1] : DEFAULT_MODEL;
})();
const force = args.includes('--force');
const sourceFilter = (() => {
	const idx = args.indexOf('--source');
	return idx >= 0 ? args[idx + 1] : null;
})();
const sampleSize = (() => {
	const idx = args.indexOf('--sample');
	if (idx < 0) return null;
	const n = parseInt(args[idx + 1] ?? '', 10);
	if (!Number.isFinite(n) || n <= 0) {
		console.error('x --sample must be a positive integer');
		process.exit(1);
	}
	return n;
})();

// === Load themes registry ===================================================

const THEMES_FILE = 'src/lib/content/themes/themes.json';
if (!existsSync(resolve(ROOT, THEMES_FILE))) {
	console.error(`x Themes registry not found: ${THEMES_FILE}`);
	process.exit(1);
}
const themesDoc = JSON.parse(readFileSync(resolve(ROOT, THEMES_FILE), 'utf8'));
const themeIds = themesDoc.items.map((t) => t.id);
const themeIdSet = new Set(themeIds);
console.log(`Themes registry: ${themeIds.length} themes loaded.`);

// === Load corpus ============================================================

const CORPUS_DIR = `src/lib/content/corpora/${corpusId}`;
const MANIFEST_FILE = `${CORPUS_DIR}/manifest.json`;
if (!existsSync(resolve(ROOT, MANIFEST_FILE))) {
	console.error(`x Corpus manifest not found: ${MANIFEST_FILE}`);
	process.exit(1);
}
const manifest = JSON.parse(readFileSync(resolve(ROOT, MANIFEST_FILE), 'utf8'));
console.log(`Corpus: ${corpusId} (indications: ${(manifest.indications ?? []).join(', ') || '(none in manifest)'})`);

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
	partitions.push({
		content_source: contentSource,
		fragments: (doc.fragments ?? []).filter((f) => f.text && typeof f.text === 'string')
	});
}
if (partitions.length === 0) {
	console.error(`x No partitions to tag${sourceFilter ? ` (filtered to --source ${sourceFilter})` : ''}.`);
	process.exit(1);
}
console.log(`Loaded ${partitions.length} partition(s).`);

// === Output schema ==========================================================

const tagSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		theme_id: { type: 'string' },
		text: {
			type: 'string',
			description: 'verbatim span text as it appears in the fragment, used to compute span offsets client-side'
		},
		confidence: { type: 'number' },
		rationale: { type: 'string' }
	},
	required: ['theme_id', 'text', 'confidence', 'rationale']
};

const fragmentAnnotationSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		fragment_id: { type: 'string' },
		tags: { type: 'array', items: tagSchema }
	},
	required: ['fragment_id', 'tags']
};

const outputSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		annotations: { type: 'array', items: fragmentAnnotationSchema }
	},
	required: ['annotations']
};

// === System prompt ==========================================================

const themesForPrompt = themesDoc.items.map((t) => ({
	id: t.id,
	axis: t.axis,
	label: t.label,
	captures: t.captures,
	excludes: t.excludes
}));

const SYSTEM_PROMPT = `You are a qualitative-research analyst tagging spans of patient/caregiver text with themes from a 4-axis taxonomy (CODEBOOK_TAXONOMY.md).

YOUR JOB: For each fragment, identify the SPANS of text (short, verbatim phrases) that map to one or more themes. Multi-tag is normal — the same span can carry 2+ theme_ids when the speaker means more than one (e.g. "the pain of losing my job" → life.occupation + hrqol.mental_health).

CONTRACT:
- theme_id: must be one of the 27 themes from the registry below. Use the exact id.
- text: the verbatim span as it appears in the fragment. EXACT match (same casing, punctuation, spacing) so we can compute offsets client-side. Keep spans short — 1 to ~15 words, the smallest unit that carries the theme.
- confidence: 0.0–1.0. High (>0.85) when the span is substantively about the theme. Lower for ambiguous or passing references.
- rationale: short — one phrase on why this span maps to this theme.

GUIDANCE:
- Tag substantively. "I'm so glad you're feeling better!" is well-wishing, not hrqol.general_health.
- Same span can have multiple theme tags. Emit one tag per (span, theme_id) pair.
- A fragment with no substantively tagged content → return tags: [] (empty array).
- Prefer multiple precise short spans over one long one. "I had to quit my job and my insurance refused the appeal" = three short tags, not one big one.
- Do NOT invent theme_ids — only use the ones from the registry.
- Entity-like mentions (drug names, biomarkers like eGFR) are tagged at the entity layer, NOT here. Don't propose drug-name spans as theme tags unless the speaker is genuinely discussing a theme (e.g. "the cost of Dapagliflozin" → life.financial on the cost phrase, not the drug name).

THEMES REGISTRY (use these exact ids):
${JSON.stringify(themesForPrompt, null, 2)}`;

// === Run ====================================================================

const client = new Anthropic();
const BATCH_SIZE = 40;

for (const { content_source, fragments } of partitions) {
	const OUT_FILE = `${CORPUS_DIR}/theme_tags/${content_source}.json`;
	console.log(`\n=== ${corpusId} / ${content_source} (${fragments.length} fragments) ===`);
	console.log(`  → ${OUT_FILE}`);

	const scanFragments = sampleSize && sampleSize < fragments.length
		? fragments.slice(0, sampleSize)
		: fragments;
	if (sampleSize) console.log(`  Scanning first ${scanFragments.length} fragments (--sample ${sampleSize}).`);

	// Load existing theme_tags file (resume support)
	let existing = { meta: {}, theme_tags: {} };
	if (existsSync(resolve(ROOT, OUT_FILE))) {
		existing = JSON.parse(readFileSync(resolve(ROOT, OUT_FILE), 'utf8'));
	}

	const todo = scanFragments.filter((f) => force || !(f.id in (existing.theme_tags ?? {})));
	if (todo.length === 0) {
		console.log('  Nothing to tag — every fragment already has theme_tags. Use --force to re-tag.');
		continue;
	}
	console.log(`  ${todo.length} fragments to tag.`);

	const batches = [];
	for (let i = 0; i < todo.length; i += BATCH_SIZE) {
		batches.push(todo.slice(i, i + BATCH_SIZE));
	}

	const themeTags = { ...(existing.theme_tags ?? {}) };
	const usage = { in: 0, cache_write: 0, cache_read: 0, out: 0 };
	const counts = { tagged: 0, empty: 0, span_misses: 0, invalid_theme: 0 };

	for (let bi = 0; bi < batches.length; bi++) {
		const batch = batches[bi];
		console.log(`  Batch ${bi + 1}/${batches.length} (${batch.length} fragments)...`);

		const payload = batch.map((f) => ({
			fragment_id: f.id,
			text: f.text.length > 1500 ? f.text.slice(0, 1500) + '…' : f.text
		}));

		const stream = client.messages.stream({
			model: MODEL,
			// 16K is enough for the structured-tag output across 40 fragments;
			// was 32K when adaptive thinking inflated the output stream.
			max_tokens: 16000,
			// No thinking — span identification + theme classification is
			// shape-constrained by the schema; reasoning tokens are wasted spend.
			// Also no `effort: 'high'` — Haiku 4.5 rejects it on json_schema.
			output_config: { format: { type: 'json_schema', schema: outputSchema } },
			system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
			messages: [
				{
					role: 'user',
					content:
						`Tag every fragment below with theme spans per the contract. ` +
						`Return one annotation per fragment, using the same fragment_id. ` +
						`Fragments:\n\n${JSON.stringify(payload, null, 2)}`
				}
			]
		});

		const msg = await stream.finalMessage();
		const u = msg.usage;
		usage.in += u.input_tokens;
		usage.cache_write += u.cache_creation_input_tokens ?? 0;
		usage.cache_read += u.cache_read_input_tokens ?? 0;
		usage.out += u.output_tokens;
		console.log(
			`    usage: in=${u.input_tokens} cache_write=${u.cache_creation_input_tokens ?? 0} ` +
				`cache_read=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens}`
		);

		if (msg.stop_reason === 'max_tokens' || msg.stop_reason === 'refusal') {
			console.error(`x batch ${bi + 1}: ${msg.stop_reason}`);
			process.exit(1);
		}

		const textBlock = msg.content.find((b) => b.type === 'text');
		if (!textBlock) {
			console.error(`x batch ${bi + 1}: no text block in response.`);
			process.exit(1);
		}

		let parsed;
		try {
			parsed = JSON.parse(textBlock.text);
		} catch (e) {
			console.error(`x batch ${bi + 1}: response was not valid JSON — ${e.message}`);
			process.exit(1);
		}

		if (!Array.isArray(parsed.annotations)) {
			console.error(`x batch ${bi + 1}: no "annotations" array in response.`);
			process.exit(1);
		}

		// For each annotation, resolve text spans to offsets in the original
		// fragment text. Drop tags where the span text isn't found (model
		// paraphrase) or theme_id is unknown.
		const fragsById = new Map(batch.map((f) => [f.id, f]));
		const nowIso = new Date().toISOString();

		for (const ann of parsed.annotations) {
			const frag = fragsById.get(ann.fragment_id);
			if (!frag) {
				console.warn(`    ! Unknown fragment_id in response: ${ann.fragment_id}`);
				continue;
			}
			const text = frag.text;
			const tags = [];
			for (const t of ann.tags) {
				if (!themeIdSet.has(t.theme_id)) {
					counts.invalid_theme += 1;
					continue;
				}
				const start = text.indexOf(t.text);
				if (start < 0) {
					counts.span_misses += 1;
					continue;
				}
				tags.push({
					span: { start, end: start + t.text.length, text: t.text },
					theme_id: t.theme_id,
					tagger: 'llm-proposed',
					confidence: t.confidence,
					rationale: t.rationale,
					created_at: nowIso
				});
			}
			themeTags[ann.fragment_id] = tags;
			if (tags.length > 0) counts.tagged += 1;
			else counts.empty += 1;
		}

		// Per-batch checkpoint write so a crash mid-run doesn't lose progress.
		writeOutput();
	}

	writeOutput();

	console.log(`  Done. tagged=${counts.tagged} empty=${counts.empty} span_misses=${counts.span_misses} invalid_theme=${counts.invalid_theme}`);
	console.log(`  Usage: in=${usage.in} cache_write=${usage.cache_write} cache_read=${usage.cache_read} out=${usage.out}`);

	function writeOutput() {
		const nowIso = new Date().toISOString();
		const doc = {
			meta: {
				schema_version: 'theme-tags-0.1',
				generator: SCRIPT_VERSION,
				model: MODEL,
				corpus_id: corpusId,
				content_source,
				updated_at: nowIso,
				themes_count: themeIds.length,
				tagged_fragment_count: Object.keys(themeTags).length,
				total_tag_count: Object.values(themeTags).reduce((s, t) => s + t.length, 0)
			},
			theme_tags: Object.fromEntries(
				Object.keys(themeTags).sort().map((k) => [k, themeTags[k]])
			)
		};
		const outPath = resolve(ROOT, OUT_FILE);
		mkdirSync(dirname(outPath), { recursive: true });
		writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
	}
}

console.log('\n=== All partitions complete ===');
