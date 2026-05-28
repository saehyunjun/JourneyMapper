/**
 * import-interviews-as-fragments.mjs
 *
 * Phase 1 of the fragment-corpus rollout: projects existing interview-side
 * structural data into the cross-source fragment pool. Deterministic — no
 * AI judgement. Validates then writes; exit(1) and writes nothing on any
 * integrity failure. Idempotent — re-run after upstream changes to refresh.
 *
 * Inputs (read-only):
 *   src/lib/content/wctglpdemo-data/segments.json
 *   src/lib/content/wctglpdemo-data/interviews_structured.json
 *   src/lib/content/wctglpdemo-data/participant_profiles.json
 *
 * Outputs:
 *   src/lib/content/corpora/wct_glp1_2025q4/manifest.json
 *   src/lib/content/corpora/wct_glp1_2025q4/fragments/interview.json
 *
 * Decisions:
 *   - All participant segments become fragments. segments.json is already
 *     participant-only (interviewer turns live in question_map.json).
 *   - No length / quality filtering at ingest. Marginal segments (a "Yeah.")
 *     still carry analytic context downstream; filtering is a query-time
 *     concern, not an ingestion concern.
 *   - date_observed proxy: interview.ingested_at from interviews_structured.
 *     Tight upper bound, not exact field date. participant_09 and _10 lack
 *     ingested_at; they fall back to CORPUS_DATE_FALLBACK (oldest known
 *     ingest in the corpus) and are reported in the run summary.
 *   - Speaker attribution: participant_profiles.json is the authoritative
 *     source. Profile-declared values are evidence: 'stated' with no
 *     source_quote (the declaration lives in recruitment intake, not in
 *     the transcript — per the relaxed contract in corpora/types.ts).
 *     Empty strings on the profile = missing key on the fragment, NOT
 *     value: null. Same for participants without a profile entry.
 *   - age_range on the profile is 5-year-banded ('26-30', '41-45', etc.);
 *     SpeakerAttrs uses 10-year AgeBand. Mapping is by lower bound.
 *   - Country 'United States' → 'US' (ISO-3166 alpha-2).
 *   - role = 'patient' for all; participant_type 'individual' across the
 *     board (no caregiver interviews in this corpus).
 *   - License: 'consented_research'. redistribute_verbatim: true.
 *   - deid_rules_version: placeholder ('wct_glp1@v1') — the GLP-1 corpus
 *     was deidentified manually during transcription. Bump when a formal
 *     deid pipeline stands up.
 *
 * Run: node scripts/import-interviews-as-fragments.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SEGMENTS_FILE = 'src/lib/content/wctglpdemo-data/segments.json';
const STRUCTURED_FILE = 'src/lib/content/wctglpdemo-data/interviews_structured.json';
const PROFILES_FILE = 'src/lib/content/wctglpdemo-data/participant_profiles.json';

const CORPUS_ID = 'wct_glp1_2025q4';
const CORPUS_LABEL = 'WCT GLP-1 weight-maintenance interviews, 2025 Q4';
const INDICATION = 'obesity';
const INGESTER_VERSION = 'import-interviews-as-fragments@0.2';
const DEID_RULES_VERSION = 'wct_glp1@v1';
const DEFAULT_INTERVIEW_WEIGHT_BASE = 1.0;

/** Interviews to skip during ingestion. Surfaced 2026-05-26 when the
 *  propose-fragment-stages run flagged every participant_13 fragment as
 *  off-topic — the transcript is a Friedreich's-ataxia patient narrative
 *  mis-tagged with condition: 'GLP-1 weight maintenance' in
 *  interviews_structured.json. Belongs in a different corpus if/when an
 *  FA corpus stands up; for now it does not belong here. */
const EXCLUDED_INTERVIEWS = new Set(['participant_13']);

const OUT_DIR = `src/lib/content/corpora/${CORPUS_ID}`;
const OUT_MANIFEST = `${OUT_DIR}/manifest.json`;
const OUT_FRAGMENTS = `${OUT_DIR}/fragments/interview.json`;

// === Helpers ================================================================

function readJson(rel) {
	return JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));
}

function writeJson(rel, data) {
	const full = resolve(ROOT, rel);
	mkdirSync(dirname(full), { recursive: true });
	writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** Map a 5-year age_range string ('26-30', '41-45', …) to the 10-year AgeBand
 *  enum used in SpeakerAttrs. Empty / null / unparseable → null (caller omits
 *  the attribute entirely). */
function mapAgeBand(ageRange) {
	if (!ageRange) return null;
	const m = /^(\d+)-(\d+)$/.exec(ageRange);
	if (!m) return null;
	const lo = parseInt(m[1], 10);
	if (lo < 18) return '<18';
	if (lo < 26) return '18-25';
	if (lo < 36) return '26-35';
	if (lo < 46) return '36-45';
	if (lo < 56) return '46-55';
	if (lo < 66) return '56-65';
	return '65+';
}

function mapCountry(name) {
	if (!name) return null;
	if (name === 'United States') return 'US';
	return null; // unmapped countries become missing keys until we need them
}

function mapGender(g) {
	if (!g) return null;
	if (g === 'female' || g === 'male' || g === 'nonbinary' || g === 'other') return g;
	return null;
}

function stated(value) {
	return { value, evidence: 'stated' };
}

function buildSpeakerAttrs(profile, interview) {
	const attrs = {
		role: stated('patient')
	};

	const gender = mapGender(profile?.gender) ?? mapGender(interview?.participant_metadata?.gender);
	if (gender) attrs.gender = stated(gender);

	const ageBand = mapAgeBand(profile?.age_range);
	if (ageBand) attrs.age_band = stated(ageBand);

	const country = mapCountry(profile?.country);
	if (country) attrs.country = stated(country);

	return attrs;
}

// === Read inputs ============================================================

const segmentsDoc = readJson(SEGMENTS_FILE);
const structuredDoc = readJson(STRUCTURED_FILE);
const profilesDoc = readJson(PROFILES_FILE);

const segments = segmentsDoc.segments;
const interviewsById = Object.fromEntries(
	structuredDoc.interviews.map((iv) => [iv.interview_id, iv])
);
const profilesById = profilesDoc.profiles;

// Corpus-level date fallback: oldest known ingested_at across all interviews.
// Used for fragments whose interview lacks ingested_at (participant_09, _10
// at the time of writing).
const knownIngestDates = structuredDoc.interviews
	.map((iv) => iv.ingested_at)
	.filter(Boolean)
	.sort();
if (knownIngestDates.length === 0) {
	console.error('x No ingested_at on any interview — cannot determine corpus fallback date.');
	process.exit(1);
}
const CORPUS_DATE_FALLBACK = knownIngestDates[0];

// === Project ================================================================

const errors = [];
const fragments = [];
const perInterview = {};
let fellBackOnDate = 0;
let excludedSegments = 0;

for (const seg of segments) {
	if (EXCLUDED_INTERVIEWS.has(seg.interview_id)) {
		excludedSegments += 1;
		continue;
	}
	if (seg.speaker !== 'participant') {
		errors.push(`segment ${seg.segment_id} has speaker=${seg.speaker}; expected 'participant'`);
		continue;
	}
	if (typeof seg.char_start !== 'number' || typeof seg.char_end !== 'number') {
		errors.push(`segment ${seg.segment_id} missing char offsets`);
		continue;
	}
	if (seg.char_end <= seg.char_start) {
		errors.push(`segment ${seg.segment_id} has char_end <= char_start`);
		continue;
	}
	if (!seg.text || seg.text.length === 0) {
		errors.push(`segment ${seg.segment_id} has empty text`);
		continue;
	}

	const interview = interviewsById[seg.interview_id];
	if (!interview) {
		errors.push(`segment ${seg.segment_id} references unknown interview_id ${seg.interview_id}`);
		continue;
	}
	const profile = profilesById[seg.interview_id]; // may be undefined

	let dateObserved = interview.ingested_at;
	if (!dateObserved) {
		dateObserved = CORPUS_DATE_FALLBACK;
		fellBackOnDate += 1;
	}

	const fragment = {
		id: `iv-${seg.segment_id}`,
		corpus_id: CORPUS_ID,
		indications: [INDICATION],

		content_source: 'interview',
		source_ref: {
			kind: 'interview',
			interview_id: seg.interview_id,
			segment_id: seg.segment_id,
			char_start: seg.char_start,
			char_end: seg.char_end
		},

		text: seg.text,
		lang: 'en',

		date_observed: dateObserved,
		date_referenced: null,

		speaker_attrs: buildSpeakerAttrs(profile, interview),

		weight_base: DEFAULT_INTERVIEW_WEIGHT_BASE,
		weight_signals: {},

		license: 'consented_research',
		redistribute_verbatim: true,

		deidentified_at: dateObserved,
		deidentifier_version: 'manual-transcription@v1',
		deid_rules_version: DEID_RULES_VERSION,
		ingested_at: new Date().toISOString(),
		ingester_version: INGESTER_VERSION
	};

	fragments.push(fragment);
	perInterview[seg.interview_id] = (perInterview[seg.interview_id] ?? 0) + 1;
}

// === Validate ===============================================================

const seenIds = new Set();
for (const f of fragments) {
	if (seenIds.has(f.id)) errors.push(`duplicate fragment id: ${f.id}`);
	seenIds.add(f.id);
}

if (errors.length > 0) {
	console.error(`x Validation failed with ${errors.length} error(s). Output not written.`);
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
}

// === Write ==================================================================

const now = new Date().toISOString();

// Preserve created_at if a prior manifest exists.
let createdAt = now;
const manifestPath = resolve(ROOT, OUT_MANIFEST);
if (existsSync(manifestPath)) {
	try {
		const prior = JSON.parse(readFileSync(manifestPath, 'utf8'));
		if (prior?.created_at) createdAt = prior.created_at;
	} catch {
		// Corrupt prior manifest is non-fatal — we'll overwrite cleanly.
	}
}

const manifest = {
	id: CORPUS_ID,
	label: CORPUS_LABEL,
	indications: [INDICATION],
	created_at: createdAt,
	updated_at: now,
	partitions: [
		{
			content_source: 'interview',
			fragment_count: fragments.length,
			ingester_version: INGESTER_VERSION,
			last_ingested_at: now
		}
	]
};

const fragmentsDoc = {
	meta: {
		schema_version: '1.0',
		corpus_id: CORPUS_ID,
		content_source: 'interview',
		generated_at: now,
		generator: 'scripts/import-interviews-as-fragments.mjs',
		ingester_version: INGESTER_VERSION,
		sources: [SEGMENTS_FILE, STRUCTURED_FILE, PROFILES_FILE],
		fragment_count: fragments.length,
		notes: [
			'One fragment per participant segment from segments.json.',
			'Speaker attrs sourced from participant_profiles.json (authoritative) with interview metadata as fallback.',
			'date_observed proxied from interviews_structured.json#ingested_at; corpus min used as fallback where missing.'
		]
	},
	fragments
};

writeJson(OUT_MANIFEST, manifest);
writeJson(OUT_FRAGMENTS, fragmentsDoc);

// === Report =================================================================

console.log(`Wrote ${OUT_MANIFEST}`);
console.log(`Wrote ${OUT_FRAGMENTS} (${fragments.length} fragments)`);
for (const [id, count] of Object.entries(perInterview).sort()) {
	const profile = profilesById[id];
	const hasProfile = profile ? 'profile' : 'no-profile';
	const hasDate = interviewsById[id].ingested_at ? 'dated' : 'date-fallback';
	console.log(`  ${id}: ${count} fragments  [${hasProfile}, ${hasDate}]`);
}
if (fellBackOnDate > 0) {
	console.log(`  ${fellBackOnDate} fragment(s) used corpus date fallback (${CORPUS_DATE_FALLBACK})`);
}
if (excludedSegments > 0) {
	console.log(
		`  excluded ${excludedSegments} segment(s) from interviews: ${[...EXCLUDED_INTERVIEWS].join(', ')}`
	);
}
