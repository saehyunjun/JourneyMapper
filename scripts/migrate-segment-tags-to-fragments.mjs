/**
 * migrate-segment-tags-to-fragments.mjs
 *
 * Phase 2 annotation migration: lifts theme / subtheme / emotion / sentiment /
 * topic annotations from the interview-side `segment_tags.json` into the
 * cross-source fragment annotation tree under the `segment_tags` dimension.
 *
 * Inputs (read-only):
 *   src/lib/content/wctglpdemo-data/segment_tags.json   (analyst-reviewed)
 *   src/lib/content/corpora/wct_glp1_2025q4/fragments/interview.json
 *
 * Output:
 *   src/lib/content/corpora/wct_glp1_2025q4/annotations/interview.json
 *   (merges the `segment_tags` dimension into existing entries; preserves
 *    other dimensions like `stages`. Touches only meta.dimensions.segment_tags
 *    and annotations[*].segment_tags.)
 *
 * Mapping: fragment_id 'iv-<segment_id>' ↔ segment_id. Fragments without a
 * matching segment_tags entry get no segment_tags dimension; that's normal
 * (e.g., participants tagged after segment_tags.json was last regenerated).
 *
 * Deterministic. Idempotent. Run after segment_tags.json is regenerated.
 *
 * Run: node scripts/migrate-segment-tags-to-fragments.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SEGMENT_TAGS_FILE = 'src/lib/content/wctglpdemo-data/segment_tags.json';
const FRAGMENTS_FILE = 'src/lib/content/corpora/wct_glp1_2025q4/fragments/interview.json';
const ANNOTATIONS_FILE = 'src/lib/content/corpora/wct_glp1_2025q4/annotations/interview.json';

function readJson(rel) {
	return JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));
}

function writeJson(rel, data) {
	const full = resolve(ROOT, rel);
	mkdirSync(dirname(full), { recursive: true });
	writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// === Read inputs ============================================================

const segmentTagsDoc = readJson(SEGMENT_TAGS_FILE);
const fragmentsDoc = readJson(FRAGMENTS_FILE);

const fragmentsById = new Map(fragmentsDoc.fragments.map((f) => [f.id, f]));
const fragmentBySegmentId = new Map();
for (const f of fragmentsDoc.fragments) {
	if (f.source_ref?.kind === 'interview' && f.source_ref.segment_id) {
		fragmentBySegmentId.set(f.source_ref.segment_id, f);
	}
}

// segment_tags.json annotations may be keyed two ways depending on file
// version: array under `.annotations` or map keyed by segment_id. Handle both.
const segmentTagEntries = (() => {
	const raw = segmentTagsDoc.annotations ?? segmentTagsDoc.proposals ?? [];
	if (Array.isArray(raw)) return raw;
	return Object.entries(raw).map(([segment_id, v]) => ({ segment_id, ...v }));
})();

// === Read existing annotations (preserve other dimensions) ==================

let existing = { meta: {}, annotations: {} };
if (existsSync(resolve(ROOT, ANNOTATIONS_FILE))) {
	existing = readJson(ANNOTATIONS_FILE);
}

const annotations = { ...(existing.annotations ?? {}) };

// === Merge =================================================================

const errors = [];
let merged = 0;
let unmatched = 0;
let unmatchedSegmentIds = [];

for (const entry of segmentTagEntries) {
	const segmentId = entry.segment_id;
	if (!segmentId) {
		errors.push(`segment_tags entry missing segment_id: ${JSON.stringify(entry).slice(0, 120)}`);
		continue;
	}
	const fragment = fragmentBySegmentId.get(segmentId);
	if (!fragment) {
		unmatched += 1;
		if (unmatchedSegmentIds.length < 6) unmatchedSegmentIds.push(segmentId);
		continue;
	}

	if (!annotations[fragment.id]) annotations[fragment.id] = {};
	annotations[fragment.id].segment_tags = {
		themes: entry.themes ?? [],
		subthemes: entry.subthemes ?? [],
		emotions: entry.emotions ?? [],
		topics: entry.topics ?? [],
		sentiment_score: typeof entry.sentiment === 'number' ? entry.sentiment : null,
		confidence: typeof entry.confidence === 'number' ? entry.confidence : null,
		note: entry.reviewer_notes ?? entry.note ?? '',
		source: entry.source ?? 'ai_proposed',
		review_status: entry.review_status ?? 'pending'
	};
	merged += 1;
}

if (errors.length > 0) {
	console.error(`x Validation failed with ${errors.length} error(s). Output not written.`);
	for (const e of errors.slice(0, 10)) console.error(`  - ${e}`);
	process.exit(1);
}

// === Compose output =========================================================

const nowIso = new Date().toISOString();

const priorMeta = existing.meta && typeof existing.meta === 'object' ? existing.meta : {};
const priorDimensions =
	priorMeta.dimensions && typeof priorMeta.dimensions === 'object' ? priorMeta.dimensions : {};

const segmentTagsDimensionMeta = {
	generator: 'scripts/migrate-segment-tags-to-fragments.mjs',
	source_file: SEGMENT_TAGS_FILE,
	codebook_schema_version: segmentTagsDoc.meta?.codebook_schema_version ?? null,
	last_generated_at: nowIso,
	merged_fragment_count: merged,
	unmatched_segment_count: unmatched
};

const baseNotes = [
	'Multi-dimensional annotation file. Each fragment may carry multiple dimension keys (stages, segment_tags, ...). Each dimension is owned by its own producer script.',
	'segment_tags dimension: themes / subthemes / emotions / topics / sentiment_score lifted from interview-side segment_tags.json via segment_id ↔ fragment_id join.',
	'stages dimension: AI-proposed journey-stage tags. See scripts/propose-fragment-stages.mjs.',
	'Re-run this migration after segment_tags.json is regenerated to refresh the segment_tags dimension.'
];

const output = {
	meta: {
		schema_version: priorMeta.schema_version ?? '1.0',
		corpus_id: priorMeta.corpus_id ?? 'wct_glp1_2025q4',
		content_source: priorMeta.content_source ?? 'interview',
		updated_at: nowIso,
		dimensions: {
			...priorDimensions,
			segment_tags: segmentTagsDimensionMeta
		},
		notes: baseNotes
	},
	annotations: Object.fromEntries(
		Object.keys(annotations).sort().map((k) => [k, annotations[k]])
	)
};

writeJson(ANNOTATIONS_FILE, output);

// === Report =================================================================

console.log(`Wrote ${ANNOTATIONS_FILE}`);
console.log(`  ${merged} segment_tags dimensions merged into fragment annotations.`);
console.log(`  ${unmatched} segment_tags entries had no matching fragment (likely excluded interviews).`);
if (unmatchedSegmentIds.length > 0) {
	console.log(`  First unmatched: ${unmatchedSegmentIds.join(', ')}`);
}
const fragWith = Object.values(output.annotations).filter((a) => a.segment_tags).length;
const fragTotal = fragmentsDoc.fragments.length;
console.log(`  Coverage: ${fragWith}/${fragTotal} fragments now carry a segment_tags dimension.`);
