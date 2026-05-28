/**
 * normalize-clinicaltrials.mjs
 *
 * Deterministic flatten of raw_studies.json into three derived files:
 *
 *   studies_normalized.json     — one row per NCT id, flat fields
 *   sponsors_observed.json      — sponsor occurrence table (lead + collab)
 *   interventions_observed.json — intervention occurrence table
 *
 * The "observed" files are seeds for a future registry-merge step. They are
 * intentionally NOT joined against drugs.json / sponsors.json / mechanisms_of_action.json
 * — that mapping is judgment work, kept separate so this script stays pure.
 *
 * Activity filter (applied after flatten, before observed-table construction):
 *   A study is kept if either
 *     (a) overall_status ∈ ACTIVE_STATUSES, or
 *     (b) last_update_post.iso8601 ≥ (raw.fetched_at − RECENT_WINDOW_YEARS).
 *   Rationale: the all-time CT.gov corpus is dominated by COMPLETED + UNKNOWN
 *   trials (many abandoned). Downstream analytics — sponsors, interventions,
 *   counts — should reflect the current landscape, not a decade of inactive
 *   programs. The cutoff is anchored on the envelope's fetched_at so the
 *   normalize step stays deterministic given a fixed input.
 *   Pass --no-activity-filter to disable.
 *
 * Normalization rules:
 *   - Dates: preserve YYYY-MM-DD or YYYY-MM verbatim under iso8601; flag fidelity.
 *   - Ages: parse "18 Years" / "6 Months" etc. into years (float). Null when N/A or absent.
 *   - Intervention name_key: lowercased + whitespace-collapsed name. Conservative —
 *     does NOT strip parentheticals (those often carry dose info, not synonyms).
 *   - Locations: keep facility/city/state/zip/country/status + geoPoint (lat/lon).
 *
 * Run:
 *   node scripts/normalize-clinicaltrials.mjs
 *   node scripts/normalize-clinicaltrials.mjs --indication=lupus_nephritis
 *   node scripts/normalize-clinicaltrials.mjs --force
 *   node scripts/normalize-clinicaltrials.mjs --no-activity-filter
 *   node scripts/normalize-clinicaltrials.mjs --in=path/to/raw_studies.json --out-dir=path/
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SCHEMA_VERSION = '1.0';

const ACTIVE_STATUSES = new Set([
	'RECRUITING',
	'ACTIVE_NOT_RECRUITING',
	'NOT_YET_RECRUITING',
	'ENROLLING_BY_INVITATION'
]);
const RECENT_WINDOW_YEARS = 3;

const DEFAULT_PATHS = {
	lupus_nephritis: {
		in: 'src/lib/content/disease-insights/lupus-nephritis/clinical_trials/raw_studies.json',
		out_dir: 'src/lib/content/disease-insights/lupus-nephritis/clinical_trials'
	},
	obesity: {
		in: 'src/lib/content/disease-insights/obesity/clinical_trials/raw_studies.json',
		out_dir: 'src/lib/content/disease-insights/obesity/clinical_trials'
	},
	multiple_sclerosis: {
		in: 'src/lib/content/disease-insights/multiple-sclerosis/clinical_trials/raw_studies.json',
		out_dir: 'src/lib/content/disease-insights/multiple-sclerosis/clinical_trials'
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

// ----------------------------------------------------------------------------
// Normalization helpers
// ----------------------------------------------------------------------------

function normalizeWhitespace(s) {
	return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function nameKey(name) {
	return normalizeWhitespace(name).toLowerCase();
}

function ageToYears(s) {
	if (!s || typeof s !== 'string') return null;
	const trimmed = s.trim();
	if (!trimmed || trimmed.toUpperCase() === 'N/A') return null;
	const m = trimmed.match(/^(\d+(?:\.\d+)?)\s*(year|years|month|months|week|weeks|day|days|hour|hours|minute|minutes)\b/i);
	if (!m) return null;
	const n = parseFloat(m[1]);
	const unit = m[2].toLowerCase();
	if (unit.startsWith('year')) return n;
	if (unit.startsWith('month')) return n / 12;
	if (unit.startsWith('week')) return n / 52;
	if (unit.startsWith('day')) return n / 365;
	if (unit.startsWith('hour')) return n / (365 * 24);
	if (unit.startsWith('minute')) return n / (365 * 24 * 60);
	return null;
}

function dateStruct(d) {
	if (!d || typeof d !== 'object') return null;
	const raw = typeof d.date === 'string' ? d.date : null;
	if (!raw) return null;
	const partial = !/^\d{4}-\d{2}-\d{2}$/.test(raw);
	return {
		iso8601: raw,
		partial,
		type: d.type ?? null
	};
}

function normSponsor(s) {
	if (!s || typeof s !== 'object') return null;
	const name = normalizeWhitespace(s.name);
	if (!name) return null;
	return { name, class: s.class ?? null };
}

function normLocation(loc) {
	if (!loc || typeof loc !== 'object') return null;
	const facility = normalizeWhitespace(loc.facility);
	const country = normalizeWhitespace(loc.country) || null;
	if (!facility && !country) return null;
	const lat = loc.geoPoint?.lat;
	const lon = loc.geoPoint?.lon;
	return {
		facility: facility || null,
		city: normalizeWhitespace(loc.city) || null,
		state: normalizeWhitespace(loc.state) || null,
		zip: normalizeWhitespace(loc.zip) || null,
		country,
		status: loc.status ?? null,
		lat: typeof lat === 'number' ? lat : null,
		lon: typeof lon === 'number' ? lon : null
	};
}

/**
 * Return the YYYY-MM string `years` years before `fetchedAtIso`, or null if the
 * input is unparseable. We compare on the YYYY-MM prefix below so partial CT.gov
 * dates ("2024-03") and full dates ("2024-03-15") both sort correctly against
 * the cutoff.
 */
function recentCutoffYearMonth(fetchedAtIso, years) {
	if (typeof fetchedAtIso !== 'string') return null;
	const d = new Date(fetchedAtIso);
	if (Number.isNaN(d.getTime())) return null;
	d.setUTCFullYear(d.getUTCFullYear() - years);
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, '0');
	return `${y}-${m}`;
}

function isActiveOrRecent(row, cutoffYM) {
	if (ACTIVE_STATUSES.has(row.overall_status)) return true;
	if (!cutoffYM) return false;
	const lastUpd = row.dates?.last_update_post?.iso8601;
	if (typeof lastUpd !== 'string' || lastUpd.length < 7) return false;
	return lastUpd.slice(0, 7) >= cutoffYM;
}

function normIntervention(iv) {
	if (!iv || typeof iv !== 'object') return null;
	const name = normalizeWhitespace(iv.name);
	if (!name) return null;
	return {
		type: iv.type ?? null,
		name,
		name_key: nameKey(name),
		description: normalizeWhitespace(iv.description) || null
	};
}

// ----------------------------------------------------------------------------
// Per-study flatten
// ----------------------------------------------------------------------------

function flattenStudy(row) {
	const ps = row.raw?.protocolSection;
	if (!ps) return null;
	const id = ps.identificationModule ?? {};
	const status = ps.statusModule ?? {};
	const design = ps.designModule ?? {};
	const sponsorCollab = ps.sponsorCollaboratorsModule ?? {};
	const conds = ps.conditionsModule ?? {};
	const arms = ps.armsInterventionsModule ?? {};
	const elig = ps.eligibilityModule ?? {};
	const locs = ps.contactsLocationsModule ?? {};

	return {
		nct_id: id.nctId,
		matched_queries: row.matched_queries,
		brief_title: normalizeWhitespace(id.briefTitle) || null,
		official_title: normalizeWhitespace(id.officialTitle) || null,
		acronym: normalizeWhitespace(id.acronym) || null,
		overall_status: status.overallStatus ?? null,
		why_stopped: normalizeWhitespace(status.whyStopped) || null,
		dates: {
			start: dateStruct(status.startDateStruct),
			primary_completion: dateStruct(status.primaryCompletionDateStruct),
			completion: dateStruct(status.completionDateStruct),
			study_first_post: dateStruct(status.studyFirstPostDateStruct),
			last_update_post: dateStruct(status.lastUpdatePostDateStruct)
		},
		study_type: design.studyType ?? null,
		phases: Array.isArray(design.phases) ? design.phases : [],
		enrollment: design.enrollmentInfo
			? {
					count: typeof design.enrollmentInfo.count === 'number' ? design.enrollmentInfo.count : null,
					type: design.enrollmentInfo.type ?? null
				}
			: null,
		lead_sponsor: normSponsor(sponsorCollab.leadSponsor),
		collaborators: Array.isArray(sponsorCollab.collaborators)
			? sponsorCollab.collaborators.map(normSponsor).filter(Boolean)
			: [],
		conditions: Array.isArray(conds.conditions)
			? conds.conditions.map(normalizeWhitespace).filter(Boolean)
			: [],
		condition_keywords: Array.isArray(conds.keywords)
			? conds.keywords.map(normalizeWhitespace).filter(Boolean)
			: [],
		interventions: Array.isArray(arms.interventions)
			? arms.interventions.map(normIntervention).filter(Boolean)
			: [],
		locations: Array.isArray(locs.locations)
			? locs.locations.map(normLocation).filter(Boolean)
			: [],
		eligibility: {
			criteria_text: typeof elig.eligibilityCriteria === 'string' ? elig.eligibilityCriteria : null,
			sex: elig.sex ?? null,
			min_age_years: ageToYears(elig.minimumAge),
			max_age_years: ageToYears(elig.maximumAge),
			std_ages: Array.isArray(elig.stdAges) ? elig.stdAges : [],
			healthy_volunteers: typeof elig.healthyVolunteers === 'boolean' ? elig.healthyVolunteers : null,
			study_population: normalizeWhitespace(elig.studyPopulation) || null,
			sampling_method: elig.samplingMethod ?? null
		}
	};
}

// ----------------------------------------------------------------------------
// Observed-entity tables
// ----------------------------------------------------------------------------

function buildSponsorsObserved(rows) {
	const m = new Map();
	const touch = (sponsor, nct, role) => {
		if (!sponsor?.name) return;
		const k = sponsor.name;
		if (!m.has(k))
			m.set(k, {
				name: sponsor.name,
				classes: new Set(),
				lead_count: 0,
				collaborator_count: 0,
				nct_ids: new Set()
			});
		const e = m.get(k);
		if (sponsor.class) e.classes.add(sponsor.class);
		e[`${role}_count`] += 1;
		e.nct_ids.add(nct);
	};
	for (const r of rows) {
		if (r.lead_sponsor) touch(r.lead_sponsor, r.nct_id, 'lead');
		for (const c of r.collaborators) touch(c, r.nct_id, 'collaborator');
	}
	return [...m.values()]
		.map((e) => ({
			name: e.name,
			classes: [...e.classes].sort(),
			lead_count: e.lead_count,
			collaborator_count: e.collaborator_count,
			total_count: e.lead_count + e.collaborator_count,
			nct_ids: [...e.nct_ids].sort()
		}))
		.sort((a, b) =>
			b.total_count - a.total_count || a.name.localeCompare(b.name)
		);
}

function buildInterventionsObserved(rows) {
	const m = new Map();
	for (const r of rows) {
		for (const iv of r.interventions) {
			const k = iv.name_key;
			if (!m.has(k))
				m.set(k, {
					name_key: k,
					name_variants: new Set(),
					types: new Set(),
					count: 0,
					nct_ids: new Set()
				});
			const e = m.get(k);
			e.name_variants.add(iv.name);
			if (iv.type) e.types.add(iv.type);
			e.count += 1;
			e.nct_ids.add(r.nct_id);
		}
	}
	return [...m.values()]
		.map((e) => ({
			name_key: e.name_key,
			name_variants: [...e.name_variants].sort(),
			types: [...e.types].sort(),
			count: e.count,
			nct_id_count: e.nct_ids.size,
			nct_ids: [...e.nct_ids].sort()
		}))
		.sort((a, b) => b.count - a.count || a.name_key.localeCompare(b.name_key));
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function main() {
	const args = parseArgs(process.argv);
	const indication = typeof args.indication === 'string' ? args.indication : 'lupus_nephritis';
	const def = DEFAULT_PATHS[indication];
	if (!def) fail(`No default paths for "${indication}". Add to DEFAULT_PATHS or pass --in / --out-dir.`);

	const inPath = resolve(ROOT, typeof args.in === 'string' ? args.in : def.in);
	const outDir = resolve(ROOT, typeof args['out-dir'] === 'string' ? args['out-dir'] : def.out_dir);
	const force = args.force === true;

	const outStudies = join(outDir, 'studies_normalized.json');
	const outSponsors = join(outDir, 'sponsors_observed.json');
	const outIvs = join(outDir, 'interventions_observed.json');

	for (const p of [outStudies, outSponsors, outIvs]) {
		if ((await fileExists(p)) && !force) {
			fail(`Output already exists: ${p}\n        Re-run with --force to overwrite.`);
		}
	}

	if (!(await fileExists(inPath))) fail(`Input not found: ${inPath}`);
	const raw = JSON.parse(await readFile(inPath, 'utf8'));
	if (!Array.isArray(raw.studies)) fail('Input has no studies[] array.');
	console.log(`Read ${raw.studies.length} studies from ${inPath}`);

	const allRows = raw.studies.map(flattenStudy).filter(Boolean);

	// ---- Validation (run against the full flattened set) -----------------
	if (allRows.length !== raw.studies.length) {
		fail(`Lost ${raw.studies.length - allRows.length} studies during flatten (missing protocolSection?).`);
	}
	const ids = new Set();
	for (const r of allRows) {
		if (!r.nct_id || !/^NCT\d+$/.test(r.nct_id)) fail(`Bad nct_id: ${r.nct_id}`);
		if (ids.has(r.nct_id)) fail(`Duplicate nct_id after flatten: ${r.nct_id}`);
		ids.add(r.nct_id);
	}

	// ---- Activity filter -------------------------------------------------
	const filterEnabled = args['no-activity-filter'] !== true;
	const cutoffYM = filterEnabled ? recentCutoffYearMonth(raw.fetched_at, RECENT_WINDOW_YEARS) : null;
	if (filterEnabled && !cutoffYM) {
		fail(`Activity filter requested but raw.fetched_at ("${raw.fetched_at}") is not a parseable ISO timestamp.`);
	}
	const rows = filterEnabled ? allRows.filter((r) => isActiveOrRecent(r, cutoffYM)) : allRows;
	const filtered_out_count = allRows.length - rows.length;
	if (filterEnabled) {
		console.log(
			`Activity filter: kept ${rows.length}/${allRows.length} (dropped ${filtered_out_count}); cutoff=${cutoffYM}`
		);
	} else {
		console.log('Activity filter: DISABLED (--no-activity-filter)');
	}
	if (rows.length === 0) fail('Activity filter eliminated every study. Refusing to write empty output.');

	for (const r of rows) {
		if (!r.lead_sponsor) console.warn(`[WARN] ${r.nct_id} has no lead sponsor`);
		if (!r.eligibility.criteria_text) console.warn(`[WARN] ${r.nct_id} has no eligibility criteria text`);
	}

	const sponsors = buildSponsorsObserved(rows);
	const ivs = buildInterventionsObserved(rows);

	// Sanity: every NCT in observed tables exists in rows
	const ridSet = new Set(rows.map((r) => r.nct_id));
	for (const s of sponsors) {
		for (const n of s.nct_ids) if (!ridSet.has(n)) fail(`sponsors_observed references unknown nct ${n}`);
	}
	for (const iv of ivs) {
		for (const n of iv.nct_ids) if (!ridSet.has(n)) fail(`interventions_observed references unknown nct ${n}`);
	}

	// ---- Write -----------------------------------------------------------
	const generated_at = new Date().toISOString();
	const provenance = {
		source_raw_file: inPath.startsWith(ROOT) ? inPath.slice(ROOT.length + 1) : inPath,
		source_fetched_at: raw.fetched_at ?? null,
		source_dataset: raw.indication_id ?? null,
		schema_version: SCHEMA_VERSION,
		generated_at,
		activity_filter: filterEnabled
			? {
					rule: 'overall_status ∈ active OR last_update_post ≥ fetched_at − window',
					active_statuses: [...ACTIVE_STATUSES].sort(),
					window_years: RECENT_WINDOW_YEARS,
					recent_cutoff: cutoffYM,
					source_total: allRows.length,
					kept: rows.length,
					dropped: filtered_out_count
				}
			: null
	};

	await mkdir(outDir, { recursive: true });

	await writeFile(
		outStudies,
		JSON.stringify({ ...provenance, count: rows.length, studies: rows.sort((a, b) => a.nct_id.localeCompare(b.nct_id)) }, null, 2) + '\n',
		'utf8'
	);
	await writeFile(
		outSponsors,
		JSON.stringify({ ...provenance, count: sponsors.length, sponsors }, null, 2) + '\n',
		'utf8'
	);
	await writeFile(
		outIvs,
		JSON.stringify({ ...provenance, count: ivs.length, interventions: ivs }, null, 2) + '\n',
		'utf8'
	);

	// ---- Report ----------------------------------------------------------
	console.log('');
	console.log(`Wrote ${rows.length.toString().padStart(5)} studies      → ${outStudies}`);
	console.log(`Wrote ${sponsors.length.toString().padStart(5)} sponsors     → ${outSponsors}`);
	console.log(`Wrote ${ivs.length.toString().padStart(5)} interventions → ${outIvs}`);
	console.log('');
	console.log('Coverage snapshot:');
	const withCriteria = rows.filter((r) => r.eligibility.criteria_text).length;
	const withGeo = rows.filter((r) => r.locations.some((l) => l.lat != null)).length;
	const withDates = rows.filter((r) => r.dates.start).length;
	const withInterventions = rows.filter((r) => r.interventions.length > 0).length;
	console.log(`  eligibility criteria text:  ${withCriteria}/${rows.length}`);
	console.log(`  ≥1 geocoded location:       ${withGeo}/${rows.length}`);
	console.log(`  start date present:         ${withDates}/${rows.length}`);
	console.log(`  ≥1 intervention:            ${withInterventions}/${rows.length}`);
}

main().catch((err) => {
	console.error(err?.stack ?? err);
	process.exit(1);
});
