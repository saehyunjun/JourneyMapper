/**
 * propose-eligibility-barriers.mjs
 *
 * LLM-judgment step: read clinical_trials/studies_normalized.json for an
 * indication and ask Claude to extract structured eligibility constraints
 * from each trial's free-text eligibility criteria. Output is the seed for
 * a downstream "eligibility → patient barrier" mapping step (separate script).
 *
 * Why split this out:
 *   - This script's job is pure extraction from authoritative protocol text.
 *     It does not (yet) reason about patient sentiment or barrier mapping.
 *   - Constraint categories use a stable enum (kidney_function, washout, etc.)
 *     so the next step can join against codebook subthemes / cluster ids.
 *   - Every constraint carries a verbatim quote from criteria_text. The script
 *     validates each quote IS a substring of the source — a hard guard against
 *     fabricated extractions. Batches that fail validation are NOT written.
 *
 * Run:
 *   node scripts/propose-eligibility-barriers.mjs                          # lupus_nephritis, all NCTs
 *   node scripts/propose-eligibility-barriers.mjs --indication=obesity
 *   node scripts/propose-eligibility-barriers.mjs --limit=5                # smoke test (first 5 NCTs)
 *   node scripts/propose-eligibility-barriers.mjs --only=NCT000...,NCT...  # specific NCTs
 *   node scripts/propose-eligibility-barriers.mjs --batch-size=12          # default 10
 *   node scripts/propose-eligibility-barriers.mjs --force                  # re-propose everything
 *
 * Requires ANTHROPIC_API_KEY. If a stale shell key shadows .env, prefix with
 * `env -u ANTHROPIC_API_KEY`.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const MODEL = 'claude-opus-4-7';
const GENERATOR_VERSION = 'propose-eligibility-barriers@0.1';
const SCHEMA_VERSION = '1.0';

if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));
if (!process.env.ANTHROPIC_API_KEY) {
	console.error('x ANTHROPIC_API_KEY is not set.');
	console.error('  Add it to JourneyMapper/.env, or export it. If a stale shell key shadows .env,');
	console.error('  prefix the command with `env -u ANTHROPIC_API_KEY`.');
	process.exit(1);
}

// === CLI ===================================================================

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

const args = parseArgs(process.argv);
const indication = typeof args.indication === 'string' ? args.indication : 'lupus_nephritis';
const force = args.force === true;
const limit = args.limit ? Number(args.limit) : null;
const onlyList = typeof args.only === 'string' ? args.only.split(',').map((s) => s.trim()) : null;
const batchSize = args['batch-size'] ? Math.max(1, Number(args['batch-size'])) : 10;

const INDICATION_DIRS = {
	lupus_nephritis: 'src/lib/content/disease-insights/lupus-nephritis/clinical_trials',
	obesity: 'src/lib/content/disease-insights/obesity/clinical_trials'
};
const indicationDir = INDICATION_DIRS[indication];
if (!indicationDir) {
	console.error(`x No clinical_trials dir registered for indication "${indication}". Add to INDICATION_DIRS.`);
	process.exit(1);
}

const inPath = resolve(ROOT, indicationDir, 'studies_normalized.json');
const outPath = resolve(ROOT, indicationDir, 'eligibility_constraints.proposed.json');

if (!existsSync(inPath)) {
	console.error(`x Input not found: ${inPath}`);
	console.error('  Run scripts/normalize-clinicaltrials.mjs first.');
	process.exit(1);
}

const normalized = JSON.parse(readFileSync(inPath, 'utf8'));
if (!Array.isArray(normalized.studies)) {
	console.error('x studies_normalized.json missing studies[]');
	process.exit(1);
}

// === Build the target list =================================================

let candidates = normalized.studies
	.filter((s) => s.eligibility?.criteria_text && s.eligibility.criteria_text.trim().length > 0)
	.sort((a, b) => a.nct_id.localeCompare(b.nct_id));

if (onlyList) {
	const set = new Set(onlyList);
	candidates = candidates.filter((s) => set.has(s.nct_id));
}

if (limit && limit > 0) candidates = candidates.slice(0, limit);

if (candidates.length === 0) {
	console.error('x No studies with non-empty eligibility criteria match the filters.');
	process.exit(1);
}

// === Load existing proposals (for resumability) ============================

let existing = { meta: {}, annotations: {} };
if (existsSync(outPath)) {
	existing = JSON.parse(readFileSync(outPath, 'utf8'));
}
const existingAnnotations = existing.annotations ?? {};
const alreadyDoneIds = new Set(Object.keys(existingAnnotations));

const targets = force ? candidates : candidates.filter((s) => !alreadyDoneIds.has(s.nct_id));

console.log(`Indication: ${indication}`);
console.log(`Input:      ${inPath}`);
console.log(`Output:     ${outPath}`);
console.log(`Candidates: ${candidates.length}`);
console.log(`Already done: ${alreadyDoneIds.size}`);
console.log(`To propose: ${targets.length}${force ? ' (--force)' : ''}`);
console.log(`Batch size: ${batchSize}`);

if (targets.length === 0) {
	console.log('Nothing to do. Use --force to re-propose, or --only=… to target specific NCTs.');
	process.exit(0);
}

// === Schema ================================================================

const CATEGORY_ENUM = [
	'kidney_function',
	'kidney_biopsy',
	'disease_activity',
	'lab_threshold',
	'prior_therapy_required',
	'prior_therapy_excluded',
	'washout_required',
	'comorbidity_excluded',
	'pregnancy_contraception',
	'weight_bmi',
	'geography_site_access',
	'age_specific',
	'language_literacy',
	'concomitant_medication',
	'other'
];

const COMPARATOR_ENUM = ['<', '<=', '>', '>=', '=', '!=', 'range', 'present', 'absent', ''];

const constraintSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		category: { type: 'string', enum: CATEGORY_ENUM },
		direction: { type: 'string', enum: ['include', 'exclude'] },
		measure: { type: 'string' },
		comparator: { type: 'string', enum: COMPARATOR_ENUM },
		value: { type: 'string' },
		unit: { type: 'string' },
		quote: { type: 'string' },
		note: { type: 'string' }
	},
	required: ['category', 'direction', 'measure', 'comparator', 'value', 'unit', 'quote', 'note']
};

const studyAnnotationSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		nct_id: { type: 'string' },
		constraints: { type: 'array', items: constraintSchema },
		confidence: { type: 'number' },
		note: { type: 'string' }
	},
	required: ['nct_id', 'constraints', 'confidence', 'note']
};

const responseSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		studies: { type: 'array', items: studyAnnotationSchema }
	},
	required: ['studies']
};

// === System prompt =========================================================

const SYSTEM_PROMPT = `You are extracting structured eligibility constraints from ClinicalTrials.gov trial protocols, for cross-referencing against patient-experience corpora. Be precise and conservative.

For each study, read the eligibility criteria text and extract every meaningful clinical constraint as a separate { category, direction, measure, comparator, value, unit, quote, note } row.

CATEGORIES — pick exactly one per row:
- kidney_function: renal-function thresholds (eGFR, creatinine clearance, serum creatinine, dialysis status).
- kidney_biopsy: kidney biopsy required, biopsy class/subclass (ISN/RPS class III/IV/V), biopsy recency window.
- disease_activity: disease-activity indices (SLEDAI, BILAG, SLE Disease Activity Index), serologic markers (anti-dsDNA, complement C3/C4, anti-Smith), proteinuria (UPCR, 24h protein), or analogous activity measures in non-LN diseases.
- lab_threshold: other labs — CBC (Hgb/Hct/platelets/neutrophils), liver enzymes, immunoglobulin levels, etc.
- prior_therapy_required: must have failed / received a specific prior therapy.
- prior_therapy_excluded: must NOT have received a specific prior therapy.
- washout_required: required wait time since a prior drug, biologic, vaccine, or procedure.
- comorbidity_excluded: comorbidities that exclude — active infection (TB, HIV, HBV, HCV), malignancy, severe cardiac/pulmonary disease, neuropsychiatric SLE, etc.
- pregnancy_contraception: pregnancy testing, contraception requirements, breastfeeding exclusion.
- weight_bmi: BMI bounds, weight bounds.
- geography_site_access: must reside in / travel to specific country/region, must be at a specific site type.
- age_specific: an age-related criterion BEYOND the simple min/max age bounds already captured (e.g. "pediatric subset only", "post-menopausal women only").
- language_literacy: must speak / read a specific language; ability to provide informed consent.
- concomitant_medication: medications required to be on stable dose, must be tapered/stopped, or are forbidden during the study.
- other: use sparingly — only when none of the above fit.

DIRECTION — one per row:
- include: an inclusion criterion (must meet this to be eligible).
- exclude: an exclusion criterion (will be excluded if this applies).

FIELD GUIDANCE:
- measure: a short, normalized name of the variable being constrained. Examples: "eGFR", "serum creatinine", "UPCR", "biopsy class III/IV", "anti-dsDNA", "SLEDAI", "active hepatitis B infection", "rituximab", "pregnancy", "BMI".
- comparator: one of <, <=, >, >=, =, !=, range, present, absent, "" (empty). Use "" when the constraint is descriptive with no comparator.
- value: numeric ("30"), range ("20-40"), duration ("12 weeks"), or descriptive ("class III/IV/V"). "" when not applicable. For pure presence/absence, set measure to the entity, comparator to "present" or "absent", value="".
- unit: SI unit when applicable ("ml/min/1.73m2", "mg/dL", "mg/g", "g/day", "weeks", "kg/m2"). "" when N/A.
- quote: a VERBATIM substring of the criteria_text that supports this row. Keep it short but intact (preserve original capitalization, punctuation, line breaks). REQUIRED. NEVER fabricate or paraphrase — if you cannot point to an exact substring, do not emit the row.
- note: short reviewer note, or "" if none. Use for ambiguity ("threshold expressed as 'preserved renal function' without numeric bound"), for OR-alternative branches, or for context that didn't fit the schema.

GUIDANCE:
- Decompose compound criteria. "eGFR > 30 ml/min/1.73m2 AND UPCR > 1 g/g" → two rows (kidney_function + disease_activity).
- Skip purely demographic criteria (simple sex / standard age bounds / healthy-volunteer flag) — those are captured elsewhere at the protocol level.
- Skip purely procedural criteria (signed informed consent, attending all visits) unless they encode a real access barrier (e.g. "must be able to travel to the study site monthly").
- For washouts: category="washout_required", measure=<prior drug or class>, comparator=">=", value=<N>, unit=<weeks|days|months>, direction=usually exclude.
- For prior-therapy requirements: prior_therapy_required, measure=<drug or regimen>, comparator=">=", value=<N>, unit=<courses|cycles|months>, direction=include.
- confidence (per-study, 0.0–1.0) reflects how confidently you extracted the structured constraints. Lower it when criteria text is sparse, boilerplate, or heavily abbreviated.
- The top-level "note" is for study-level context only ("criteria text atypically short", "criteria appears to mix protocol amendments", "").

Return a JSON object: { "studies": [ ...one entry per nct_id, in the same order... ] }.`;

// === Run ====================================================================

const client = new Anthropic();
const annotations = { ...existingAnnotations };
let totalConstraints = 0;
let batchIndex = 0;
const totalBatches = Math.ceil(targets.length / batchSize);

function batchOf(i) {
	return targets.slice(i, i + batchSize);
}

function quoteIsSubstring(quote, source) {
	if (!quote || !source) return false;
	if (source.includes(quote)) return true;
	// Allow whitespace flexibility: collapse runs of whitespace on both sides.
	const norm = (s) => s.replace(/\s+/g, ' ').trim();
	return norm(source).includes(norm(quote));
}

for (let i = 0; i < targets.length; i += batchSize) {
	batchIndex += 1;
	const batch = batchOf(i);
	const batchIds = batch.map((s) => s.nct_id);

	console.log(`\n[${batchIndex}/${totalBatches}] ${batchIds.length} studies: ${batchIds.join(', ')}`);

	const payload = batch.map((s) => ({
		nct_id: s.nct_id,
		condition_summary: (s.conditions ?? []).slice(0, 4).join('; '),
		criteria_text: s.eligibility.criteria_text
	}));

	const stream = client.messages.stream({
		model: MODEL,
		max_tokens: 32000,
		thinking: { type: 'adaptive' },
		output_config: { effort: 'high', format: { type: 'json_schema', schema: responseSchema } },
		system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
		messages: [
			{
				role: 'user',
				content:
					`Extract structured eligibility constraints for the following ${batch.length} studies. ` +
					`Return one annotation per nct_id, in the same order. ` +
					`Decompose compound criteria into multiple rows. Every "quote" MUST be a verbatim substring of that study's criteria_text.\n\n` +
					JSON.stringify(payload, null, 2)
			}
		]
	});

	const msg = await stream.finalMessage();
	const u = msg.usage;
	console.log(
		`  usage: in=${u.input_tokens} cache_write=${u.cache_creation_input_tokens} cache_read=${u.cache_read_input_tokens} out=${u.output_tokens}`
	);

	if (msg.stop_reason === 'max_tokens') {
		console.error('x batch hit max_tokens — output truncated, refusing to write.');
		process.exit(1);
	}
	if (msg.stop_reason === 'refusal') {
		console.error('x model refused.');
		process.exit(1);
	}

	const textBlock = msg.content.find((b) => b.type === 'text');
	if (!textBlock) {
		console.error('x no text block in response.');
		process.exit(1);
	}

	let parsed;
	try {
		parsed = JSON.parse(textBlock.text);
	} catch (e) {
		console.error(`x response was not valid JSON — ${e.message}`);
		process.exit(1);
	}
	if (!Array.isArray(parsed.studies)) {
		console.error('x response missing studies[].');
		process.exit(1);
	}

	// Coverage check
	const got = new Map(parsed.studies.map((a) => [a.nct_id, a]));
	const missing = batchIds.filter((id) => !got.has(id));
	const extra = [...got.keys()].filter((id) => !batchIds.includes(id));
	if (missing.length || extra.length) {
		console.error(`x coverage mismatch — refusing to write.`);
		if (missing.length) console.error(`  missing: ${missing.join(', ')}`);
		if (extra.length) console.error(`  extra:   ${extra.join(', ')}`);
		process.exit(1);
	}

	// Quote validation — every constraint's quote MUST be a substring of the
	// corresponding criteria_text. If anything fails, write nothing.
	const batchAnnotations = {};
	let batchConstraintCount = 0;
	for (const s of batch) {
		const ann = got.get(s.nct_id);
		const source = s.eligibility.criteria_text;
		const badQuotes = [];
		for (const [idx, c] of ann.constraints.entries()) {
			if (!quoteIsSubstring(c.quote, source)) {
				badQuotes.push({ idx, quote: c.quote.slice(0, 80) });
			}
		}
		if (badQuotes.length) {
			console.error(`x ${s.nct_id}: ${badQuotes.length} constraint quote(s) not found in criteria_text`);
			for (const b of badQuotes.slice(0, 4)) {
				console.error(`    [${b.idx}] "${b.quote}..."`);
			}
			process.exit(1);
		}
		batchAnnotations[s.nct_id] = {
			constraints: ann.constraints.map((c) => ({
				category: c.category,
				direction: c.direction,
				measure: c.measure,
				comparator: c.comparator,
				value: c.value,
				unit: c.unit,
				quote: c.quote,
				note: c.note
			})),
			overall_confidence: ann.confidence,
			note: ann.note ?? '',
			source: 'ai_proposed',
			review_status: 'pending',
			criteria_length_chars: source.length
		};
		batchConstraintCount += ann.constraints.length;
	}

	Object.assign(annotations, batchAnnotations);
	totalConstraints += batchConstraintCount;
	console.log(`  ${batchIds.length} studies tagged → ${batchConstraintCount} constraint(s) extracted`);

	// Write after every batch — resumable on crash
	writeOutput(annotations);
}

console.log(`\nDone. ${targets.length} studies proposed across ${totalBatches} batch(es). ${totalConstraints} constraint(s) extracted this run.`);

// === Write helper ===========================================================

function writeOutput(currentAnnotations) {
	mkdirSync(dirname(outPath), { recursive: true });

	// Sort annotation keys for stable output
	const sortedKeys = Object.keys(currentAnnotations).sort();
	const annotationsOut = Object.fromEntries(sortedKeys.map((k) => [k, currentAnnotations[k]]));

	const priorMeta = existing.meta && typeof existing.meta === 'object' ? existing.meta : {};
	const output = {
		meta: {
			...priorMeta,
			schema_version: SCHEMA_VERSION,
			indication_id: indication,
			generator: GENERATOR_VERSION,
			model: MODEL,
			source_studies_file: indicationDir + '/studies_normalized.json',
			last_updated_at: new Date().toISOString(),
			category_enum: CATEGORY_ENUM,
			comparator_enum: COMPARATOR_ENUM,
			notes: [
				'AI-proposed structured eligibility constraints. Every quote validated as a verbatim substring of the source criteria_text at write time.',
				'review_status starts as "pending". A separate human-review or auto-confidence-threshold step can promote rows.',
				'Re-propose with: node scripts/propose-eligibility-barriers.mjs [--indication=<id>] [--limit=N] [--only=NCT,...] [--force]'
			]
		},
		count: sortedKeys.length,
		annotations: annotationsOut
	};
	writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
}
