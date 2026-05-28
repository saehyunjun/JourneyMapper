/**
 * import-forum-as-fragments.mjs
 *
 * Generalized ingester for forum / social-comment datasets. Reads a per-corpus
 * config + a normalized input JSON array and emits fragments into the corpus's
 * content_source partitions (social_post.json + social_comment.json).
 *
 * Not Reddit-specific: any dataset whose rows expose (Anonymized Username,
 * Timestamp, Text) + a (Thread, Conversation, Comment) hierarchy can be
 * ingested by writing a config; platform-specific naming lives in config.
 *
 * Required per-row fields:
 *   Anonymized Username, Timestamp, Text
 * Recognized optional fields:
 *   Thread, Conversation, Comment   (hierarchy → fragment id, post/comment ids)
 *   Context                         (per-USER role/condition flair; mapped per config)
 *   Username                        (raw; used ONLY for [deleted] detection +
 *                                    conflated-id warnings; NOT stored)
 *
 * Pre-processing rules:
 *   - Per-USER context. Context is treated as a stable per-anonymized-id trait.
 *     The ingester picks the most-frequent non-empty Context per id; rows with
 *     conflicting values are logged. The chosen value is mapped to
 *     speaker_attrs.role via config.context_to_speaker_attrs.
 *   - [deleted] users get fresh IDs. Rows where raw Username === '[deleted]' are
 *     NOT trusted to share an identity with each other or with the pre-assigned
 *     anonymized id; each gets a unique synthetic id ('Anon_<corpus>_NNNN').
 *   - Conflated anonymized ids (one id mapping to >1 raw username) are logged
 *     as warnings but NOT auto-fixed. Re-anonymize upstream if it matters.
 *
 * Long-fragment splitting (ingester >=0.2):
 *   Rows whose text is at least `split_long_fragments.min_chars` long AND
 *   contains at least `split_long_fragments.min_sentences` sentence boundaries
 *   are sentence-split into N child fragments. Each child:
 *     - id = `${rowFragmentId}_sNN`
 *     - source_ref carries char_start / char_end relative to the parent
 *       post's normalized text; siblings share post_id + comment_id
 *     - inherits speaker_attrs, weight_base, license, dates, deid metadata
 *   The parent post is NOT emitted as its own fragment — analogous to how the
 *   interview pipeline emits sentence-level segments and never the parent turn.
 *   Rows above the char threshold but with too few sentence boundaries are
 *   emitted as a single fragment flagged 'unsplittable_long' for analyst review.
 *   Config (per-corpus override in ingest.config.json):
 *     "split_long_fragments": {
 *       "enabled": true,
 *       "min_chars": 400,
 *       "min_sentences": 4,
 *       "applies_to": ["social_post", "social_comment"]
 *     }
 *
 * Output:
 *   src/lib/content/corpora/<corpus_id>/fragments/social_post.json
 *   src/lib/content/corpora/<corpus_id>/fragments/social_comment.json
 *   src/lib/content/corpora/<corpus_id>/manifest.json
 *
 * Deterministic except for `ingested_at` timestamps. Idempotent — re-run
 * after upstream changes to refresh. Bumping INGESTER_VERSION changes child
 * fragment ids; existing annotations keyed on old ids will be pruned as stale
 * by the next proposer run.
 *
 * Run: node scripts/import-forum-as-fragments.mjs <corpus_id>
 *   reads config from src/lib/content/corpora/<corpus_id>/ingest.config.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeText } from './lib/normalize-text.mjs';
import { splitSentences } from './lib/sentence-split.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const INGESTER_VERSION = 'import-forum-as-fragments@0.3';

// Defaults for split_long_fragments. Overridable per-corpus in ingest.config.
// Long announcement-style posts (e.g. multi-paragraph trial enrollment stories)
// otherwise get one bundled theme/stage annotation spanning intro + history +
// ask; sentence-splitting them lets each idea-unit carry its own tags.
const SPLIT_DEFAULTS = {
	enabled: true,
	min_chars: 400,
	min_sentences: 4,
	applies_to: ['social_post', 'social_comment']
};

function readJson(rel) {
	return JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));
}

function writeJson(rel, data) {
	const full = resolve(ROOT, rel);
	mkdirSync(dirname(full), { recursive: true });
	writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf8');
}


// === CLI + config ============================================================

const args = process.argv.slice(2);
const corpusId = args.find((a) => !a.startsWith('--'));
if (!corpusId) {
	console.error('x Usage: node scripts/import-forum-as-fragments.mjs <corpus_id>');
	process.exit(1);
}

const CONFIG_FILE = `src/lib/content/corpora/${corpusId}/ingest.config.json`;
if (!existsSync(resolve(ROOT, CONFIG_FILE))) {
	console.error(`x Config not found: ${CONFIG_FILE}`);
	process.exit(1);
}
const config = readJson(CONFIG_FILE);

for (const k of ['corpus_id', 'label', 'platform', 'indications', 'input_file']) {
	if (!(k in config)) {
		console.error(`x Config missing required field: ${k}`);
		process.exit(1);
	}
}
if (config.corpus_id !== corpusId) {
	console.error(`x Config corpus_id "${config.corpus_id}" does not match arg "${corpusId}"`);
	process.exit(1);
}

const CONTEXT_TO_ATTRS = config.context_to_speaker_attrs ?? {};
const LICENSE = config.license ?? 'research_fair_use';
const REDISTRIBUTE = config.redistribute_verbatim ?? false;
const DEID_RULES_VERSION = config.deid_rules_version ?? 'unspecified@v0';
const DEIDENTIFIER_VERSION = config.deidentifier_version ?? 'unspecified@v0';

const SPLIT_CONFIG = { ...SPLIT_DEFAULTS, ...(config.split_long_fragments ?? {}) };
const SPLIT_APPLIES = new Set(SPLIT_CONFIG.applies_to);

// === Default weight bases per content_source ================================
// Mirrors DEFAULT_WEIGHT_BASE in corpora/types.ts. Overridable per row if a
// dataset surfaces signals (upvotes, replies) that warrant tuning.
const WEIGHT_BASE = { social_post: 0.5, social_comment: 0.3 };

// === Read input =============================================================

const rows = readJson(config.input_file);
if (!Array.isArray(rows)) {
	console.error(`x Input must be a JSON array of rows: ${config.input_file}`);
	process.exit(1);
}

// === Pre-process: re-anonymize [deleted] ====================================

let nextDeletedCounter = 0;
const deletedIdByRowIdx = new Map();
for (let i = 0; i < rows.length; i += 1) {
	if (rows[i].Username === '[deleted]') {
		deletedIdByRowIdx.set(
			i,
			`Anon_${corpusId}_${String(nextDeletedCounter).padStart(4, '0')}`
		);
		nextDeletedCounter += 1;
	}
}

function userIdOf(rowIdx, row) {
	if (deletedIdByRowIdx.has(rowIdx)) return deletedIdByRowIdx.get(rowIdx);
	return row['Anonymized Username'];
}

// === Pre-process: per-user context ==========================================

const contextsByUser = new Map(); // user_id -> Map<context, count>
for (let i = 0; i < rows.length; i += 1) {
	const r = rows[i];
	const uid = userIdOf(i, r);
	if (!uid) continue;
	const c = (r.Context || '').trim();
	if (!c) continue;
	if (!contextsByUser.has(uid)) contextsByUser.set(uid, new Map());
	const cmap = contextsByUser.get(uid);
	cmap.set(c, (cmap.get(c) || 0) + 1);
}

const resolvedContextByUser = new Map();
let usersWithConflict = 0;
for (const [uid, cmap] of contextsByUser.entries()) {
	if (cmap.size > 1) {
		const opts = [...cmap.entries()].map(([c, n]) => `${c} (${n})`).join('; ');
		console.warn(`  warn: user ${uid} has conflicting contexts: ${opts}. Using most-frequent.`);
		usersWithConflict += 1;
	}
	const best = [...cmap.entries()].sort((a, b) => b[1] - a[1])[0];
	resolvedContextByUser.set(uid, best[0]);
}

// === Pre-process: detect conflated anonymized ids ===========================

const rawByAnonId = new Map();
for (let i = 0; i < rows.length; i += 1) {
	const r = rows[i];
	if (deletedIdByRowIdx.has(i)) continue;
	const anon = r['Anonymized Username'];
	const raw = r.Username;
	if (!anon || !raw) continue;
	if (!rawByAnonId.has(anon)) rawByAnonId.set(anon, new Set());
	rawByAnonId.get(anon).add(raw);
}
const conflatedIds = [];
for (const [anon, rawSet] of rawByAnonId.entries()) {
	if (rawSet.size > 1) {
		conflatedIds.push({ anon, raws: [...rawSet] });
	}
}

// === Determine content_source per row =======================================
// First row per (Thread, Conversation) in input order = social_post; rest =
// social_comment. This avoids depending on comment-id format conventions.

const seenThreadConv = new Set();
function contentSourceOf(rowIdx, row) {
	const key = `${row.Thread ?? ''}|${row.Conversation ?? ''}`;
	if (!seenThreadConv.has(key)) {
		seenThreadConv.add(key);
		return 'social_post';
	}
	return 'social_comment';
}

// === Build speaker_attrs ====================================================

function speakerAttrsFor(uid) {
	const ctx = resolvedContextByUser.get(uid);
	if (!ctx) return {};
	const mapping = CONTEXT_TO_ATTRS[ctx];
	if (!mapping) return {};
	const attrs = {};
	for (const [k, v] of Object.entries(mapping)) {
		attrs[k] = {
			value: v,
			evidence: 'stated',
			source_quote: ctx
		};
	}
	return attrs;
}

// === Fragment id ============================================================

function fragmentIdOf(row, rowIdx) {
	const t = String(row.Thread ?? '').trim().replace(/\s+/g, '');
	const c = String(row.Conversation ?? '').trim().replace(/\s+/g, '');
	const m = String(row.Comment ?? '').trim().replace(/\s+/g, '_').toLowerCase();
	const base = [t, c, m].filter(Boolean).join('-');
	if (base) return `fc-${corpusId}-${base}`;
	// Fallback when hierarchy fields are missing.
	return `fc-${corpusId}-row${String(rowIdx).padStart(5, '0')}`;
}

// === Project rows → fragments ==============================================

const errors = [];
const fragmentsByContentSource = { social_post: [], social_comment: [] };
const seenIds = new Set();

const pad2 = (n) => String(n).padStart(2, '0');

/** Decide whether a row's text qualifies for sentence-level splitting. Returns
 *  the sentence list if so, otherwise null (caller emits one fragment).
 *  Forum prose is frequently all-lowercase (Reddit etc.), so the splitter
 *  must accept lowercase sentence starts or it returns 1 sentence on long
 *  uncapitalized posts and the row falls through as 'unsplittable_long'. */
function shouldSplit(text, contentSource) {
	if (!SPLIT_CONFIG.enabled) return null;
	if (!SPLIT_APPLIES.has(contentSource)) return null;
	if (text.length < SPLIT_CONFIG.min_chars) return null;
	const sentences = splitSentences(text, { allowLowercaseStart: true });
	if (sentences.length < SPLIT_CONFIG.min_sentences) return null;
	return sentences;
}

let skippedMetadataRows = 0;
let splitParentRows = 0;
let splitChildFragments = 0;
let unsplittableLongRows = 0;
for (let i = 0; i < rows.length; i += 1) {
	const r = rows[i];
	// Some forum exports include thread-title-only rows (Context set, no
	// Username, no Timestamp, no Text) that describe a thread or post header
	// without carrying user content. They aren't fragments; skip silently.
	const hasNoUsername = !r['Anonymized Username'] && !deletedIdByRowIdx.has(i);
	const hasNoText = normalizeText(String(r.Text ?? '')).length === 0;
	if (hasNoUsername && !r.Timestamp && hasNoText) {
		skippedMetadataRows += 1;
		continue;
	}
	if (!r['Anonymized Username'] && !deletedIdByRowIdx.has(i)) {
		errors.push(`row ${i}: missing Anonymized Username`);
		continue;
	}
	if (!r.Timestamp) {
		errors.push(`row ${i}: missing Timestamp`);
		continue;
	}
	const normalizedText = normalizeText(String(r.Text ?? ''));
	if (normalizedText.length === 0) {
		errors.push(`row ${i}: empty Text`);
		continue;
	}

	const uid = userIdOf(i, r);
	const contentSource = contentSourceOf(i, r);
	const rowFragmentId = fragmentIdOf(r, i);

	const postId = `${corpusId}-T${r.Thread ?? '?'}-C${r.Conversation ?? '?'}`;
	const commentId = String(r.Comment ?? '').trim();
	const nowIso = new Date().toISOString();

	const sourceRefBase = {
		kind: contentSource,
		platform: config.platform,
		post_id: postId,
		comment_id: commentId || undefined,
		author_handle_hash: uid
	};

	const fragmentBase = {
		corpus_id: corpusId,
		indications: config.indications,
		content_source: contentSource,
		lang: 'en',
		date_observed: r.Timestamp,
		date_referenced: null,
		speaker_attrs: speakerAttrsFor(uid),
		weight_base: WEIGHT_BASE[contentSource],
		weight_signals: {},
		license: LICENSE,
		redistribute_verbatim: REDISTRIBUTE,
		deidentified_at: r.Timestamp,
		deidentifier_version: DEIDENTIFIER_VERSION,
		deid_rules_version: DEID_RULES_VERSION,
		ingested_at: nowIso,
		ingester_version: INGESTER_VERSION
	};

	const sentences = shouldSplit(normalizedText, contentSource);

	if (sentences) {
		// Emit one fragment per sentence. Parent post does NOT emit a fragment;
		// siblings group via source_ref.post_id + comment_id.
		// Round-trip guard: every child's text must reproduce from the parent
		// text at its declared char offsets.
		splitParentRows += 1;
		for (let s = 0; s < sentences.length; s += 1) {
			const part = sentences[s];
			if (normalizedText.slice(part.start, part.end) !== part.text) {
				errors.push(
					`row ${i} seg ${s}: split offsets do not round-trip against parent text`
				);
				continue;
			}
			const childId = `${rowFragmentId}_s${pad2(s)}`;
			if (seenIds.has(childId)) {
				errors.push(`row ${i}: duplicate fragment_id ${childId}`);
				continue;
			}
			seenIds.add(childId);
			fragmentsByContentSource[contentSource].push({
				id: childId,
				...fragmentBase,
				source_ref: { ...sourceRefBase, char_start: part.start, char_end: part.end },
				text: part.text
			});
			splitChildFragments += 1;
		}
		continue;
	}

	// No split — single fragment per row, same as pre-0.2 behavior.
	if (seenIds.has(rowFragmentId)) {
		errors.push(`row ${i}: duplicate fragment_id ${rowFragmentId}`);
		continue;
	}
	seenIds.add(rowFragmentId);

	const flags = [];
	if (
		SPLIT_CONFIG.enabled &&
		SPLIT_APPLIES.has(contentSource) &&
		normalizedText.length >= SPLIT_CONFIG.min_chars
	) {
		// Above the length threshold but the splitter couldn't find enough
		// sentence boundaries. Surface for analyst review rather than silently
		// emitting a single bundled fragment.
		flags.push('unsplittable_long');
		unsplittableLongRows += 1;
	}

	fragmentsByContentSource[contentSource].push({
		id: rowFragmentId,
		...fragmentBase,
		source_ref: sourceRefBase,
		text: normalizedText,
		...(flags.length > 0 ? { flags } : {})
	});
}

if (errors.length > 0) {
	console.error(`x Validation failed with ${errors.length} error(s). Output not written.`);
	for (const e of errors.slice(0, 10)) console.error(`  - ${e}`);
	process.exit(1);
}

// === Compose + write outputs ================================================

const now = new Date().toISOString();
const OUT_DIR = `src/lib/content/corpora/${corpusId}`;

const partitions = [];
for (const [contentSource, fragments] of Object.entries(fragmentsByContentSource)) {
	if (fragments.length === 0) continue;
	const outFile = `${OUT_DIR}/fragments/${contentSource}.json`;
	const doc = {
		meta: {
			schema_version: '1.0',
			corpus_id: corpusId,
			content_source: contentSource,
			platform: config.platform,
			generated_at: now,
			generator: 'scripts/import-forum-as-fragments.mjs',
			ingester_version: INGESTER_VERSION,
			sources: [config.input_file],
			fragment_count: fragments.length,
			notes: [
				SPLIT_CONFIG.enabled && SPLIT_APPLIES.has(contentSource)
					? `Long rows (>=${SPLIT_CONFIG.min_chars} chars, >=${SPLIT_CONFIG.min_sentences} sentences) sentence-split into child fragments; short rows emit one fragment per row.`
					: 'One fragment per row of the platform export (split_long_fragments disabled for this partition).',
				`Thread-starting row per (Thread, Conversation) → social_post; subsequent rows → social_comment.`,
				`Per-user Context resolved to one value per anonymized id; ${usersWithConflict} user(s) had conflicting Context values (most-frequent used).`,
				`${nextDeletedCounter} [deleted] row(s) replaced with fresh per-row anonymous ids.`,
				`${conflatedIds.length} anonymized id(s) map to >1 raw username (logged; not auto-fixed).`,
				`Split children share source_ref.post_id + comment_id with their siblings; offsets are relative to the parent post's normalized text.`
			]
		},
		fragments
	};
	writeJson(outFile, doc);
	partitions.push({
		content_source: contentSource,
		fragment_count: fragments.length,
		ingester_version: INGESTER_VERSION,
		last_ingested_at: now
	});
}

// Preserve created_at across manifest re-writes.
const manifestPath = `${OUT_DIR}/manifest.json`;
let createdAt = now;
if (existsSync(resolve(ROOT, manifestPath))) {
	try {
		const prior = readJson(manifestPath);
		if (prior?.created_at) createdAt = prior.created_at;
	} catch {
		// fall through
	}
}

const manifest = {
	id: corpusId,
	label: config.label,
	indications: config.indications,
	created_at: createdAt,
	updated_at: now,
	partitions
};
writeJson(manifestPath, manifest);

// === Report =================================================================

console.log(`Wrote ${manifestPath}`);
for (const p of partitions) {
	console.log(`Wrote ${OUT_DIR}/fragments/${p.content_source}.json (${p.fragment_count} fragments)`);
}
console.log(`  ${rows.length} input rows → ${seenIds.size} fragments.`);
if (skippedMetadataRows > 0) {
	console.log(`  skipped ${skippedMetadataRows} thread-header / metadata-only rows.`);
}
if (SPLIT_CONFIG.enabled) {
	console.log(
		`  split: ${splitParentRows} long row(s) → ${splitChildFragments} child fragment(s) ` +
			`(threshold: >=${SPLIT_CONFIG.min_chars} chars AND >=${SPLIT_CONFIG.min_sentences} sentences)`
	);
	if (unsplittableLongRows > 0) {
		console.log(
			`  flagged 'unsplittable_long': ${unsplittableLongRows} row(s) above char threshold but with too few sentence boundaries.`
		);
	}
}
console.log(`  re-anonymized [deleted]: ${nextDeletedCounter}`);
console.log(`  per-user context conflicts: ${usersWithConflict}`);
if (conflatedIds.length > 0) {
	console.log(`  conflated anonymized ids: ${conflatedIds.length}`);
	for (const { anon, raws } of conflatedIds.slice(0, 5)) {
		console.log(`    - "${anon}" → ${raws.length} raw usernames: ${raws.join(', ')}`);
	}
}
