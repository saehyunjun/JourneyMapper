/**
 * propose-external-observations.mjs
 *
 * World-knowledge integration v1 for the journey-map artifact. Reads the
 * persona's existing journey map (synthesized by synthesize-journey-map.mjs)
 * and proposes per-stage / per-step "external observations" — the blue
 * research pills that sit alongside the corpus-grounded green / pink pills on
 * the polished sponsor map.
 *
 * Sources consumed (v1, offline — no PubMed / external API calls):
 *   - src/lib/content/disease-insights/<slug>/manifest.json
 *     + every dataset it references (search-volume topics, community
 *       engagement, ClinicalTrials.gov normalized + observed aggregates)
 *
 * Pipeline:
 *   1. Load the existing artifact, the persona, the journey taxonomy.
 *   2. Build a compact context pack from disease-insights (top-N topics by
 *      volume; CT aggregates; community engagement). Skip the raw study
 *      dump and the keyword lexicon — too large / not useful here.
 *   3. Single Claude call: enum-constrain stage_id + step_id against the
 *      taxonomy; let the model decide which dataset facts attach to which
 *      stages.
 *   4. Merge proposed external observations into the artifact at
 *      `stages[].steps[].external_observations[]` and write a
 *      `meta.external_observations` proposer block.
 *
 * Run:
 *   node scripts/propose-external-observations.mjs <corpus_id> <persona_id>
 *   node scripts/propose-external-observations.mjs <corpus_id> <persona_id> --force
 *
 * Requires ANTHROPIC_API_KEY (use `env -u ANTHROPIC_API_KEY` if a stale shell
 * key shadows .env).
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DEFAULT_MODEL = 'claude-opus-4-7';
const SCRIPT_VERSION = 'propose-external-observations@0.1';

if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));
if (!process.env.ANTHROPIC_API_KEY) {
	console.error('x ANTHROPIC_API_KEY is not set.');
	console.error('  Add to .env or export; if a stale shell key shadows .env, prefix with `env -u ANTHROPIC_API_KEY`.');
	process.exit(1);
}

// === CLI ====================================================================

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const [corpusId, personaId] = positional;
if (!corpusId || !personaId) {
	console.error('x Usage: node scripts/propose-external-observations.mjs <corpus_id> <persona_id> [--model <id>] [--force]');
	process.exit(1);
}
const force = args.includes('--force');
const modelArgIdx = args.indexOf('--model');
const MODEL = modelArgIdx >= 0 && args[modelArgIdx + 1] ? args[modelArgIdx + 1] : DEFAULT_MODEL;

// === Load inputs ============================================================

function readJson(rel) {
	return JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));
}

const ARTIFACT_FILE = `src/lib/content/corpora/${corpusId}/artifacts/journey-map-${personaId}.json`;
if (!existsSync(resolve(ROOT, ARTIFACT_FILE))) {
	console.error(`x Artifact not found: ${ARTIFACT_FILE}`);
	console.error('  Run scripts/synthesize-journey-map.mjs first.');
	process.exit(1);
}
const artifact = readJson(ARTIFACT_FILE);

const indication = artifact.meta.journey_indication;
if (!indication) {
	console.error(`x Artifact has no meta.journey_indication.`);
	process.exit(1);
}

const PERSONA_FILE = `src/lib/content/personas/${personaId}.json`;
const persona = readJson(PERSONA_FILE);

const JOURNEY_FILE = `src/lib/content/journeys/${indication}.json`;
const journey = readJson(JOURNEY_FILE);

// Resolve disease-insights folder by walking subdirs and matching manifest.id.
const INSIGHTS_ROOT = 'src/lib/content/disease-insights';
let insightsManifest = null;
let insightsDir = null;
for (const slug of readdirSync(resolve(ROOT, INSIGHTS_ROOT), { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.map((d) => d.name)) {
	const manifestPath = `${INSIGHTS_ROOT}/${slug}/manifest.json`;
	if (!existsSync(resolve(ROOT, manifestPath))) continue;
	const m = readJson(manifestPath);
	if (m.id === indication) {
		insightsManifest = m;
		insightsDir = `${INSIGHTS_ROOT}/${slug}`;
		break;
	}
}
if (!insightsManifest) {
	console.error(`x No disease-insights manifest found for indication "${indication}".`);
	process.exit(1);
}

// === Compact-context builders for each dataset type =========================

function topN(arr, n, key = 'volume') {
	return [...arr].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0)).slice(0, n);
}

function compactSearchVolume(dataset) {
	const total = dataset.data.reduce((s, d) => s + (d.volume ?? 0), 0);
	return {
		dataset_id: dataset.id,
		dataset_type: dataset.type,
		title: dataset.title,
		subtitle: dataset.subtitle ?? null,
		topic_category: dataset.topic_category ?? null,
		geography: dataset.geography ?? null,
		unit: dataset.unit ?? null,
		total_volume: total,
		// Top topics, capped at 12 to keep prompt small.
		topics: topN(dataset.data, 12, 'volume')
	};
}

function compactCommunityEngagement(dataset) {
	return {
		dataset_id: dataset.id,
		dataset_type: dataset.type,
		title: dataset.title,
		subtitle: dataset.subtitle ?? null,
		platform: dataset.platform ?? null,
		sample: dataset.sample ?? null,
		note: dataset.note ?? null,
		data: dataset.data
	};
}

function compactSponsors(dataset) {
	const top = topN(dataset.sponsors, 10, 'total_count').map((s) => ({
		name: s.name,
		classes: s.classes,
		lead_count: s.lead_count,
		collaborator_count: s.collaborator_count,
		total_count: s.total_count
	}));
	return {
		dataset_id: dataset.id ?? 'sponsors_observed',
		dataset_type: 'clinical_trials_sponsors_observed',
		title: 'ClinicalTrials.gov sponsors observed',
		total_sponsors: dataset.count ?? dataset.sponsors.length,
		top_sponsors: top
	};
}

function compactInterventions(dataset) {
	const top = topN(dataset.interventions, 15, 'count').map((i) => ({
		name: i.name_key,
		types: i.types,
		count: i.count,
		nct_id_count: i.nct_id_count
	}));
	return {
		dataset_id: dataset.id ?? 'interventions_observed',
		dataset_type: 'clinical_trials_interventions_observed',
		title: 'ClinicalTrials.gov interventions observed',
		total_interventions: dataset.count ?? dataset.interventions.length,
		top_interventions: top
	};
}

function compactStudiesNormalized(dataset) {
	const studies = dataset.studies ?? [];
	const byStatus = {};
	const byPhase = {};
	const bySponsorClass = {};
	let recruiting = 0;
	let recentlyStarted = 0; // post 2023
	for (const s of studies) {
		const st = s.overall_status ?? 'UNKNOWN';
		byStatus[st] = (byStatus[st] ?? 0) + 1;
		if (st === 'RECRUITING' || st === 'NOT_YET_RECRUITING' || st === 'ENROLLING_BY_INVITATION') {
			recruiting += 1;
		}
		for (const p of s.phases ?? ['UNKNOWN']) {
			byPhase[p] = (byPhase[p] ?? 0) + 1;
		}
		const cls = s.lead_sponsor?.class ?? 'UNKNOWN';
		bySponsorClass[cls] = (bySponsorClass[cls] ?? 0) + 1;
		const startIso = s.dates?.start?.iso8601 ?? '';
		if (startIso && startIso.slice(0, 4) >= '2023') recentlyStarted += 1;
	}
	return {
		dataset_id: dataset.source_dataset
			? `${dataset.source_dataset}_clinicaltrials_normalized`
			: 'clinicaltrials_normalized',
		dataset_type: 'clinical_trials_normalized',
		title: 'ClinicalTrials.gov normalized studies',
		count_total: studies.length,
		count_recruiting_or_pre: recruiting,
		count_started_2023_plus: recentlyStarted,
		count_by_status: byStatus,
		count_by_phase: byPhase,
		count_by_sponsor_class: bySponsorClass
	};
}

// Load + compact every dataset declared by the manifest.
const consumedIds = [];
const contextPacks = [];
for (const ref of insightsManifest.datasets) {
	const path = `${insightsDir}/${ref.path}`;
	if (!existsSync(resolve(ROOT, path))) continue;
	if (ref.type === 'clinical_trials_raw') continue; // too large; aggregates cover it
	if (ref.type === 'keyword_clusters') continue;    // clinical lexicon, not directly useful here
	const doc = readJson(path);
	let pack = null;
	if (ref.type === 'search_volume_topics') pack = compactSearchVolume(doc);
	else if (ref.type === 'community_engagement') pack = compactCommunityEngagement(doc);
	else if (ref.type === 'clinical_trials_sponsors_observed') pack = compactSponsors(doc);
	else if (ref.type === 'clinical_trials_interventions_observed') pack = compactInterventions(doc);
	else if (ref.type === 'clinical_trials_normalized') pack = compactStudiesNormalized(doc);
	if (pack) {
		pack.dataset_id = ref.id; // override so it matches the manifest id
		contextPacks.push(pack);
		consumedIds.push(ref.id);
	}
}

if (contextPacks.length === 0) {
	console.error(`x No usable datasets in disease-insights for indication "${indication}".`);
	process.exit(1);
}

// === Build stage / step enum + context summary ==============================

const stageStepPairs = []; // { stage_id, step_id }
const stageContext = [];
for (const stage of journey.stages) {
	stageStepPairs.push({ stage_id: stage.id, step_id: '' });
	for (const step of stage.steps) {
		stageStepPairs.push({ stage_id: stage.id, step_id: step.id });
	}
	stageContext.push({
		stage_id: stage.id,
		label: stage.label,
		description: stage.description,
		steps: stage.steps.map((s) => ({ id: s.id, label: s.label, description: s.description }))
	});
}
const stageIds = journey.stages.map((s) => s.id);
const allStepIds = [
	'',
	...journey.stages.flatMap((s) => s.steps.map((st) => st.id))
];

// Synthesized observations already on the artifact (so the model doesn't
// repeat them; external pills should *complement* internal voice).
const existingObservationsByStage = artifact.stages.map((s) => ({
	stage_id: s.stage_id,
	stage_label: s.label,
	stage_summary: s.stage_summary,
	steps: s.steps.map((st) => ({
		step_id: st.step_id ?? '',
		step_label: st.label ?? null,
		observations: st.observations.map((o) => ({
			title: o.title,
			polarity: o.polarity,
			body: o.body
		}))
	}))
}));

// === Schema =================================================================

const datasetIdEnum = consumedIds;

const schema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		external_observations: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					stage_id: { type: 'string', enum: stageIds },
					step_id: { type: 'string', enum: allStepIds },
					title: { type: 'string' },
					body: { type: 'string' },
					citation: { type: 'string' },
					source_dataset_ids: {
						type: 'array',
						items: { type: 'string', enum: datasetIdEnum }
					},
					confidence: { type: 'number' }
				},
				required: [
					'stage_id',
					'step_id',
					'title',
					'body',
					'citation',
					'source_dataset_ids',
					'confidence'
				]
			}
		}
	},
	required: ['external_observations']
};

// === Prompt =================================================================

const SYSTEM_PROMPT = `You are a qualitative-research analyst adding world-knowledge "research pills" (the blue pills on a sponsor-facing journey map) to a persona's journey artifact.

The persona's voice is already on the map as corpus observations (green = positive, pink = negative). Your job is the THIRD voice: external data from search volume, community engagement, and ClinicalTrials.gov aggregates. These pills contextualize the persona's experience against population-scale signal — they say "and here is what the broader world looks like at this stage."

For each observation:
- stage_id: enum-constrained to the journey taxonomy.
- step_id: enum-constrained. Use "" if the observation is stage-level (not anchored to a specific step). Prefer a specific step when one fits well.
- title: 5-12 words, ALL CAPS or Title Case (pick one and stay consistent across all pills). Reads like a fact-tile from a sponsor deck. Lead with the figure when possible — e.g. "12,400/MO SEARCH 'PREDNISONE SIDE EFFECTS' IN US", "382 LN TRIALS ON CLINICALTRIALS.GOV", "PRIVATE FB GROUPS POST 4× MORE THAN PUBLIC ONES".
- body: ONE sentence elaboration that connects the figure to what's happening at this stage for this persona. Plain analyst voice. Do NOT restate the figure; interpret it.
- citation: a short label naming the source — e.g. "Search volume — US, monthly estimate", "ClinicalTrials.gov, 2026", "Facebook patient-community engagement". This is what renders under the pill.
- source_dataset_ids: 1-3 dataset ids (enum-constrained) that ground this observation.
- confidence: 0.0-1.0. Lower confidence for hand-authored search-volume estimates (the manifest will flag these in their source.notes); higher for ClinicalTrials.gov aggregates.

Discipline:
- AIM FOR 2-4 external observations per relevant STAGE — not per step. Some stages will have zero appropriate external data; SKIP THOSE rather than padding. A persona-specific artifact does not need every stage covered.
- TOTAL target: 8-15 external observations across the whole journey.
- The external pills should COMPLEMENT, not duplicate, the corpus observations. If the corpus already says "cost is a barrier", the external pill should add a population figure ("12,400/mo prednisone-side-effect searches suggest steroid burden is a national pattern"), not re-assert the qualitative point.
- Anchor each pill to a SPECIFIC datapoint where possible. "Searches are high" is weak; "12,400/mo searches for X" is the right grain.
- Numbers and dataset names must come from the provided context packs. Do NOT invent figures.
- For ClinicalTrials.gov-derived pills, prefer count-style facts that contextualize trial availability and the competitive landscape (sponsors, interventions, phase distribution). These are most useful at trial_consideration / in_trial_experience stages.
- For search-volume-derived pills, the figure is the patient's QUERY behavior — what they go look up. These often anchor at the corresponding journey moment (e.g. side-effect searches at induction or maintenance; trial searches at trial_consideration; symptom searches at pre-diagnosis).
- For the community engagement dataset, the pill is about WHERE patients find support and how visible the conversation is. Often a single high-signal pill across the journey is enough.

Format consistency: pick ALL CAPS or Title Case and use it for every pill in this run.`;

// === Idempotency ============================================================

const ARTIFACT_PATH_ABS = resolve(ROOT, ARTIFACT_FILE);
const alreadyHasExternal = artifact.stages.some((s) =>
	s.steps.some((st) => (st.external_observations ?? []).length > 0)
);
if (alreadyHasExternal && !force) {
	console.error('x Artifact already contains external_observations. Pass --force to overwrite.');
	process.exit(1);
}

// === Run ====================================================================

console.log(`Proposing external observations for ${corpusId} / ${personaId}`);
console.log(`  Persona: ${persona.label}`);
console.log(`  Indication: ${indication}`);
console.log(`  Model: ${MODEL}`);
console.log(`  Datasets consumed: ${consumedIds.length}`);
for (const id of consumedIds) console.log(`    - ${id}`);
console.log();

const client = new Anthropic();

const userPayload = {
	persona: {
		id: persona.id,
		label: persona.label,
		description: persona.description
	},
	journey_indication: indication,
	stages: stageContext,
	existing_corpus_observations: existingObservationsByStage,
	disease_insights: contextPacks
};

const stream = client.messages.stream({
	model: MODEL,
	max_tokens: 16000,
	...(MODEL.includes('haiku') ? {} : { thinking: { type: 'adaptive' } }),
	output_config: MODEL.includes('haiku')
		? { format: { type: 'json_schema', schema } }
		: { effort: 'high', format: { type: 'json_schema', schema } },
	system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
	messages: [
		{
			role: 'user',
			content:
				`Propose 8-15 external observations for the persona "${persona.label}" of indication "${indication}". ` +
				`Output JSON only — schema-enforced.\n\n` +
				`CONTEXT:\n${JSON.stringify(userPayload, null, 2)}`
		}
	]
});

const msg = await stream.finalMessage();
const u = msg.usage;
console.log(
	`usage: in=${u.input_tokens} cache_write=${u.cache_creation_input_tokens} ` +
		`cache_read=${u.cache_read_input_tokens} out=${u.output_tokens}`
);
if (msg.stop_reason !== 'end_turn' && msg.stop_reason !== 'stop_sequence') {
	console.error(`x stop_reason=${msg.stop_reason}`);
	process.exit(1);
}
const text = msg.content.find((b) => b.type === 'text')?.text;
if (!text) {
	console.error('x no text in response');
	process.exit(1);
}
const result = JSON.parse(text);
const proposed = result.external_observations ?? [];

if (proposed.length === 0) {
	console.error('x Model returned zero external observations. Aborting (use --force after fixing prompt or context).');
	process.exit(1);
}

// === Merge into artifact ====================================================

// Index for O(1) lookups
const stepIndex = new Map(); // `${stage_id}::${step_id}` -> step ref
for (const s of artifact.stages) {
	for (const st of s.steps) {
		stepIndex.set(`${s.stage_id}::${st.step_id ?? ''}`, st);
	}
}

// Clear any previous external observations (idempotent re-runs).
for (const s of artifact.stages) {
	for (const st of s.steps) {
		st.external_observations = [];
	}
}

// If the artifact has a stage but no matching step_id (e.g. model picked "" but
// the artifact only synthesized specific steps for that stage), we synthesize a
// general-step container on the fly.
function ensureStep(stageId, stepId) {
	const key = `${stageId}::${stepId}`;
	if (stepIndex.has(key)) return stepIndex.get(key);
	const stage = artifact.stages.find((s) => s.stage_id === stageId);
	if (!stage) return null; // unknown stage — drop
	const stepDef = stepId
		? journey.stages.find((s) => s.id === stageId)?.steps.find((st) => st.id === stepId)
		: null;
	const newStep = {
		step_id: stepId || null,
		label: stepDef?.label ?? null,
		observations: [],
		external_observations: []
	};
	stage.steps.push(newStep);
	stepIndex.set(key, newStep);
	return newStep;
}

let merged = 0;
let droppedUnknownStage = 0;
for (const obs of proposed) {
	const step = ensureStep(obs.stage_id, obs.step_id || '');
	if (!step) {
		droppedUnknownStage += 1;
		continue;
	}
	step.external_observations.push({
		title: obs.title,
		body: obs.body,
		citation: obs.citation,
		source_dataset_ids: obs.source_dataset_ids,
		confidence: obs.confidence
	});
	merged += 1;
}

// Stamp proposer meta.
artifact.meta.external_observations_proposer = {
	generator: 'scripts/propose-external-observations.mjs',
	generator_version: SCRIPT_VERSION,
	model: MODEL,
	generated_at: new Date().toISOString(),
	datasets_consumed: consumedIds,
	count: merged
};

writeFileSync(ARTIFACT_PATH_ABS, JSON.stringify(artifact, null, 2) + '\n', 'utf8');

console.log();
console.log(`Merged ${merged} external observation(s) into ${ARTIFACT_FILE}.`);
if (droppedUnknownStage > 0) console.log(`  ${droppedUnknownStage} dropped due to unknown stage_id.`);
const perStage = new Map();
for (const s of artifact.stages) {
	let n = 0;
	for (const st of s.steps) n += (st.external_observations ?? []).length;
	if (n > 0) perStage.set(s.stage_id, n);
}
for (const [sid, n] of perStage) console.log(`  ${sid}: ${n}`);
