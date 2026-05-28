/**
 * propose-persona-suggestions.mjs
 *
 * Deterministic persona-suggestion pass over a corpus's fragments + annotations.
 * Groups authors by the shape of their annotation profile (themes, subthemes,
 * stages, steps) and emits candidate PersonaFilters the analyst can confirm or
 * edit. Singletons (authors with too few fragments to anchor a cluster) are
 * attached to their nearest medoid for the "show me everyone like this" UX.
 *
 * Output: src/lib/content/corpora/<corpus_id>/artifacts/persona_suggestions.json
 *
 * Run:
 *   node scripts/propose-persona-suggestions.mjs <corpus_id>
 *   node scripts/propose-persona-suggestions.mjs <corpus_id> --min-fragments 3
 *   node scripts/propose-persona-suggestions.mjs <corpus_id> --distance-cutoff 0.45
 *   node scripts/propose-persona-suggestions.mjs <corpus_id> --force
 *
 * No API key required — clustering reads existing annotations, no Claude calls.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	buildAuthorProfile,
	vocabFrom,
	vectorize,
	cosineDistance,
	topShares,
	topSharesAll,
	deriveFilter,
	overlapsExisting
} from '../src/lib/content/personas/derive.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCRIPT_VERSION = 'propose-persona-suggestions@0.1';
const SCHEMA_VERSION = '1.0';

// === CLI ====================================================================

const args = process.argv.slice(2);
const corpusId = args.find((a) => !a.startsWith('--'));
if (!corpusId) {
	console.error(
		'x Usage: node scripts/propose-persona-suggestions.mjs <corpus_id> ' +
			'[--min-fragments 2] [--distance-cutoff 0.5] [--min-cluster-size 3] ' +
			'[--share-threshold 0.4] [--role-threshold 0.6] [--force]'
	);
	process.exit(1);
}
const force = args.includes('--force');
const numArg = (flag, fallback) => {
	const idx = args.indexOf(flag);
	if (idx < 0) return fallback;
	const v = Number(args[idx + 1]);
	if (!Number.isFinite(v)) {
		console.error(`x ${flag} requires a number, got "${args[idx + 1]}"`);
		process.exit(1);
	}
	return v;
};
const MIN_FRAGMENTS = numArg('--min-fragments', 2);
const DISTANCE_CUTOFF = numArg('--distance-cutoff', 0.5);
const MIN_CLUSTER_SIZE = numArg('--min-cluster-size', 3);
const SHARE_THRESHOLD = numArg('--share-threshold', 0.4);
const ROLE_THRESHOLD = numArg('--role-threshold', 0.6);
const SINGLETON_ATTACH_CUTOFF = numArg('--singleton-attach-cutoff', 0.6);

// === Corpus loading =========================================================

const CORPUS_DIR = `src/lib/content/corpora/${corpusId}`;
const MANIFEST_FILE = `${CORPUS_DIR}/manifest.json`;
if (!existsSync(resolve(ROOT, MANIFEST_FILE))) {
	console.error(`x Corpus manifest not found: ${MANIFEST_FILE}`);
	process.exit(1);
}
const manifest = JSON.parse(readFileSync(resolve(ROOT, MANIFEST_FILE), 'utf8'));
const corpusIndications = manifest.indications ?? [];

const FRAGMENTS_DIR = `${CORPUS_DIR}/fragments`;
const ANNOTATIONS_DIR = `${CORPUS_DIR}/annotations`;
const ARTIFACTS_DIR = `${CORPUS_DIR}/artifacts`;
const OUTPUT_FILE = `${ARTIFACTS_DIR}/persona_suggestions.json`;

const fragments = [];
for (const f of readdirSync(resolve(ROOT, FRAGMENTS_DIR)).filter((f) => f.endsWith('.json'))) {
	const doc = JSON.parse(readFileSync(resolve(ROOT, FRAGMENTS_DIR, f), 'utf8'));
	for (const fr of doc.fragments ?? []) fragments.push(fr);
}
if (fragments.length === 0) {
	console.error(`x No fragments under ${FRAGMENTS_DIR}.`);
	process.exit(1);
}

const annotations = {};
if (existsSync(resolve(ROOT, ANNOTATIONS_DIR))) {
	for (const f of readdirSync(resolve(ROOT, ANNOTATIONS_DIR)).filter((f) => f.endsWith('.json'))) {
		const doc = JSON.parse(readFileSync(resolve(ROOT, ANNOTATIONS_DIR, f), 'utf8'));
		for (const [fid, ann] of Object.entries(doc.annotations ?? {})) annotations[fid] = ann;
	}
}

// Existing personas in this indication, for overlap flagging.
const PERSONAS_DIR = 'src/lib/content/personas';
const existingPersonas = [];
if (existsSync(resolve(ROOT, PERSONAS_DIR))) {
	for (const f of readdirSync(resolve(ROOT, PERSONAS_DIR)).filter((f) => f.endsWith('.json'))) {
		const p = JSON.parse(readFileSync(resolve(ROOT, PERSONAS_DIR, f), 'utf8'));
		if (p.applicable_indications?.some((i) => corpusIndications.includes(i))) {
			existingPersonas.push(p);
		}
	}
}

// === Pre-flight =============================================================

if (existsSync(resolve(ROOT, OUTPUT_FILE)) && !force) {
	console.error(`x ${OUTPUT_FILE} already exists. Re-run with --force to overwrite.`);
	process.exit(1);
}

console.log(`=== ${corpusId} ===`);
console.log(`  ${fragments.length} fragments, ${Object.keys(annotations).length} annotated`);
console.log(`  ${existingPersonas.length} existing persona(s) for this indication`);
console.log(`  params: min-fragments=${MIN_FRAGMENTS} cutoff=${DISTANCE_CUTOFF} ` +
	`min-cluster-size=${MIN_CLUSTER_SIZE} share-threshold=${SHARE_THRESHOLD}`);

// === Build author profiles ==================================================

const fragmentById = new Map(fragments.map((f) => [f.id, f]));
const fragmentsByAuthor = new Map();
let fragsWithoutAuthor = 0;
for (const f of fragments) {
	const h = f.source_ref?.author_handle_hash;
	if (!h) {
		fragsWithoutAuthor += 1;
		continue;
	}
	if (!fragmentsByAuthor.has(h)) fragmentsByAuthor.set(h, []);
	fragmentsByAuthor.get(h).push(f);
}
if (fragsWithoutAuthor > 0) {
	console.log(`  skipping ${fragsWithoutAuthor} fragment(s) with no author_handle_hash`);
}

const allProfiles = [...fragmentsByAuthor.entries()].map(([h, fs]) =>
	buildAuthorProfile(h, fs, annotations, { roleThreshold: ROLE_THRESHOLD })
);
const seedProfiles = allProfiles.filter((p) => p.fragment_count >= MIN_FRAGMENTS);
const singletonProfiles = allProfiles.filter((p) => p.fragment_count < MIN_FRAGMENTS);

console.log(`  authors: ${allProfiles.length} total, ${seedProfiles.length} seeds, ` +
	`${singletonProfiles.length} below min-fragments`);

if (seedProfiles.length < MIN_CLUSTER_SIZE) {
	console.error(`x Only ${seedProfiles.length} seed author(s) — fewer than min-cluster-size ${MIN_CLUSTER_SIZE}. ` +
		`Lower --min-fragments or wait for more data.`);
	process.exit(1);
}

// Build a fixed feature vocabulary across all profiles so vectors align.
const VOCAB = vocabFrom([...seedProfiles, ...singletonProfiles]);
const seedVectors = seedProfiles.map((p) => vectorize(p, VOCAB));

// Pairwise distances, only computed for the seeds.
const N = seedProfiles.length;
const dist = Array.from({ length: N }, () => new Float64Array(N));
for (let i = 0; i < N; i++) {
	for (let j = i + 1; j < N; j++) {
		const d = cosineDistance(seedVectors[i], seedVectors[j]);
		dist[i][j] = d;
		dist[j][i] = d;
	}
}

// === Agglomerative clustering (average linkage, distance cutoff) ============

// Start with each seed in its own cluster. Repeatedly merge the closest pair
// (by average linkage) until the smallest cross-cluster distance exceeds the
// cutoff. O(N^3) but N is in the dozens here.

let clusters = seedProfiles.map((_, i) => [i]);

function avgLinkage(ca, cb) {
	let total = 0, count = 0;
	for (const i of ca) for (const j of cb) { total += dist[i][j]; count += 1; }
	return total / count;
}

while (clusters.length > 1) {
	let best = { d: Infinity, a: -1, b: -1 };
	for (let a = 0; a < clusters.length; a++) {
		for (let b = a + 1; b < clusters.length; b++) {
			const d = avgLinkage(clusters[a], clusters[b]);
			if (d < best.d) best = { d, a, b };
		}
	}
	if (best.d > DISTANCE_CUTOFF) break;
	const merged = [...clusters[best.a], ...clusters[best.b]];
	clusters = clusters.filter((_, idx) => idx !== best.a && idx !== best.b);
	clusters.push(merged);
}

// Drop clusters below min-cluster-size; their members fall back to "unattached singletons".
const droppedSeeds = [];
const survivors = [];
for (const c of clusters) {
	if (c.length >= MIN_CLUSTER_SIZE) survivors.push(c);
	else droppedSeeds.push(...c);
}
console.log(`  ${survivors.length} cluster(s) survived; ${droppedSeeds.length} seed(s) dropped to below-size`);

// === Per-cluster: medoid, centroid, stats, derived filter ===================

function meanVec(indices) {
	if (indices.length === 0) return new Float64Array(seedVectors[0].length);
	const out = new Float64Array(seedVectors[0].length);
	for (const i of indices) for (let k = 0; k < out.length; k++) out[k] += seedVectors[i][k];
	for (let k = 0; k < out.length; k++) out[k] /= indices.length;
	return out;
}

function medoidOf(indices) {
	let best = { i: -1, sum: Infinity };
	for (const i of indices) {
		let sum = 0;
		for (const j of indices) if (i !== j) sum += dist[i][j];
		if (sum < best.sum) best = { i, sum };
	}
	return best.i;
}

function evidenceFor(clusterProfiles, centroid, limit = 5) {
	// Score every fragment in the cluster by (a) closeness to centroid via its
	// author's vector and (b) how much annotation density it has. Cap at one per
	// author so a chatty exemplar doesn't dominate.
	const scored = [];
	const profileByAuthor = new Map(clusterProfiles.map((p) => [p.author_handle_hash, p]));
	for (const p of clusterProfiles) {
		const idx = seedProfiles.indexOf(p);
		const authorDistToCentroid = idx >= 0 ? cosineDistance(seedVectors[idx], centroid) : 1;
		for (const fid of p.fragment_ids) {
			const ann = annotations[fid];
			const density = (ann?.segment_tags?.subthemes?.length ?? 0)
				+ (ann?.stages?.values?.length ?? 0);
			if (density === 0) continue;
			const score = (1 - authorDistToCentroid) * Math.log(1 + density);
			scored.push({ fid, author: p.author_handle_hash, score });
		}
	}
	scored.sort((a, b) => b.score - a.score);
	const seen = new Set();
	const out = [];
	for (const s of scored) {
		if (seen.has(s.author)) continue;
		seen.add(s.author);
		out.push(s.fid);
		if (out.length >= limit) break;
	}
	return out;
}

const clusterInfos = survivors.map((indices, idx) => {
	const profiles = indices.map((i) => seedProfiles[i]);
	const centroid = meanVec(indices);
	const medoidIdx = medoidOf(indices);
	const medoidProfile = seedProfiles[medoidIdx];

	const intra = [];
	for (let a = 0; a < indices.length; a++) {
		for (let b = a + 1; b < indices.length; b++) intra.push(dist[indices[a]][indices[b]]);
	}
	const cohesion = intra.length > 0
		? 1 - intra.reduce((s, x) => s + x, 0) / intra.length
		: 1;

	const proposedFilter = deriveFilter(profiles, {
		fragmentsById: fragmentById,
		indications: corpusIndications,
		shareThreshold: SHARE_THRESHOLD,
		roleThreshold: ROLE_THRESHOLD
	});

	const sentiments = profiles
		.map((p) => p.features.sentiment_mean)
		.filter((x) => x !== null);
	const sentMean = sentiments.length
		? sentiments.reduce((a, b) => a + b, 0) / sentiments.length
		: null;
	const sentStd = sentiments.length > 1
		? Math.sqrt(sentiments.reduce((a, b) => a + (b - sentMean) ** 2, 0) / sentiments.length)
		: null;

	return {
		_indices: indices,
		_centroid: centroid,
		_medoidIdx: medoidIdx,
		id: `sugg-${corpusId}-${idx + 1}`,
		seed_authors: profiles.map((p) => p.author_handle_hash),
		exemplar_author: medoidProfile.author_handle_hash,
		fragment_count: profiles.reduce((s, p) => s + p.fragment_count, 0),
		cohesion: Number(cohesion.toFixed(3)),
		top_themes: topSharesAll(profiles, 'themes'),
		top_subthemes: topSharesAll(profiles, 'subthemes'),
		top_stages: topSharesAll(profiles, 'stages'),
		top_steps: topSharesAll(profiles, 'steps'),
		top_emotions: topSharesAll(profiles, 'emotions'),
		sentiment: sentMean !== null
			? { mean: Number(sentMean.toFixed(2)), std: sentStd !== null ? Number(sentStd.toFixed(2)) : null }
			: null,
		proposed_filter: proposedFilter,
		evidence_fragment_ids: evidenceFor(profiles, centroid),
		overlaps_existing: overlapsExisting(proposedFilter, existingPersonas)
	};
});

// Distinctness: min distance from this cluster's medoid to any other cluster's medoid.
for (const ci of clusterInfos) {
	let nearest = Infinity;
	for (const cj of clusterInfos) {
		if (cj === ci) continue;
		const d = dist[ci._medoidIdx][cj._medoidIdx];
		if (d < nearest) nearest = d;
	}
	ci.distinctness = clusterInfos.length === 1 ? 1 : Number(nearest.toFixed(3));
}

// === Singleton attachment ===================================================

let attachedSingletonCount = 0;
const unattachedSingletons = [];
for (const sp of singletonProfiles) {
	const vec = vectorize(sp, VOCAB);
	let best = { d: Infinity, ci: null };
	for (const ci of clusterInfos) {
		const d = cosineDistance(vec, ci._centroid);
		if (d < best.d) best = { d, ci };
	}
	if (best.ci && best.d <= SINGLETON_ATTACH_CUTOFF) {
		(best.ci._attached ??= []).push(sp.author_handle_hash);
		attachedSingletonCount += 1;
	} else {
		unattachedSingletons.push(sp.author_handle_hash);
	}
}

// Also fold dropped-cluster seeds into the unattached bucket for visibility.
for (const di of droppedSeeds) {
	unattachedSingletons.push(seedProfiles[di].author_handle_hash);
}

// === Rank + finalize ========================================================

clusterInfos.sort((a, b) => {
	// Strong, sizable, distinct clusters first.
	const score = (c) => c.cohesion * Math.log(1 + c.fragment_count) * (0.5 + c.distinctness);
	return score(b) - score(a);
});

const suggestions = clusterInfos.map((ci, idx) => ({
	id: ci.id,
	rank: idx + 1,
	proposed_filter: ci.proposed_filter,
	seed_authors: ci.seed_authors,
	exemplar_author: ci.exemplar_author,
	attached_singletons: ci._attached ?? [],
	fragment_count: ci.fragment_count,
	cohesion: ci.cohesion,
	distinctness: ci.distinctness,
	top_themes: ci.top_themes,
	top_subthemes: ci.top_subthemes,
	top_stages: ci.top_stages,
	top_steps: ci.top_steps,
	top_emotions: ci.top_emotions,
	sentiment: ci.sentiment,
	evidence_fragment_ids: ci.evidence_fragment_ids,
	overlaps_existing: ci.overlaps_existing
}));

// === Validate then write ====================================================

for (const s of suggestions) {
	if (s.seed_authors.length === 0) {
		console.error(`x ${s.id}: empty seed_authors — clustering bug. Not writing.`);
		process.exit(1);
	}
	if (s.evidence_fragment_ids.length === 0) {
		console.warn(`  ! ${s.id}: no evidence fragments found (cluster has no annotated fragments).`);
	}
	for (const fid of s.evidence_fragment_ids) {
		if (!fragmentById.has(fid)) {
			console.error(`x ${s.id}: evidence_fragment_id "${fid}" not in corpus. Not writing.`);
			process.exit(1);
		}
	}
}

const output = {
	meta: {
		schema_version: SCHEMA_VERSION,
		corpus_id: corpusId,
		generator: SCRIPT_VERSION,
		generated_at: new Date().toISOString(),
		params: {
			min_fragments: MIN_FRAGMENTS,
			distance_cutoff: DISTANCE_CUTOFF,
			min_cluster_size: MIN_CLUSTER_SIZE,
			share_threshold: SHARE_THRESHOLD,
			role_threshold: ROLE_THRESHOLD,
			singleton_attach_cutoff: SINGLETON_ATTACH_CUTOFF
		},
		universe: {
			total_fragments: fragments.length,
			total_authors: allProfiles.length,
			seed_authors: seedProfiles.length,
			singleton_authors: singletonProfiles.length,
			attached_singletons: attachedSingletonCount,
			unattached_authors: unattachedSingletons.length
		},
		notes: [
			'Deterministic pass; no Claude call. Re-run after re-tagging fragments.',
			'proposed_filter is a starting point — analyst widens/narrows in the UI.',
			'seed_authors anchored each cluster; attached_singletons joined via nearest-medoid.',
			'Re-run with: node scripts/propose-persona-suggestions.mjs <corpus> --force'
		]
	},
	suggestions,
	unattached_authors: unattachedSingletons
};

if (!existsSync(resolve(ROOT, ARTIFACTS_DIR))) {
	mkdirSync(resolve(ROOT, ARTIFACTS_DIR), { recursive: true });
}
writeFileSync(resolve(ROOT, OUTPUT_FILE), JSON.stringify(output, null, 2) + '\n');

console.log(`\nOK wrote ${OUTPUT_FILE}`);
console.log(`  ${suggestions.length} suggestion(s); ${attachedSingletonCount} singleton(s) attached, ` +
	`${unattachedSingletons.length} unattached`);
for (const s of suggestions) {
	const subs = s.proposed_filter.annotations?.has_subtheme?.slice(0, 3).join(', ') ?? '—';
	const flag = s.overlaps_existing.length > 0 ? ` overlaps:${s.overlaps_existing[0].persona_id}` : '';
	console.log(`  ${s.id} rank=${s.rank} cohesion=${s.cohesion} ` +
		`seeds=${s.seed_authors.length}+${s.attached_singletons.length} ` +
		`subthemes=[${subs}]${flag}`);
}
