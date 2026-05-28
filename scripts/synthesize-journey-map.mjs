/**
 * synthesize-journey-map.mjs
 *
 * Generative journey-map artifact for a (corpus, persona) pair. Mirrors the
 * mCRPC Pluvicto reference: numbered stages with sentiment + emotion dot,
 * green / pink / blue observation pills per step, drivers / barriers panels
 * at decision-point stages, optional drill-down callouts for high-salience
 * stages.
 *
 * Pipeline:
 *   1. Filter fragments by persona (using the same predicate the workbench
 *      uses — copied here because scripts can't import the .ts module).
 *   2. Group filtered fragments by stage_id (multi-label fragments contribute
 *      to each stage they touch); within each stage, group by step_id.
 *   3. Per-stage Claude call: synthesize emotion label + dyad, per-step
 *      observation pills, optional stage drill-down. JSON-schema-constrained;
 *      observation supporting_fragment_ids are enum-constrained to the
 *      stage's matched fragments.
 *   4. For decision-point stages (declared in the journey taxonomy's
 *      meta.decision_points[], else falls back to a built-in heuristic for
 *      common ids like trial_consideration): one extra Claude call for
 *      drivers / barriers / mixed panels.
 *   5. Output: corpora/<corpus>/artifacts/journey-map-<persona>.json
 *
 * World-knowledge integration (blue research pills) is staged but NOT wired
 * in v1 — the artifact format reserves an `external_observations[]` slot per
 * step that a future pass (PubMed / NCT / disease-insights/search-volume)
 * can populate.
 *
 * Run:
 *   node scripts/synthesize-journey-map.mjs <corpus_id> <persona_id>
 *   node scripts/synthesize-journey-map.mjs <corpus_id> <persona_id> --force
 *
 * Requires ANTHROPIC_API_KEY.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DEFAULT_MODEL = 'claude-opus-4-7';
const SCRIPT_VERSION = 'synthesize-journey-map@0.1';

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
	console.error('x Usage: node scripts/synthesize-journey-map.mjs <corpus_id> <persona_id> [--model <id>] [--force]');
	process.exit(1);
}
const force = args.includes('--force');
const modelArgIdx = args.indexOf('--model');
const MODEL = modelArgIdx >= 0 && args[modelArgIdx + 1] ? args[modelArgIdx + 1] : DEFAULT_MODEL;

// === Load inputs ============================================================

function readJson(rel) {
	return JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));
}

const CORPUS_DIR = `src/lib/content/corpora/${corpusId}`;
const MANIFEST_FILE = `${CORPUS_DIR}/manifest.json`;
if (!existsSync(resolve(ROOT, MANIFEST_FILE))) {
	console.error(`x Corpus manifest not found: ${MANIFEST_FILE}`);
	process.exit(1);
}
const manifest = readJson(MANIFEST_FILE);

const PERSONA_FILE = `src/lib/content/personas/${personaId}.json`;
if (!existsSync(resolve(ROOT, PERSONA_FILE))) {
	console.error(`x Persona not found: ${PERSONA_FILE}`);
	process.exit(1);
}
const persona = readJson(PERSONA_FILE);

const indication = manifest.indications?.[0];
if (!indication) {
	console.error(`x Corpus ${corpusId} has no indications.`);
	process.exit(1);
}

const JOURNEY_FILE = `src/lib/content/journeys/${indication}.json`;
if (!existsSync(resolve(ROOT, JOURNEY_FILE))) {
	console.error(`x Journey taxonomy not found: ${JOURNEY_FILE}`);
	process.exit(1);
}
const journey = readJson(JOURNEY_FILE);

const codebook = readJson('src/lib/content/wctglpdemo-data/codebook.json');
const emotionIds = codebook.emotion_tags.map((e) => e.id);

const FRAGMENTS_DIR = `${CORPUS_DIR}/fragments`;
const ANNOTATIONS_DIR = `${CORPUS_DIR}/annotations`;
const fragments = [];
const annotations = {};
for (const f of readdirSync(resolve(ROOT, FRAGMENTS_DIR)).filter((f) => f.endsWith('.json'))) {
	const doc = readJson(`${FRAGMENTS_DIR}/${f}`);
	if (Array.isArray(doc.fragments)) fragments.push(...doc.fragments);
}
if (existsSync(resolve(ROOT, ANNOTATIONS_DIR))) {
	for (const f of readdirSync(resolve(ROOT, ANNOTATIONS_DIR)).filter((f) => f.endsWith('.json'))) {
		const doc = readJson(`${ANNOTATIONS_DIR}/${f}`);
		Object.assign(annotations, doc.annotations ?? {});
	}
}

// === Persona predicate (inlined from $lib/content/personas/evaluate.ts) =====

function checkAttr(attr, matcher) {
	if (!attr) return 'unknown';
	const allowInferred = matcher.allow_inferred ?? true;
	if (attr.evidence === 'unknown') return 'unknown';
	if (attr.evidence === 'inferred' && !allowInferred) return 'no_match';
	if (attr.value === null) return 'unknown';
	return matcher.in.includes(attr.value) ? 'match' : 'no_match';
}

function checkAnnotation(ann, matcher) {
	if (!ann) return false;
	if (matcher.has_stage) {
		const stages = ann.stages?.values ?? [];
		if (!stages.some((s) => matcher.has_stage.includes(s.stage_id))) return false;
	}
	if (matcher.has_step) {
		const stages = ann.stages?.values ?? [];
		if (!stages.some((s) => s.step_id !== null && matcher.has_step.includes(s.step_id))) return false;
	}
	if (matcher.sentiment) {
		const s = ann.segment_tags?.sentiment_score;
		if (typeof s !== 'number') return false;
		if (matcher.sentiment.min !== undefined && s < matcher.sentiment.min) return false;
		if (matcher.sentiment.max !== undefined && s > matcher.sentiment.max) return false;
	}
	if (matcher.has_emotion) {
		const emo = ann.segment_tags?.emotions ?? [];
		if (!emo.some((e) => matcher.has_emotion.includes(e))) return false;
	}
	if (matcher.has_theme) {
		const th = ann.segment_tags?.themes ?? [];
		if (!th.some((t) => matcher.has_theme.includes(t))) return false;
	}
	if (matcher.has_subtheme) {
		const sub = ann.segment_tags?.subthemes ?? [];
		if (!sub.some((s) => matcher.has_subtheme.includes(s))) return false;
	}
	return true;
}

function fragmentMatchesPersona(fragment, p, anns) {
	const f = p.filter;
	if (f.content_source && !f.content_source.includes(fragment.content_source)) return false;
	if (f.indications && !fragment.indications.some((ind) => f.indications.includes(ind))) return false;
	if (f.speaker_attrs) {
		for (const [name, matcher] of Object.entries(f.speaker_attrs)) {
			const attr = fragment.speaker_attrs?.[name];
			const result = checkAttr(attr, matcher);
			if (result === 'no_match') return false;
			if (result === 'unknown' && !(matcher.allow_unknown ?? false)) return false;
		}
	}
	if (f.annotations) {
		const ann = anns[fragment.id];
		if (!checkAnnotation(ann, f.annotations)) return false;
	}
	return true;
}

// === Filter + group =========================================================

const matched = fragments.filter((f) => fragmentMatchesPersona(f, persona, annotations));
if (matched.length === 0) {
	console.error(`x No fragments match persona ${personaId} in corpus ${corpusId}.`);
	process.exit(1);
}

// Group matched fragments by stage_id. Multi-label fragments appear under each
// stage they touch.
const fragmentsByStage = new Map();
const fragmentsByStageStep = new Map(); // `${stage}::${step ?? ''}` -> Fragment[]
const stageSentiments = new Map();      // stage_id -> sentiment_score[]
const stageEmotions = new Map();        // stage_id -> emotion_id[]
const stageThemes = new Map();          // stage_id -> theme_id[]

for (const f of matched) {
	const ann = annotations[f.id];
	const tagged = ann?.stages?.values ?? [];
	const sentiment = ann?.segment_tags?.sentiment_score;
	const emotions = ann?.segment_tags?.emotions ?? [];
	const themes = ann?.segment_tags?.themes ?? [];

	for (const t of tagged) {
		if (!fragmentsByStage.has(t.stage_id)) fragmentsByStage.set(t.stage_id, []);
		fragmentsByStage.get(t.stage_id).push(f);

		const stepKey = `${t.stage_id}::${t.step_id ?? ''}`;
		if (!fragmentsByStageStep.has(stepKey)) fragmentsByStageStep.set(stepKey, []);
		fragmentsByStageStep.get(stepKey).push(f);

		if (typeof sentiment === 'number') {
			if (!stageSentiments.has(t.stage_id)) stageSentiments.set(t.stage_id, []);
			stageSentiments.get(t.stage_id).push(sentiment);
		}
		if (!stageEmotions.has(t.stage_id)) stageEmotions.set(t.stage_id, []);
		stageEmotions.get(t.stage_id).push(...emotions);
		if (!stageThemes.has(t.stage_id)) stageThemes.set(t.stage_id, []);
		stageThemes.get(t.stage_id).push(...themes);
	}
}

function avg(arr) {
	return arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;
}
function topCounts(arr, n) {
	const c = new Map();
	for (const x of arr) c.set(x, (c.get(x) ?? 0) + 1);
	return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

// === Decision-point heuristic ===============================================

const DECISION_POINT_IDS = new Set(
	journey.meta?.decision_points ?? ['trial_consideration']
);

// === Output schemas =========================================================

// Per-stage synthesis schema. Observations cite fragment_ids constrained to
// the stage's matched fragments (enum-constrained at call time).
function stageSchemaFor(stageDef, fragmentIdsInStage) {
	const stepIdsInStage = stageDef.steps.map((s) => s.id);
	return {
		type: 'object',
		additionalProperties: false,
		properties: {
			emotion_label: { type: 'string', enum: [...emotionIds, ''] },
			stage_summary: { type: 'string' },
			drill_down: {
				type: 'object',
				additionalProperties: false,
				properties: {
					include: { type: 'boolean' },
					text: { type: 'string' },
					supporting_fragment_ids: {
						type: 'array',
						items: { type: 'string', enum: fragmentIdsInStage }
					}
				},
				required: ['include', 'text', 'supporting_fragment_ids']
			},
			steps: {
				type: 'array',
				items: {
					type: 'object',
					additionalProperties: false,
					properties: {
						step_id: { type: 'string', enum: [...stepIdsInStage, ''] },
						observations: {
							type: 'array',
							items: {
								type: 'object',
								additionalProperties: false,
								properties: {
									title: { type: 'string' },
									polarity: { type: 'string', enum: ['positive', 'negative', 'mixed'] },
									body: { type: 'string' },
									supporting_fragment_ids: {
										type: 'array',
										items: { type: 'string', enum: fragmentIdsInStage }
									},
									confidence: { type: 'number' }
								},
								required: ['title', 'polarity', 'body', 'supporting_fragment_ids', 'confidence']
							}
						}
					},
					required: ['step_id', 'observations']
				}
			}
		},
		required: ['emotion_label', 'stage_summary', 'drill_down', 'steps']
	};
}

function decisionSchemaFor(fragmentIdsInStage) {
	const panel = {
		type: 'array',
		items: {
			type: 'object',
			additionalProperties: false,
			properties: {
				title: { type: 'string' },
				body: { type: 'string' },
				supporting_fragment_ids: {
					type: 'array',
					items: { type: 'string', enum: fragmentIdsInStage }
				},
				confidence: { type: 'number' }
			},
			required: ['title', 'body', 'supporting_fragment_ids', 'confidence']
		}
	};
	return {
		type: 'object',
		additionalProperties: false,
		properties: {
			drivers: panel,
			barriers: panel,
			mixed: panel
		},
		required: ['drivers', 'barriers', 'mixed']
	};
}

// === Prompts ================================================================

const STAGE_SYSTEM_PROMPT = `You are a qualitative-research analyst synthesizing a journey-map artifact for a persona-defined slice of patient/caregiver voice. The artifact mirrors a polished sponsor-facing journey map: each stage gets a sentiment + emotion read, each step gets 1-4 observation pills (titled phrases, polarity-coded), and high-salience stages get a 2-3 sentence drill-down.

For the stage you're given, produce:

- emotion_label: ONE id from the codebook emotion vocabulary that best captures the stage's overall affect for this persona. Use "" if no single emotion dominates (mixed / contradictory). This MUST be a single id present in the vocabulary block below — either a primary-intensity id (e.g. joy, sadness, fear, anger, trust, disgust, surprise, anticipation, plus their low/high intensities like serenity/ecstasy, apprehension/terror) or a dyad id (e.g. ambivalence, hope, anxiety, optimism, despair, pride, frustration). Do not invent compound labels like "hope + sadness" — pick the single dyad that matches; the codebook entry defines what two primaries it blends. If genuinely no single id fits, return "".
- stage_summary: ONE sentence capturing what this stage feels like for this persona. Plain analyst voice.
- drill_down: include only if this stage carries an analytically rich tension worth a callout. include=false otherwise. When true, text is 2-3 sentences of analyst voice + supporting_fragment_ids cites 1-3 fragments.
- steps: per step_id in the taxonomy, generate 1-4 observation pills. Skip steps with 0 fragments. Empty step_id ("" — for stage-only-tagged fragments) is allowed and should be used when the fragment isn't anchored to a sub-step.

For each observation:
- title: 4-10 words, evocative, ALL CAPS or Title Case (pick one and use consistently). Reads like a journey-map pill. Examples from a reference oncology map: "PSA LEVELS RISE AFTER 10-MONTH STABLE PERIOD", "TREATMENT FATIGUE INTERPRETED AS GIVING UP", "FRANK DISCUSSION PROVIDES NEW CLARITY".
- polarity: positive (green pill — relief, success, hope materializing), negative (pink pill — friction, fear, failure), or mixed (when genuinely both).
- body: ONE sentence elaboration. Stays close to what fragments say; do not invent.
- supporting_fragment_ids: 1-5 fragment ids (enum-constrained) that ground this observation. Pick diverse fragments where possible.
- confidence: 0.0-1.0, your read of how well-evidenced this observation is.

Discipline:
- Synthesize observations across MULTIPLE fragments. A title like "Cost is a major concern" with one fragment cite is too thin — observations should generalize a pattern.
- Do not invent specifics not in the fragments. If only 2 patients mention something, say so in the body or downrate confidence — do not extrapolate.
- For thin steps (1-2 fragments), 1 observation is plenty. Don't pad.
- Bare well-wishes, congrats, and content-free fragments should NOT generate observations on their own. Skip them when synthesizing.

Use ONLY emotion ids in the vocabulary below; do NOT invent ids.

EMOTION VOCABULARY:
${JSON.stringify(emotionIds, null, 2)}`;

const DECISION_SYSTEM_PROMPT = `You are a qualitative-research analyst synthesizing a DRIVERS / BARRIERS panel for a decision-point stage of a persona's journey. This panel mirrors the polished oncology reference (the "Drivers to joining a study" / "Barriers to joining a study" boxes that anchor a clinical-trial decision point on a journey map).

For each panel item:
- title: 5-12 words. For drivers, frame as opportunity / lever ("DEDICATED PATIENT NAVIGATOR TEAM"). For barriers, frame as friction source ("FINANCIAL + LOGISTICAL CAPACITY ALREADY STRETCHED"). For mixed/awareness gaps, frame as factual / uncertain ("MUTED ENTHUSIASM DUE TO LIMITED GENE THERAPY AWARENESS"). All-caps or Title Case; pick one and use consistently across the panel.
- body: ONE sentence elaboration grounded in the fragments. Do not invent specifics.
- supporting_fragment_ids: 1-5 fragment ids (enum-constrained) that ground the item.
- confidence: 0.0-1.0.

Three buckets:
- drivers: the levers / opportunities / supports that pull patients toward engaging. Often these are RECOMMENDATIONS implicit in the corpus ("if only X existed, I'd consider it"). 3-6 items.
- barriers: the friction sources keeping patients away. Cost, distance, eligibility, work, caregivers, fear, side-effect anticipation. 3-6 items.
- mixed: factual / awareness / uncertainty items that aren't clearly driver or barrier. Often "knowledge gap" style. 0-3 items.

Discipline:
- Synthesize across fragments. Items should generalize a pattern visible in 2+ fragments where possible.
- Reflect what patients and caregivers actually say. The drivers panel is the patient-voiced wishlist, not a sponsor's deck of generic recommendations.
- Do not invent.`;

// === Per-stage synthesis ====================================================

const client = new Anthropic();

async function synthesizeStage(stageDef, stageFragments) {
	const fragmentPayload = stageFragments.map((f) => {
		const ann = annotations[f.id];
		return {
			fragment_id: f.id,
			text: f.text,
			stage_tags: (ann?.stages?.values ?? []).map((s) => ({ stage_id: s.stage_id, step_id: s.step_id })),
			sentiment_score: ann?.segment_tags?.sentiment_score ?? null,
			emotions: ann?.segment_tags?.emotions ?? [],
			themes: ann?.segment_tags?.themes ?? [],
			subthemes: ann?.segment_tags?.subthemes ?? []
		};
	});
	const fragmentIds = stageFragments.map((f) => f.id);
	const schema = stageSchemaFor(stageDef, fragmentIds);

	const stageContext = {
		stage_id: stageDef.id,
		label: stageDef.label,
		description: stageDef.description,
		steps: stageDef.steps.map((s) => ({ id: s.id, label: s.label, description: s.description })),
		persona: { id: persona.id, label: persona.label, description: persona.description },
		fragment_count: stageFragments.length,
		avg_sentiment: avg(stageSentiments.get(stageDef.id) ?? []),
		top_emotions: topCounts(stageEmotions.get(stageDef.id) ?? [], 5),
		top_themes: topCounts(stageThemes.get(stageDef.id) ?? [], 5)
	};

	const stream = client.messages.stream({
		model: MODEL,
		max_tokens: 16000,
		...(MODEL.includes('haiku') ? {} : { thinking: { type: 'adaptive' } }),
		output_config: MODEL.includes('haiku')
			? { format: { type: 'json_schema', schema } }
			: { effort: 'high', format: { type: 'json_schema', schema } },
		system: [{ type: 'text', text: STAGE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
		messages: [
			{
				role: 'user',
				content:
					`Synthesize the journey-map entries for stage "${stageDef.id}" (${stageDef.label}) of persona "${persona.label}".\n\n` +
					`STAGE CONTEXT:\n${JSON.stringify(stageContext, null, 2)}\n\n` +
					`FRAGMENTS (${fragmentPayload.length}):\n${JSON.stringify(fragmentPayload, null, 2)}`
			}
		]
	});

	const msg = await stream.finalMessage();
	const u = msg.usage;
	console.log(
		`    usage: in=${u.input_tokens} cache_write=${u.cache_creation_input_tokens} ` +
			`cache_read=${u.cache_read_input_tokens} out=${u.output_tokens}`
	);
	if (msg.stop_reason !== 'end_turn' && msg.stop_reason !== 'stop_sequence') {
		console.error(`x stage ${stageDef.id}: stop_reason=${msg.stop_reason}`);
		process.exit(1);
	}
	const text = msg.content.find((b) => b.type === 'text')?.text;
	if (!text) {
		console.error(`x stage ${stageDef.id}: no text in response`);
		process.exit(1);
	}
	return JSON.parse(text);
}

async function synthesizeDecisionPanel(stageDef, stageFragments) {
	const fragmentPayload = stageFragments.map((f) => {
		const ann = annotations[f.id];
		return {
			fragment_id: f.id,
			text: f.text,
			sentiment_score: ann?.segment_tags?.sentiment_score ?? null,
			emotions: ann?.segment_tags?.emotions ?? [],
			themes: ann?.segment_tags?.themes ?? [],
			subthemes: ann?.segment_tags?.subthemes ?? []
		};
	});
	const fragmentIds = stageFragments.map((f) => f.id);
	const schema = decisionSchemaFor(fragmentIds);

	const stream = client.messages.stream({
		model: MODEL,
		max_tokens: 12000,
		...(MODEL.includes('haiku') ? {} : { thinking: { type: 'adaptive' } }),
		output_config: MODEL.includes('haiku')
			? { format: { type: 'json_schema', schema } }
			: { effort: 'high', format: { type: 'json_schema', schema } },
		system: [{ type: 'text', text: DECISION_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
		messages: [
			{
				role: 'user',
				content:
					`Synthesize the drivers / barriers / mixed panels for the decision-point stage "${stageDef.id}" (${stageDef.label}) of persona "${persona.label}".\n\n` +
					`PERSONA: ${persona.description}\n\n` +
					`FRAGMENTS (${fragmentPayload.length}):\n${JSON.stringify(fragmentPayload, null, 2)}`
			}
		]
	});

	const msg = await stream.finalMessage();
	const u = msg.usage;
	console.log(
		`    usage: in=${u.input_tokens} cache_write=${u.cache_creation_input_tokens} ` +
			`cache_read=${u.cache_read_input_tokens} out=${u.output_tokens}`
	);
	if (msg.stop_reason !== 'end_turn' && msg.stop_reason !== 'stop_sequence') {
		console.error(`x decision ${stageDef.id}: stop_reason=${msg.stop_reason}`);
		process.exit(1);
	}
	const text = msg.content.find((b) => b.type === 'text')?.text;
	if (!text) {
		console.error(`x decision ${stageDef.id}: no text in response`);
		process.exit(1);
	}
	return JSON.parse(text);
}

// === Idempotency check ======================================================

const OUT_FILE = `${CORPUS_DIR}/artifacts/journey-map-${personaId}.json`;
if (existsSync(resolve(ROOT, OUT_FILE)) && !force) {
	console.error(`x Artifact already exists: ${OUT_FILE}`);
	console.error('  Pass --force to regenerate.');
	process.exit(1);
}

// === Main ===================================================================

console.log(`Synthesizing journey map for ${corpusId} / ${personaId}`);
console.log(`  Persona: ${persona.label}`);
console.log(`  Indication: ${indication}`);
console.log(`  Model: ${MODEL}`);
console.log(`  Matched fragments: ${matched.length}`);
console.log();

const stageMaps = [];
const decisionPanels = [];

for (const stageDef of journey.stages) {
	const stageFragments = fragmentsByStage.get(stageDef.id) ?? [];
	if (stageFragments.length === 0) {
		console.log(`  ${stageDef.id}: 0 fragments — skipping`);
		continue;
	}
	console.log(`  ${stageDef.id} (${stageFragments.length} fragments)...`);

	const result = await synthesizeStage(stageDef, stageFragments);

	stageMaps.push({
		stage_id: stageDef.id,
		label: stageDef.label,
		description: stageDef.description,
		fragment_count: stageFragments.length,
		avg_sentiment: avg(stageSentiments.get(stageDef.id) ?? []),
		emotion_label: result.emotion_label || null,
		stage_summary: result.stage_summary,
		drill_down: result.drill_down?.include
			? {
					text: result.drill_down.text,
					supporting_fragment_ids: result.drill_down.supporting_fragment_ids
				}
			: null,
		steps: result.steps.map((s) => ({
			step_id: s.step_id || null,
			label: stageDef.steps.find((d) => d.id === s.step_id)?.label ?? null,
			observations: s.observations.map((o) => ({
				title: o.title,
				polarity: o.polarity,
				body: o.body,
				supporting_fragment_ids: o.supporting_fragment_ids,
				confidence: o.confidence
			})),
			external_observations: [] // reserved for world-knowledge integration
		}))
	});

	if (DECISION_POINT_IDS.has(stageDef.id)) {
		console.log(`  ${stageDef.id} drivers/barriers panel...`);
		const panel = await synthesizeDecisionPanel(stageDef, stageFragments);
		decisionPanels.push({
			stage_id: stageDef.id,
			label: stageDef.label,
			drivers: panel.drivers,
			barriers: panel.barriers,
			mixed: panel.mixed
		});
	}
}

// === Write ==================================================================

const nowIso = new Date().toISOString();
const artifact = {
	meta: {
		schema_version: '0.1',
		corpus_id: corpusId,
		persona_id: personaId,
		persona_label: persona.label,
		persona_color: persona.color ?? null,
		journey_indication: indication,
		journey_schema_version: journey.meta?.schema_version ?? '1.0',
		generated_at: nowIso,
		generator: 'scripts/synthesize-journey-map.mjs',
		generator_version: SCRIPT_VERSION,
		model: MODEL,
		fragment_count_total: matched.length,
		stage_count: stageMaps.length,
		decision_point_count: decisionPanels.length,
		notes: [
			'Generative journey-map artifact. Stage observations + decision-point panels synthesized from corpus fragments via Claude with JSON-schema-constrained output.',
			'external_observations[] slot reserved on each step for future world-knowledge integration (PubMed / NCT / disease-insights).',
			'Re-run with: node scripts/synthesize-journey-map.mjs <corpus> <persona> --force'
		]
	},
	stages: stageMaps,
	decision_panels: decisionPanels
};

const outPath = resolve(ROOT, OUT_FILE);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(artifact, null, 2) + '\n', 'utf8');

console.log();
console.log(`Wrote ${OUT_FILE}`);
console.log(`  ${stageMaps.length} stage(s) synthesized; ${decisionPanels.length} decision panel(s).`);
const totalObs = stageMaps.reduce((n, s) => n + s.steps.reduce((m, st) => m + st.observations.length, 0), 0);
console.log(`  ${totalObs} observation(s) total.`);
