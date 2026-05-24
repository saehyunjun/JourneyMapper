/**
 * validate-disease-insights.mjs
 *
 * Verifies the integrity of src/lib/content/disease-insights/ and the
 * registries it depends on:
 *
 *   - every JSON file parses
 *   - every manifest dataset.path resolves to an existing file
 *   - every indication_id / therapeutic_area_id / type / source.type referenced
 *     anywhere lives in the matching registry
 *   - keyword-cluster files have unique ids per file and the required
 *     fields on every cluster (per lexicon shape: id, label, description,
 *     indication, parent_theme, parent_subtheme, variants[])
 *
 * Exits 0 on success, 1 on any integrity failure.
 *
 * Run: node scripts/validate-disease-insights.mjs
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const REGISTRIES_DIR = join(ROOT, 'src/lib/content/registries');
const INSIGHTS_DIR = join(ROOT, 'src/lib/content/disease-insights');

const errors = [];
const fail = (msg) => errors.push(msg);

function readJson(absPath) {
	try {
		return JSON.parse(readFileSync(absPath, 'utf8'));
	} catch (e) {
		fail(`parse error: ${relative(ROOT, absPath)} — ${e.message}`);
		return null;
	}
}

// --- Load registries -------------------------------------------------------

const taReg = readJson(join(REGISTRIES_DIR, 'therapeutic_areas.json'));
const indReg = readJson(join(REGISTRIES_DIR, 'indications.json'));
const dtReg = readJson(join(REGISTRIES_DIR, 'dataset_types.json'));
const srcReg = readJson(join(REGISTRIES_DIR, 'sources.json'));

if (!taReg || !indReg || !dtReg || !srcReg) {
	console.error('FAIL: one or more registry files failed to parse');
	process.exit(1);
}

const taIds = new Set(taReg.items.map((x) => x.id));
const indIds = new Set(indReg.items.map((x) => x.id));
const dtIds = new Set(dtReg.items.map((x) => x.id));
const srcTypeIds = new Set(srcReg.source_types.map((x) => x.id));
const srcItemIds = new Set(srcReg.items.map((x) => x.id));

// Indications must reference real therapeutic areas
for (const ind of indReg.items) {
	for (const ta of ind.therapeutic_area_ids ?? []) {
		if (!taIds.has(ta)) {
			fail(`indications.json: "${ind.id}" references unknown therapeutic_area_id "${ta}"`);
		}
	}
}

// --- Walk disease-insights folders ----------------------------------------

const folders = readdirSync(INSIGHTS_DIR)
	.filter((name) => {
		const full = join(INSIGHTS_DIR, name);
		return statSync(full).isDirectory();
	})
	.sort();

if (folders.length === 0) {
	fail('disease-insights/: no disease folders found');
}

let datasetCount = 0;
let clusterFileCount = 0;

for (const folder of folders) {
	const folderPath = join(INSIGHTS_DIR, folder);
	const manifestPath = join(folderPath, 'manifest.json');

	if (!existsSync(manifestPath)) {
		fail(`${folder}/: missing manifest.json`);
		continue;
	}

	const manifest = readJson(manifestPath);
	if (!manifest) continue;

	// Required fields
	for (const field of ['id', 'slug', 'label', 'therapeutic_area_ids', 'datasets']) {
		if (!(field in manifest)) {
			fail(`${folder}/manifest.json: missing required field "${field}"`);
		}
	}

	if (manifest.slug !== folder) {
		fail(`${folder}/manifest.json: slug "${manifest.slug}" does not match folder name "${folder}"`);
	}

	if (!indIds.has(manifest.id)) {
		fail(`${folder}/manifest.json: id "${manifest.id}" is not in registries/indications.json`);
	}

	for (const ta of manifest.therapeutic_area_ids ?? []) {
		if (!taIds.has(ta)) {
			fail(`${folder}/manifest.json: unknown therapeutic_area_id "${ta}"`);
		}
	}

	const seenDatasetIds = new Set();
	for (const ds of manifest.datasets ?? []) {
		datasetCount++;
		for (const field of ['id', 'type', 'label', 'path']) {
			if (!(field in ds)) {
				fail(`${folder}/manifest.json: dataset missing required field "${field}"`);
			}
		}
		if (seenDatasetIds.has(ds.id)) {
			fail(`${folder}/manifest.json: duplicate dataset id "${ds.id}"`);
		}
		seenDatasetIds.add(ds.id);

		if (!dtIds.has(ds.type)) {
			fail(`${folder}/manifest.json: dataset "${ds.id}" has unknown type "${ds.type}"`);
		}
		if (ds.source_id && !srcItemIds.has(ds.source_id)) {
			fail(`${folder}/manifest.json: dataset "${ds.id}" references unknown source_id "${ds.source_id}"`);
		}

		const dsAbs = join(folderPath, ds.path);
		if (!existsSync(dsAbs)) {
			fail(`${folder}/manifest.json: dataset path "${ds.path}" does not exist`);
			continue;
		}

		const payload = readJson(dsAbs);
		if (!payload) continue;

		if (ds.type === 'keyword_clusters') {
			clusterFileCount++;
			validateClusterFile(payload, `${folder}/${ds.path}`);
		} else {
			validateDatasetEnvelope(payload, ds, manifest, `${folder}/${ds.path}`);
		}
	}
}

function validateClusterFile(payload, label) {
	if (!Array.isArray(payload.clusters)) {
		fail(`${label}: missing clusters[] array`);
		return;
	}
	const seen = new Set();
	const required = ['id', 'label', 'description', 'indication', 'parent_theme', 'parent_subtheme', 'variants'];
	for (const cluster of payload.clusters) {
		for (const f of required) {
			if (!(f in cluster)) {
				fail(`${label}: cluster "${cluster.id ?? '<unknown>'}" missing field "${f}"`);
			}
		}
		if (cluster.id) {
			if (seen.has(cluster.id)) {
				fail(`${label}: duplicate cluster id "${cluster.id}"`);
			}
			seen.add(cluster.id);
		}
		if (cluster.indication && !indIds.has(cluster.indication)) {
			fail(`${label}: cluster "${cluster.id}" has unknown indication "${cluster.indication}"`);
		}
		if (!Array.isArray(cluster.variants)) {
			fail(`${label}: cluster "${cluster.id}" variants must be an array`);
		}
	}
}

function validateDatasetEnvelope(payload, ds, manifest, label) {
	if (payload.id && payload.id !== ds.id) {
		fail(`${label}: payload.id "${payload.id}" does not match manifest dataset id "${ds.id}"`);
	}
	if (payload.type && payload.type !== ds.type) {
		fail(`${label}: payload.type "${payload.type}" does not match manifest dataset type "${ds.type}"`);
	}
	if (payload.indication_id && payload.indication_id !== manifest.id) {
		fail(
			`${label}: payload.indication_id "${payload.indication_id}" does not match manifest.id "${manifest.id}"`
		);
	}
	for (const ta of payload.therapeutic_area_ids ?? []) {
		if (!taIds.has(ta)) {
			fail(`${label}: unknown therapeutic_area_id "${ta}"`);
		}
	}
	if (payload.source && payload.source.type && !srcTypeIds.has(payload.source.type)) {
		fail(`${label}: source.type "${payload.source.type}" is not in registries/sources.json source_types`);
	}
	if (!Array.isArray(payload.data)) {
		fail(`${label}: missing data[] array`);
	}
}

// --- Report ----------------------------------------------------------------

if (errors.length) {
	console.error(`FAIL: ${errors.length} integrity error(s)`);
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
}

console.log(
	`OK — ${folders.length} disease folder(s), ${datasetCount} dataset(s), ${clusterFileCount} cluster file(s)`
);
