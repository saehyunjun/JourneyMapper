/**
 * fetch-clinicaltrials.mjs
 *
 * Deterministic step: pull ClinicalTrials.gov v2 study records for an
 * indication and cache them on disk as a raw_studies.json envelope.
 *
 * Design choices:
 *   - Two (or more) named queries are run separately and deduped by NCT id.
 *     Each study records which queries returned it (matched_queries[]) so a
 *     downstream relevance scorer can use that signal.
 *   - Study payloads are kept UNFLATTENED — the full protocolSection /
 *     derivedSection / hasResults shape that CT.gov returns is preserved.
 *     Flattening is a job for a separate normalize step.
 *   - No auth, no LLM, no DB writes — file in, file out. Validate, then write.
 *
 * Run:
 *   node scripts/fetch-clinicaltrials.mjs                  # lupus_nephritis, default out path
 *   node scripts/fetch-clinicaltrials.mjs --indication=lupus_nephritis
 *   node scripts/fetch-clinicaltrials.mjs --out=path/to/raw_studies.json
 *   node scripts/fetch-clinicaltrials.mjs --force          # overwrite existing output
 *   node scripts/fetch-clinicaltrials.mjs --dry-run        # fetch + report, do not write
 */

import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SCHEMA_VERSION = '1.0';
const BASE_URL = 'https://clinicaltrials.gov/api/v2/studies';
const PAGE_SIZE = 1000;

const QUERY_SETS = {
	lupus_nephritis: {
		default_out: 'src/lib/content/disease-insights/lupus-nephritis/clinical_trials/raw_studies.json',
		queries: [
			{
				id: 'lupus_nephritis_direct',
				label: 'Condition matches "lupus nephritis"',
				params: { 'query.cond': '"lupus nephritis"' }
			},
			{
				id: 'sle_renal',
				label: 'SLE + renal/kidney/nephritis terms',
				params: {
					'query.cond':
						'"systemic lupus erythematosus" AND (renal OR kidney OR nephritis OR "kidney involvement")'
				}
			}
		]
	},
	multiple_sclerosis: {
		default_out: 'src/lib/content/disease-insights/multiple-sclerosis/clinical_trials/raw_studies.json',
		queries: [
			{
				id: 'multiple_sclerosis_direct',
				label: 'Condition matches "multiple sclerosis"',
				params: { 'query.cond': '"multiple sclerosis"' }
			},
			{
				id: 'multiple_sclerosis_progressive',
				label: 'Progressive MS subtypes (PPMS, SPMS) — catches trials that may not say "multiple sclerosis"',
				params: {
					'query.cond':
						'"primary progressive multiple sclerosis" OR "secondary progressive multiple sclerosis" OR "relapsing remitting multiple sclerosis"'
				}
			}
		]
	},
	obesity: {
		default_out: 'src/lib/content/disease-insights/obesity/clinical_trials/raw_studies.json',
		queries: [
			{
				id: 'obesity_glp1_drugs',
				label: 'Obesity + GLP-1 receptor agonist drug names',
				params: {
					'query.cond': 'obesity',
					'query.intr':
						'semaglutide OR tirzepatide OR liraglutide OR dulaglutide OR retatrutide OR cagrilintide'
				}
			},
			{
				id: 'obesity_weight_management',
				label: 'Obesity + weight management interventional studies',
				params: {
					'query.cond': '"obesity" AND ("weight management" OR "weight loss")',
					'filter.advanced': 'AREA[StudyType]Interventional'
				}
			}
		]
	}
};

function parseArgs(argv) {
	const out = {};
	for (const a of argv.slice(2)) {
		if (!a.startsWith('--')) continue;
		const eq = a.indexOf('=');
		if (eq === -1) out[a.slice(2)] = true;
		else out[a.slice(2, eq)] = a.slice(eq + 1);
	}
	return out;
}

const fail = (msg) => {
	console.error(`[ERROR] ${msg}`);
	process.exit(1);
};

async function fileExists(p) {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

async function fetchQuery(queryDef) {
	const studies = [];
	let pageToken = null;
	let totalCount = null;
	let page = 0;

	while (true) {
		const url = new URL(BASE_URL);
		for (const [k, v] of Object.entries(queryDef.params)) url.searchParams.set(k, v);
		url.searchParams.set('format', 'json');
		url.searchParams.set('pageSize', String(PAGE_SIZE));
		url.searchParams.set('countTotal', 'true');
		if (pageToken) url.searchParams.set('pageToken', pageToken);

		const res = await fetch(url.toString(), {
			headers: { Accept: 'application/json', 'User-Agent': 'JourneyMapper/fetch-clinicaltrials' }
		});
		if (!res.ok) {
			const body = await res.text().catch(() => '');
			fail(`HTTP ${res.status} on "${queryDef.id}" page ${page + 1}: ${body.slice(0, 300)}`);
		}
		const data = await res.json();
		if (totalCount === null && typeof data.totalCount === 'number') totalCount = data.totalCount;

		const batch = Array.isArray(data.studies) ? data.studies : [];
		studies.push(...batch);
		page += 1;
		console.log(
			`  [${queryDef.id}] page ${page}: +${batch.length} (running total: ${studies.length})`
		);

		pageToken = data.nextPageToken ?? null;
		if (!pageToken) break;
	}

	return { studies, totalCount, pages: page };
}

function nctIdOf(study) {
	return study?.protocolSection?.identificationModule?.nctId ?? null;
}

async function main() {
	const args = parseArgs(process.argv);
	const indication = typeof args.indication === 'string' ? args.indication : 'lupus_nephritis';
	const set = QUERY_SETS[indication];
	if (!set) fail(`No query set defined for indication "${indication}". Edit QUERY_SETS to add one.`);

	const outPath = resolve(ROOT, typeof args.out === 'string' ? args.out : set.default_out);
	const force = args.force === true;
	const dryRun = args['dry-run'] === true;

	if (!dryRun && (await fileExists(outPath)) && !force) {
		fail(`Output already exists: ${outPath}\n        Re-run with --force to overwrite.`);
	}

	console.log(`Indication: ${indication}`);
	console.log(`Output:     ${dryRun ? '(dry-run, no write)' : outPath}`);
	console.log(`Queries:    ${set.queries.length}`);
	console.log('');

	const fetchedAt = new Date().toISOString();
	const queryResults = [];
	for (const q of set.queries) {
		console.log(`Query "${q.id}" — ${q.label}`);
		const r = await fetchQuery(q);
		console.log(
			`  -> ${r.studies.length} studies returned (API totalCount: ${r.totalCount}, ${r.pages} pages)`
		);
		if (typeof r.totalCount === 'number' && r.studies.length !== r.totalCount) {
			console.warn(
				`  [WARN] page sum (${r.studies.length}) != reported totalCount (${r.totalCount}) — pagination may have changed`
			);
		}
		queryResults.push({ ...q, totalCount: r.totalCount, studies: r.studies });
		console.log('');
	}

	// Dedupe by NCT id; record matched_queries[]
	const byNct = new Map();
	let missingNct = 0;
	for (const r of queryResults) {
		for (const s of r.studies) {
			const nct = nctIdOf(s);
			if (!nct) {
				missingNct += 1;
				continue;
			}
			if (!byNct.has(nct)) {
				byNct.set(nct, { study: s, matched_queries: [] });
			}
			byNct.get(nct).matched_queries.push(r.id);
		}
	}

	if (missingNct > 0) {
		console.warn(`[WARN] ${missingNct} study record(s) had no NCT id and were dropped.`);
	}
	if (byNct.size === 0) {
		fail('Zero studies after dedupe. Refusing to write.');
	}

	const studies = [...byNct.entries()]
		.map(([nct, { study, matched_queries }]) => ({
			nct_id: nct,
			matched_queries,
			raw: study
		}))
		.sort((a, b) => a.nct_id.localeCompare(b.nct_id));

	// --- Validate ----------------------------------------------------------
	for (const row of studies) {
		if (!row.raw?.protocolSection?.identificationModule?.nctId) {
			fail(`Study ${row.nct_id} missing protocolSection.identificationModule.nctId after dedupe.`);
		}
		if (row.matched_queries.length === 0) {
			fail(`Study ${row.nct_id} has empty matched_queries[] — should not be possible.`);
		}
	}

	const envelope = {
		schema_version: SCHEMA_VERSION,
		source: 'clinicaltrials.gov',
		api: 'v2',
		base_url: BASE_URL,
		indication_id: indication,
		queries: set.queries.map(({ id, label, params }) => ({ id, label, params })),
		fetched_at: fetchedAt,
		raw_total_count_by_query: Object.fromEntries(
			queryResults.map((r) => [r.id, r.totalCount])
		),
		raw_returned_count_by_query: Object.fromEntries(
			queryResults.map((r) => [r.id, r.studies.length])
		),
		deduped_count: studies.length,
		studies
	};

	console.log('--- Summary ---');
	for (const r of queryResults) {
		console.log(
			`  ${r.id.padEnd(28)} returned=${String(r.studies.length).padStart(5)}  totalCount=${r.totalCount}`
		);
	}
	console.log(`  ${'deduped'.padEnd(28)} = ${String(studies.length).padStart(5)}`);

	if (dryRun) {
		console.log('\nDry run — no file written.');
		return;
	}

	await mkdir(dirname(outPath), { recursive: true });
	await writeFile(outPath, JSON.stringify(envelope, null, 2) + '\n', 'utf8');
	console.log(`\nWrote ${studies.length} deduped studies → ${outPath}`);
}

main().catch((err) => {
	console.error(err?.stack ?? err);
	process.exit(1);
});
