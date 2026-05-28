/**
 * derive-persona-from-authors.mjs
 *
 * Manual-merge entry point: take a list of authors the analyst hand-picked
 * from a corpus, derive a PersonaFilter from their shared annotation profile,
 * and either print the persona-shaped JSON or save it as a real persona file.
 *
 * Uses the SAME deriver as scripts/propose-persona-suggestions.mjs (see
 * scripts/lib/persona-deriver.mjs) so manual + suggested personas have
 * consistent shape.
 *
 * Run (preview to stdout):
 *   node scripts/derive-persona-from-authors.mjs <corpus_id> \
 *     --authors "Participant 005,Participant 003,Participant 052"
 *
 * Run (save to src/lib/content/personas/<id>.json):
 *   node scripts/derive-persona-from-authors.mjs <corpus_id> \
 *     --authors "Participant 005,Participant 003" \
 *     --id ln_carT_self_advocates \
 *     --label "LN CAR-T self-advocates" \
 *     --description "Lupus patients running their own CAR-T research..." \
 *     --color "#7c3aed" \
 *     --save
 *
 * Stdout output includes a corpus match-preview so the analyst can see whether
 * the derived filter is tight (matches only the seeds) or loose (sweeps in
 * other authors). Both are valid — the preview surfaces which one.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	buildAuthorProfile,
	deriveFilter,
	topSharesAll,
	matchesFilter,
	overlapsExisting
} from '../src/lib/content/personas/derive.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// === CLI ====================================================================

const args = process.argv.slice(2);
const corpusId = args.find((a) => !a.startsWith('--'));
const flag = (name) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : null;
};
const has = (name) => args.includes(name);
const numArg = (name, fallback) => {
	const v = flag(name);
	if (v == null) return fallback;
	const n = Number(v);
	if (!Number.isFinite(n)) {
		console.error(`x ${name} requires a number, got "${v}"`);
		process.exit(1);
	}
	return n;
};

if (!corpusId || !flag('--authors')) {
	console.error(
		'x Usage: node scripts/derive-persona-from-authors.mjs <corpus_id> ' +
			'--authors "a1,a2,..." [--id <slug>] [--label <text>] [--description <text>] ' +
			'[--color <hex>] [--save] [--force] ' +
			'[--share-threshold 0.4] [--role-threshold 0.6]'
	);
	process.exit(1);
}

const authorList = flag('--authors')
	.split(',')
	.map((s) => s.trim())
	.filter(Boolean);
if (authorList.length === 0) {
	console.error('x --authors was empty after parsing.');
	process.exit(1);
}

const personaId = flag('--id');
const personaLabel = flag('--label');
const personaDescription = flag('--description');
const personaColor = flag('--color');
const save = has('--save');
const force = has('--force');
const SHARE_THRESHOLD = numArg('--share-threshold', 0.4);
const ROLE_THRESHOLD = numArg('--role-threshold', 0.6);

if (save && (!personaId || !personaLabel || !personaDescription)) {
	console.error('x --save requires --id, --label, and --description.');
	process.exit(1);
}

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

const fragments = [];
for (const f of readdirSync(resolve(ROOT, FRAGMENTS_DIR)).filter((f) => f.endsWith('.json'))) {
	const doc = JSON.parse(readFileSync(resolve(ROOT, FRAGMENTS_DIR, f), 'utf8'));
	for (const fr of doc.fragments ?? []) fragments.push(fr);
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

// === Group fragments by author ==============================================

const fragmentsByAuthor = new Map();
for (const f of fragments) {
	const h = f.source_ref?.author_handle_hash;
	if (!h) continue;
	if (!fragmentsByAuthor.has(h)) fragmentsByAuthor.set(h, []);
	fragmentsByAuthor.get(h).push(f);
}

const missing = authorList.filter((a) => !fragmentsByAuthor.has(a));
if (missing.length > 0) {
	console.error(`x Author(s) not found in corpus: ${missing.join(', ')}`);
	console.error(`  Available authors with ≥1 fragment: ${fragmentsByAuthor.size}`);
	process.exit(1);
}

// === Build profiles + derive filter =========================================

const fragmentById = new Map(fragments.map((f) => [f.id, f]));
const profiles = authorList.map((a) =>
	buildAuthorProfile(a, fragmentsByAuthor.get(a), annotations, { roleThreshold: ROLE_THRESHOLD })
);

const filter = deriveFilter(profiles, {
	fragmentsById: fragmentById,
	indications: corpusIndications,
	shareThreshold: SHARE_THRESHOLD,
	roleThreshold: ROLE_THRESHOLD
});

// === Match preview ==========================================================

const seedFragmentIds = new Set(profiles.flatMap((p) => p.fragment_ids));
const matchedFragments = fragments.filter((f) => matchesFilter(f, filter, annotations));
const matchedAuthors = new Set(
	matchedFragments.map((f) => f.source_ref?.author_handle_hash).filter(Boolean)
);

const preview = {
	seed_authors: authorList.length,
	seed_fragments: seedFragmentIds.size,
	filter_matches_fragments: matchedFragments.length,
	filter_matches_authors: matchedAuthors.size,
	seed_fragments_kept: matchedFragments.filter((f) => seedFragmentIds.has(f.id)).length,
	non_seed_fragments_swept_in: matchedFragments.filter((f) => !seedFragmentIds.has(f.id)).length,
	non_seed_authors_swept_in: [...matchedAuthors].filter((a) => !authorList.includes(a)).length
};

const persona = {
	id: personaId ?? `<TODO-set-id>`,
	label: personaLabel ?? `<TODO-set-label>`,
	description: personaDescription ?? `<TODO-set-description>`,
	applicable_indications: corpusIndications,
	filter,
	weighting: { type: 'uniform' },
	...(personaColor ? { color: personaColor } : {})
};

const report = {
	derived_from: {
		corpus_id: corpusId,
		authors: authorList,
		share_threshold: SHARE_THRESHOLD,
		role_threshold: ROLE_THRESHOLD
	},
	persona,
	preview,
	profile_summary: {
		top_themes: topSharesAll(profiles, 'themes'),
		top_subthemes: topSharesAll(profiles, 'subthemes'),
		top_stages: topSharesAll(profiles, 'stages'),
		top_steps: topSharesAll(profiles, 'steps'),
		top_emotions: topSharesAll(profiles, 'emotions')
	},
	overlaps_existing: overlapsExisting(filter, existingPersonas)
};

// === Save (optional) ========================================================

if (save) {
	const path = `${PERSONAS_DIR}/${personaId}.json`;
	if (existsSync(resolve(ROOT, path)) && !force) {
		console.error(`x ${path} already exists. Re-run with --force to overwrite.`);
		process.exit(1);
	}
	if (!existsSync(resolve(ROOT, PERSONAS_DIR))) mkdirSync(resolve(ROOT, PERSONAS_DIR), { recursive: true });
	writeFileSync(resolve(ROOT, path), JSON.stringify(persona, null, 2) + '\n');
	console.error(`OK wrote ${path}`);
	console.error(`  seed authors: ${authorList.length} (${seedFragmentIds.size} fragments)`);
	console.error(`  filter matches: ${matchedFragments.length} fragments across ${matchedAuthors.size} authors`);
	console.error(`  swept in: +${preview.non_seed_authors_swept_in} authors, ` +
		`+${preview.non_seed_fragments_swept_in} fragments`);
	if (report.overlaps_existing.length > 0) {
		console.error(`  overlaps existing: ${report.overlaps_existing.map((o) => `${o.persona_id}=${o.jaccard}`).join(', ')}`);
	}
	process.exit(0);
}

// === Preview to stdout ======================================================

process.stdout.write(JSON.stringify(report, null, 2) + '\n');
