/**
 * propose-entities.mjs
 *
 * Phase 4 of the codebook migration. Reads a corpus and proposes new
 * Entity registry rows (drugs, biomarkers, sponsors, concepts, symptoms,
 * trials, conditions) for analyst review. See ENTITY_REGISTRY.md and
 * CODEBOOK_MIGRATION_PLAN.md.
 *
 * This is what closes the iGAN coverage hole. Dapagliflozin, Sibeprenlimab,
 * and any other clinically meaningful entities mentioned in corpus text
 * but absent from src/lib/content/entities/ surface here. Output is a
 * reviewable JSON file; the merge into the actual entity registries is
 * a separate human step (no auto-merge — analyst eyes are mandatory
 * before status: active per ENTITY_REGISTRY.md rule #5).
 *
 * Run:
 *   node scripts/propose-entities.mjs <corpus_id>
 *   node scripts/propose-entities.mjs <corpus_id> --source social_post
 *   node scripts/propose-entities.mjs <corpus_id> --kinds drug,biomarker
 *   node scripts/propose-entities.mjs <corpus_id> --sample 80
 *
 * Output goes to src/lib/content/corpora/<corpus_id>/proposed_entities.json
 * with full provenance, evidence excerpts, and confidence per candidate.
 * Analysts review, then merge accepted rows into entities/<kind>.json.
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
const SCRIPT_VERSION = 'propose-entities@0.2';

if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));
if (!process.env.ANTHROPIC_API_KEY) {
	console.error('x ANTHROPIC_API_KEY is not set.');
	console.error('  Add to .env or export; if a stale shell key shadows .env, prefix with `env -u ANTHROPIC_API_KEY`.');
	process.exit(1);
}

// === CLI ====================================================================

const args = process.argv.slice(2);
const flagNames = new Set(['--source', '--kinds', '--sample', '--model']);
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
	console.error('x Usage: node scripts/propose-entities.mjs <corpus_id> [--source <name>] [--kinds drug,biomarker,...] [--sample N] [--model <id>]');
	console.error(`  Default model: ${DEFAULT_MODEL}. Override with --model claude-sonnet-4-6 or claude-opus-4-7.`);
	process.exit(1);
}
const MODEL = (() => {
	const idx = args.indexOf('--model');
	return idx >= 0 ? args[idx + 1] : DEFAULT_MODEL;
})();
const sourceFilter = (() => {
	const idx = args.indexOf('--source');
	return idx >= 0 ? args[idx + 1] : null;
})();
const VALID_KINDS = ['drug', 'biomarker', 'sponsor', 'concept', 'symptom', 'trial', 'condition'];
const kindsFilter = (() => {
	const idx = args.indexOf('--kinds');
	if (idx < 0) return null;
	const parts = (args[idx + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
	const bad = parts.filter((k) => !VALID_KINDS.includes(k));
	if (bad.length) {
		console.error(`x --kinds: unknown kind(s) ${bad.join(', ')}. Valid: ${VALID_KINDS.join(', ')}`);
		process.exit(1);
	}
	return parts;
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

// === Load corpus ============================================================

const CORPUS_DIR = `src/lib/content/corpora/${corpusId}`;
const MANIFEST_FILE = `${CORPUS_DIR}/manifest.json`;
if (!existsSync(resolve(ROOT, MANIFEST_FILE))) {
	console.error(`x Corpus manifest not found: ${MANIFEST_FILE}`);
	process.exit(1);
}
const manifest = JSON.parse(readFileSync(resolve(ROOT, MANIFEST_FILE), 'utf8'));
const corpusIndications = manifest.indications ?? [];
console.log(`Corpus: ${corpusId} (indications: ${corpusIndications.join(', ') || '(none in manifest)'})`);

const FRAGMENTS_DIR = `${CORPUS_DIR}/fragments`;
if (!existsSync(resolve(ROOT, FRAGMENTS_DIR))) {
	console.error(`x No fragments directory: ${FRAGMENTS_DIR}`);
	process.exit(1);
}

const allFragments = [];
for (const f of readdirSync(resolve(ROOT, FRAGMENTS_DIR)).filter((f) => f.endsWith('.json'))) {
	const doc = JSON.parse(readFileSync(resolve(ROOT, FRAGMENTS_DIR, f), 'utf8'));
	const contentSource = doc.meta?.content_source ?? f.replace(/\.json$/, '');
	if (sourceFilter && contentSource !== sourceFilter) continue;
	for (const frag of doc.fragments ?? []) {
		if (frag.text && typeof frag.text === 'string') {
			allFragments.push({ id: frag.id, content_source: contentSource, text: frag.text });
		}
	}
}
console.log(`Loaded ${allFragments.length} fragments${sourceFilter ? ` (filtered to --source ${sourceFilter})` : ''}.`);
if (allFragments.length === 0) {
	console.error('x No fragments to scan.');
	process.exit(1);
}

const scanFragments = sampleSize && sampleSize < allFragments.length
	? allFragments.slice(0, sampleSize)
	: allFragments;
if (sampleSize) console.log(`Scanning first ${scanFragments.length} fragments (--sample ${sampleSize}).`);

// === Load existing entities (dedup) =========================================

const ENTITIES_DIR = 'src/lib/content/entities';
const existingEntities = [];
const existingSurfaceForms = new Set();
const existingLabels = new Set();
const kindFiles = ['drugs.json', 'biomarkers.json', 'sponsors.json', 'concepts.json', 'symptoms.json', 'trials.json', 'conditions.json'];
for (const f of kindFiles) {
	const p = resolve(ROOT, ENTITIES_DIR, f);
	if (!existsSync(p)) continue;
	const doc = JSON.parse(readFileSync(p, 'utf8'));
	for (const item of doc.items ?? []) {
		existingEntities.push(item);
		existingLabels.add(item.label.toLowerCase().trim());
		for (const sf of item.surface_forms ?? []) existingSurfaceForms.add(sf.toLowerCase().trim());
	}
}
console.log(`Existing entities registry: ${existingEntities.length} entries (${existingSurfaceForms.size} unique surface forms).`);

// === Load themes registry ===================================================

const THEMES_FILE = 'src/lib/content/themes/themes.json';
if (!existsSync(resolve(ROOT, THEMES_FILE))) {
	console.error(`x Themes registry not found: ${THEMES_FILE}`);
	process.exit(1);
}
const themesDoc = JSON.parse(readFileSync(resolve(ROOT, THEMES_FILE), 'utf8'));
const themeIds = themesDoc.items.map((t) => t.id);
console.log(`Themes registry: ${themeIds.length} themes loaded for theme_links suggestion.`);

// === Output schema ==========================================================

const KINDS_FOR_PROMPT = kindsFilter ?? VALID_KINDS;

const candidateSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		kind: { type: 'string' },
		label: { type: 'string' },
		surface_forms: { type: 'array', items: { type: 'string' } },
		indications_observed: { type: 'array', items: { type: 'string' } },
		theme_links_suggested: { type: 'array', items: { type: 'string' } },
		metadata_json: {
			type: 'string',
			description: 'kind-specific metadata as a serialized JSON object. Per-kind fields: drug → {class, mechanism, brand_names, routes, approval_status, generic_name}; biomarker → {measurement_type, normal_range, clinical_use}; sponsor → {sponsor_type, parent_org, headquarters_country}; symptom → {severity_scale, icd10_codes}; trial → {nct_id, phase, status}; condition → {icd10_codes, is_primary_indication}. Empty object "{}" if none apply. The serialization-as-string keeps the structured-output grammar small enough to compile.'
		},
		evidence: {
			type: 'object',
			additionalProperties: false,
			properties: {
				mention_count: { type: 'integer' },
				example_fragment_ids: { type: 'array', items: { type: 'string' } },
				example_excerpt: { type: 'string', description: 'one short verbatim excerpt showing the entity in context, max 140 chars' }
			},
			required: ['mention_count', 'example_fragment_ids', 'example_excerpt']
		},
		confidence: { type: 'number' },
		rationale: { type: 'string', description: 'why this is a real entity and not a passing reference' }
	},
	required: ['kind', 'label', 'surface_forms', 'indications_observed', 'theme_links_suggested', 'metadata_json', 'evidence', 'confidence', 'rationale']
};

const outputSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		candidates: { type: 'array', items: candidateSchema }
	},
	required: ['candidates']
};

// === System prompt ==========================================================

const themesForPrompt = themesDoc.items.map((t) => ({
	id: t.id,
	axis: t.axis,
	label: t.label,
	captures: t.captures
}));

const existingForPrompt = existingEntities.map((e) => ({
	id: e.id,
	label: e.label,
	kind: e.kind,
	surface_forms: e.surface_forms
}));

const SYSTEM_PROMPT = `You are a qualitative-research analyst extracting CANDIDATE ENTITIES from patient/caregiver text — named things worth registering in the entity layer (per ENTITY_REGISTRY.md). The matcher uses surface_forms to recognize entities in text at render time; the registry rows you propose are what enable that.

YOUR JOB: Read the corpus fragments below and propose NEW entity rows for any entity that:
  (a) is genuinely mentioned in patient text (not just inferred from clinical knowledge),
  (b) is not already in the existing entities registry (which I provide below — DO NOT propose duplicates),
  (c) belongs to one of the requested kinds: ${KINDS_FOR_PROMPT.join(', ')}.

ENTITY KINDS:
- drug: specific drug (Dapagliflozin, Sibeprenlimab, mycophenolate). Include generic + brand variants.
- biomarker: clinical measurements (eGFR, UPCR, hemoglobin, IgA levels).
- sponsor: pharma / biotech / academic sponsors (Aurinia, Vera Therapeutics, Roche).
- concept: clinical concepts with stable surface forms (flare, remission, biopsy, second opinion).
- symptom: patient-experienced symptoms (fatigue, brain fog, foamy urine).
- trial: specific trials (KYV-101, CABA-201, NCT06104449).
- condition: comorbid conditions a patient mentions alongside their primary (comorbid diabetes, depression).

FOR EACH CANDIDATE:
- kind: one of the allowed kinds.
- label: canonical display label (e.g. "Dapagliflozin", not "dapa").
- surface_forms: EVERY form that appears in patient text — generic names, brand names, common misspellings, abbreviations. Include the form actually used in the corpus AND known variants.
- indications_observed: which indications the corpus mentions this entity for. Use the corpus's manifest.indications when the corpus is single-indication, or extract from context.
- theme_links_suggested: 1–3 theme ids from the registry that this entity is TYPICALLY discussed in the context of. Defaults per kind (drug → util.coverage, util.insurance, hrqol.general_health; biomarker → hrqol.general_health; symptom → relevant hrqol.* scale). Don't pack — 1–3 is right.
- metadata: kind-specific. drug: class, mechanism, brand_names[], routes[]. biomarker: measurement_type (numeric/categorical), normal_range, clinical_use. sponsor: sponsor_type (pharma/biotech/academic/cro). symptom: severity_scale. trial: nct_id, phase, status. condition: icd10_codes[], is_primary_indication.
- evidence: mention_count across the scanned fragments, up to 4 fragment ids that mention it, and ONE short verbatim excerpt (≤140 chars) showing context.
- confidence: 0.0–1.0. High (>0.85) when mentioned multiple times in distinct posts with clear clinical context. Low (<0.6) when one ambiguous mention.
- rationale: short — why this is a real entity vs. a passing reference.

DEDUP RULES (HARD):
- If the label OR ANY surface_form (case-insensitive) is already in the existing entities list below, DO NOT propose. The matcher already handles it.
- If a brand name is mentioned but its generic is already registered (or vice versa), do not propose; the registry's surface_forms will be expanded during review.

THEMES REGISTRY (for theme_links_suggested):
${JSON.stringify(themesForPrompt, null, 2)}

EXISTING ENTITIES (do not duplicate):
${JSON.stringify(existingForPrompt, null, 2)}

QUALITY BAR: Be conservative. False positives waste analyst review time. If you're not confident an entity is mentioned substantively (not just inferred), set confidence <0.5 OR omit. The corpus is the source of truth.`;

// === Run ====================================================================

const client = new Anthropic();
const BATCH_SIZE = 60; // ~60 fragments per LLM call; balances context use vs. coverage
const batches = [];
for (let i = 0; i < scanFragments.length; i += BATCH_SIZE) {
	batches.push(scanFragments.slice(i, i + BATCH_SIZE));
}
console.log(`\nDispatching ${batches.length} batch(es) of up to ${BATCH_SIZE} fragments each.\n`);

const allCandidates = [];
let totalUsage = { in: 0, cache_write: 0, cache_read: 0, out: 0 };
let batchesCompleted = 0;

// === Checkpoint writer =====================================================
// Per-batch checkpoint write so an API failure / billing wall / SIGTERM mid-
// run doesn't lose every batch. Runs the merge + dedup pass over whatever
// allCandidates has accumulated so far and writes a complete proposed_entities.json.
// Cheap relative to the API call that produced these candidates.
const OUT_FILE = `${CORPUS_DIR}/proposed_entities.json`;
function writeCheckpoint(isFinal = false) {
	const merged = mergeCandidates(allCandidates);
	const nowIso = new Date().toISOString();
	const output = {
		meta: {
			schema_version: 'proposed-entities-0.1',
			generator: SCRIPT_VERSION,
			model: MODEL,
			corpus_id: corpusId,
			corpus_indications: corpusIndications,
			generated_at: nowIso,
			scanned_fragment_count: scanFragments.length,
			total_corpus_fragment_count: allFragments.length,
			source_filter: sourceFilter,
			kinds_filter: kindsFilter,
			sample_size: sampleSize,
			existing_entities_count: existingEntities.length,
			batches_completed: batchesCompleted,
			batches_total: batches.length,
			is_partial: !isFinal && batchesCompleted < batches.length,
			candidate_count: merged.length,
			usage_total: totalUsage,
			notes: [
				'STARTER CANDIDATES. Generated by propose-entities.mjs; analyst review required before merge into entities/<kind>.json.',
				'Each candidate carries provenance=extracted; status should be set to active only after review.',
				'Dedup is best-effort by case-insensitive label + surface_form. Brand/generic conflicts may slip through — review the surface_forms before accepting.',
				'theme_links_suggested are 1–3 suggestions per the entity-registry rule. Verify they make sense for the entity in this indication.',
				...(isFinal
					? []
					: ['PARTIAL: this checkpoint was written mid-run; some batches did not complete.'])
			]
		},
		candidates: merged
	};
	const outPath = resolve(ROOT, OUT_FILE);
	mkdirSync(dirname(outPath), { recursive: true });
	writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
}

for (let bi = 0; bi < batches.length; bi++) {
	const batch = batches[bi];
	console.log(`Batch ${bi + 1}/${batches.length} (${batch.length} fragments)...`);

	const payload = batch.map((f) => ({
		fragment_id: f.id,
		text: f.text.length > 1200 ? f.text.slice(0, 1200) + '…' : f.text
	}));

	let msg;
	try {
		const stream = client.messages.stream({
			model: MODEL,
			// 16K is enough for ~50 candidates of structured JSON; was 32K when
			// adaptive thinking inflated the output stream. Tighter cap = faster
			// per-batch latency + harder failure if the model goes off rails.
			max_tokens: 16000,
			// No thinking — extraction is shape-constrained by output_config.
			// No `effort: 'high'` either — Haiku 4.5 rejects it (only Opus +
			// Sonnet support the effort parameter on json_schema outputs).
			output_config: { format: { type: 'json_schema', schema: outputSchema } },
			system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
			messages: [
				{
					role: 'user',
					content:
						`Scan these fragments and propose entity candidates per the rules above. ` +
						`Skip anything already in the existing entities list. Be conservative. ` +
						`Fragments:\n\n${JSON.stringify(payload, null, 2)}`
				}
			]
		});
		msg = await stream.finalMessage();
	} catch (e) {
		// API failure (rate limit, billing, network). Checkpoint whatever we
		// have so far so the next run can pick up — or at least the analyst
		// has the work that completed before the failure.
		console.error(`x batch ${bi + 1}: API call failed — ${e.message ?? e}`);
		if (allCandidates.length > 0) {
			writeCheckpoint(false);
			console.error(`  Checkpoint written: ${OUT_FILE} (batches 1..${batchesCompleted}/${batches.length}).`);
		}
		process.exit(1);
	}
	const u = msg.usage;
	totalUsage.in += u.input_tokens;
	totalUsage.cache_write += u.cache_creation_input_tokens ?? 0;
	totalUsage.cache_read += u.cache_read_input_tokens ?? 0;
	totalUsage.out += u.output_tokens;
	console.log(
		`  usage: in=${u.input_tokens} cache_write=${u.cache_creation_input_tokens ?? 0} ` +
			`cache_read=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens}`
	);

	if (msg.stop_reason === 'max_tokens') {
		console.error(`x batch ${bi + 1}: hit max_tokens.`);
		process.exit(1);
	}
	if (msg.stop_reason === 'refusal') {
		console.error(`x batch ${bi + 1}: model refused.`);
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
	if (!Array.isArray(parsed.candidates)) {
		console.error(`x batch ${bi + 1}: no "candidates" array in response.`);
		process.exit(1);
	}

	// Client-side validation: kind and theme_ids no longer enforced by the
	// API schema (constraint grammar got too complex with 27-theme enum +
	// nested metadata). Validate here and surface anything weird.
	const themeIdSet = new Set(themeIds);
	const validKinds = new Set(KINDS_FOR_PROMPT);
	const accepted = [];
	const droppedAsDup = [];
	const droppedAsInvalid = [];
	for (const c of parsed.candidates) {
		if (!validKinds.has(c.kind)) {
			droppedAsInvalid.push(`${c.label} (unknown kind: ${c.kind})`);
			continue;
		}
		// Parse metadata_json into a real object. If the LLM emitted malformed
		// JSON, default to empty {} and flag the candidate for analyst review.
		try {
			c.metadata = JSON.parse(c.metadata_json || '{}');
		} catch {
			console.warn(`  ! ${c.label}: metadata_json was malformed; defaulting to {}.`);
			c.metadata = {};
		}
		delete c.metadata_json;
		// Drop unknown theme_ids silently rather than reject the whole row —
		// the LLM sometimes paraphrases ids. The analyst review fixes this.
		const validThemes = c.theme_links_suggested.filter((t) => themeIdSet.has(t));
		if (validThemes.length !== c.theme_links_suggested.length) {
			const bad = c.theme_links_suggested.filter((t) => !themeIdSet.has(t));
			console.warn(`  ! ${c.label}: dropped ${bad.length} unknown theme_id(s): ${bad.join(', ')}`);
			c.theme_links_suggested = validThemes;
		}
		const labelKey = c.label.toLowerCase().trim();
		if (existingLabels.has(labelKey)) {
			droppedAsDup.push(c.label);
			continue;
		}
		const sfDup = c.surface_forms.some((sf) => existingSurfaceForms.has(sf.toLowerCase().trim()));
		if (sfDup) {
			droppedAsDup.push(c.label);
			continue;
		}
		accepted.push(c);
	}
	if (droppedAsDup.length) {
		console.log(`  dedup: dropped ${droppedAsDup.length} as duplicate (${droppedAsDup.slice(0, 4).join(', ')}${droppedAsDup.length > 4 ? '…' : ''})`);
	}
	if (droppedAsInvalid.length) {
		console.log(`  invalid: dropped ${droppedAsInvalid.length} (${droppedAsInvalid.slice(0, 3).join(', ')}${droppedAsInvalid.length > 3 ? '…' : ''})`);
	}
	console.log(`  ${accepted.length} new candidate(s) from this batch.`);
	allCandidates.push(...accepted);
	batchesCompleted += 1;

	// Per-batch checkpoint write — see writeCheckpoint above. Cheap relative
	// to the API call; protects against billing failures, rate limits, and
	// SIGTERM mid-run.
	writeCheckpoint(false);
}

// Final write at clean completion. Uses the same merge + dedup as checkpoint
// but flips the is_partial flag and drops the partial-warning note.
writeCheckpoint(true);

// === Cross-batch merge function (used by writeCheckpoint) ===================
// Two batches can independently surface the same entity. First pass: merge by
// (kind, label) — exact label collisions. Second pass: merge groups that share
// any surface_form (case-insensitive) within the same kind, catching the
// parenthetical-label variants ("Budesonide (Nefecon / Tarpeyo)" vs.
// "Tarpeyo (budesonide)" — same drug, two label strings).
function mergeCandidates(candidates) {
const mergedByKey = new Map();
for (const c of candidates) {
	const key = `${c.kind}:${c.label.toLowerCase().trim()}`;
	const prior = mergedByKey.get(key);
	if (!prior) {
		mergedByKey.set(key, { ...c });
		continue;
	}
	prior.surface_forms = Array.from(new Set([...prior.surface_forms, ...c.surface_forms]));
	prior.indications_observed = Array.from(new Set([...prior.indications_observed, ...c.indications_observed]));
	prior.theme_links_suggested = Array.from(new Set([...prior.theme_links_suggested, ...c.theme_links_suggested]));
	prior.evidence.mention_count += c.evidence.mention_count;
	prior.evidence.example_fragment_ids = Array.from(
		new Set([...prior.evidence.example_fragment_ids, ...c.evidence.example_fragment_ids])
	).slice(0, 4);
	prior.confidence = Math.max(prior.confidence, c.confidence);
	if (prior.rationale && c.rationale && !prior.rationale.includes(c.rationale)) {
		prior.rationale = prior.rationale + ' / ' + c.rationale;
	}
}
// First-pass merge: by (kind, label) — only catches exact label collisions.
const labelMerged = Array.from(mergedByKey.values());

// Second-pass merge: by surface_form intersection within same kind. Same drug
// can surface under different parenthetical label strings across batches
// (e.g. "Budesonide (Nefecon / Tarpeyo)" vs "Tarpeyo (budesonide)"). Without
// this, the analyst sees 3–4 rows for the same entity.
function normSF(s) {
	return s.toLowerCase().trim();
}
const sfMerged = [];
const consumed = new Set();
for (let i = 0; i < labelMerged.length; i++) {
	if (consumed.has(i)) continue;
	const group = [labelMerged[i]];
	consumed.add(i);
	const groupSFs = new Set(labelMerged[i].surface_forms.map(normSF));
	let grew = true;
	while (grew) {
		grew = false;
		for (let j = 0; j < labelMerged.length; j++) {
			if (consumed.has(j)) continue;
			if (labelMerged[j].kind !== labelMerged[i].kind) continue;
			const otherSFs = labelMerged[j].surface_forms.map(normSF);
			if (otherSFs.some((sf) => groupSFs.has(sf))) {
				group.push(labelMerged[j]);
				consumed.add(j);
				for (const sf of otherSFs) groupSFs.add(sf);
				grew = true;
			}
		}
	}
	// Merge the group; head = highest-confidence row for label/metadata
	const head = group.reduce((a, b) => (b.confidence > a.confidence ? b : a));
	const merged = { ...head };
	const seenSF = new Set();
	merged.surface_forms = [];
	for (const c of group) for (const sf of c.surface_forms) {
		if (!seenSF.has(normSF(sf))) {
			seenSF.add(normSF(sf));
			merged.surface_forms.push(sf);
		}
	}
	const seenInd = new Set(merged.indications_observed.map(String));
	merged.indications_observed = [...merged.indications_observed];
	for (const c of group) for (const ind of c.indications_observed) {
		if (!seenInd.has(ind)) { seenInd.add(ind); merged.indications_observed.push(ind); }
	}
	const seenTL = new Set(merged.theme_links_suggested);
	merged.theme_links_suggested = [...merged.theme_links_suggested];
	for (const c of group) for (const t of c.theme_links_suggested) {
		if (!seenTL.has(t)) { seenTL.add(t); merged.theme_links_suggested.push(t); }
	}
	merged.evidence = {
		mention_count: group.reduce((s, c) => s + c.evidence.mention_count, 0),
		example_fragment_ids: Array.from(new Set(group.flatMap((c) => c.evidence.example_fragment_ids))).slice(0, 6),
		example_excerpt: head.evidence.example_excerpt
	};
	merged.confidence = Math.max(...group.map((c) => c.confidence));
	const rationales = Array.from(new Set(group.map((c) => c.rationale).filter(Boolean)));
	merged.rationale = rationales.join(' / ');
	// Merge metadata (keep first non-empty per field; union arrays)
	const md = { ...merged.metadata };
	for (const c of group) {
		for (const [k, v] of Object.entries(c.metadata ?? {})) {
			if (md[k] == null || md[k] === '') md[k] = v;
			else if (Array.isArray(md[k]) && Array.isArray(v)) {
				const u = [...md[k]];
				for (const x of v) if (!u.includes(x)) u.push(x);
				md[k] = u;
			}
		}
	}
	merged.metadata = md;
	sfMerged.push(merged);
}

return sfMerged.sort((a, b) => {
	if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
	return a.label.localeCompare(b.label);
});
}

// === Done banner ============================================================

const finalCount = mergeCandidates(allCandidates).length;
console.log(`\n=== Done ===`);
console.log(`Wrote ${OUT_FILE}`);
console.log(`  ${finalCount} unique candidate(s) across ${batches.length} batch(es).`);
const byKind = {};
for (const c of mergeCandidates(allCandidates)) byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
for (const [k, n] of Object.entries(byKind).sort()) console.log(`  ${k}: ${n}`);
console.log(`Usage total: in=${totalUsage.in} cache_write=${totalUsage.cache_write} cache_read=${totalUsage.cache_read} out=${totalUsage.out}`);
console.log(`\nNext step: open ${OUT_FILE}, review candidates, merge accepted into entities/<kind>.json with provenance=extracted, status=active.`);
