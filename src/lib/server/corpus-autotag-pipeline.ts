/**
 * Corpus autotag pipeline — in-process port of the propose-fragment-*.mjs
 * scripts. Lets the autotag chain run on Vercel where child processes aren't
 * available. Each proposer (themes / sentiment / stages) writes its own
 * dimension of the per-fragment annotation; the three are composed by
 * `runCorpusAutotagChain` in the order the .mjs chain has historically used.
 *
 * Reads + writes via corpus-store, so dev (fs) and prod (KV) share one path.
 * The standalone .mjs scripts remain the source of truth for CLI runs and
 * shape every choice here — when in doubt, the script wins and this file
 * gets updated.
 *
 * Requires ANTHROPIC_API_KEY in the environment.
 */
import Anthropic from '@anthropic-ai/sdk';
import bundledCodebook from '$lib/content/wctglpdemo-data/codebook.json';
import {
	loadCorpusManifest,
	loadCorpusFragments,
	loadCorpusAnnotations,
	saveCorpusAnnotations,
	loadJourneySchema
} from './corpus-store';
import type {
	AnnotationFile,
	Fragment,
	FragmentAnnotation,
	JourneySchema,
	SegmentTagsAnnotation,
	StagesAnnotation
} from '$lib/content/corpora/types';

const MODEL = 'claude-opus-4-7';

// === Codebook ===============================================================
// The codebook lives in wctglpdemo-data/ but is study-agnostic (3 universal
// themes × 21 subthemes; sentiment scale + emotion vocab). All three
// proposers use it.

type CodebookSubtheme = { id: string; label?: string; description?: string };
type CodebookTheme = {
	id: string;
	label?: string;
	description?: string;
	subthemes?: CodebookSubtheme[];
};
type CodebookEmotion = { id: string };
type Codebook = {
	meta?: { schema_version?: string; sentiment_scale?: unknown };
	themes: CodebookTheme[];
	emotion_tags: CodebookEmotion[];
};
const codebook = bundledCodebook as unknown as Codebook;

const themeIds = codebook.themes.map((t) => t.id);
const subthemeIds = codebook.themes.flatMap((t) => (t.subthemes ?? []).map((s) => s.id));
const subthemeToParentTheme = new Map<string, string>();
for (const t of codebook.themes) {
	for (const s of t.subthemes ?? []) subthemeToParentTheme.set(s.id, t.id);
}
const emotionIds = codebook.emotion_tags.map((e) => e.id);

// === Shared batching ========================================================
// Interview fragments group by interview_id; forum / social by post_id. The
// .mjs scripts share this exact predicate.

type ForumLikeRef = { kind: string; post_id?: string };
function batchKeyOf(fragment: Fragment): string {
	const r = fragment.source_ref as ForumLikeRef & { interview_id?: string };
	if (r.kind === 'interview' && r.interview_id) return r.interview_id;
	if (
		(r.kind === 'social_post' ||
			r.kind === 'social_comment' ||
			r.kind === 'forum_post' ||
			r.kind === 'blog_post') &&
		r.post_id
	) {
		return r.post_id;
	}
	return fragment.id;
}

// === Anthropic call helpers =================================================

let client: Anthropic | null = null;
function anthropic(): Anthropic {
	if (!client) client = new Anthropic();
	return client;
}

/** Wraps an Anthropic structured-output call with the same diagnostics +
 *  validation the scripts use: stop_reason guard, text-block extraction,
 *  JSON parse, coverage match. Returns the per-fragment map keyed by id. */
async function callProposer<TPerFragment extends { fragment_id: string }>(opts: {
	systemPrompt: string;
	userPrompt: string;
	schema: object;
	expectedIds: string[];
	batchKey: string;
}): Promise<Map<string, TPerFragment>> {
	// The Anthropic SDK's `messages.stream` types don't yet cover `thinking`
	// or the `output_config` structured-output shape, but they pass through to
	// the API. Cast to a flexible request type — the .mjs scripts use the
	// exact same fields and run cleanly.
	const stream = anthropic().messages.stream({
		model: MODEL,
		max_tokens: 32000,
		thinking: { type: 'adaptive' },
		output_config: {
			effort: 'high',
			format: { type: 'json_schema', schema: opts.schema as Record<string, unknown> }
		},
		system: [
			{ type: 'text', text: opts.systemPrompt, cache_control: { type: 'ephemeral' } }
		],
		messages: [{ role: 'user', content: opts.userPrompt }]
	} as unknown as Parameters<Anthropic['messages']['stream']>[0]);
	const msg = await stream.finalMessage();
	if (msg.stop_reason === 'max_tokens') {
		throw new Error(`${opts.batchKey}: hit max_tokens.`);
	}
	if (msg.stop_reason === 'refusal') {
		throw new Error(`${opts.batchKey}: model refused.`);
	}
	const textBlock = msg.content.find((b) => b.type === 'text') as
		| { type: 'text'; text: string }
		| undefined;
	if (!textBlock) {
		throw new Error(`${opts.batchKey}: no text block in response.`);
	}
	let parsed: { annotations?: TPerFragment[] };
	try {
		parsed = JSON.parse(textBlock.text);
	} catch (e) {
		throw new Error(
			`${opts.batchKey}: response was not valid JSON — ${(e as Error).message}`
		);
	}
	if (!Array.isArray(parsed.annotations)) {
		throw new Error(`${opts.batchKey}: no "annotations" array in response.`);
	}
	const got = new Map<string, TPerFragment>(
		parsed.annotations.map((a) => [a.fragment_id, a] as const)
	);
	const expected = opts.expectedIds;
	const missing = expected.filter((id) => !got.has(id));
	const extra = [...got.keys()].filter((id) => !expected.includes(id));
	if (missing.length || extra.length || got.size !== parsed.annotations.length) {
		const ms = missing.length ? `missing ${missing.length}: ${missing.slice(0, 6).join(', ')}` : '';
		const ex = extra.length ? `extra ${extra.length}: ${extra.slice(0, 6).join(', ')}` : '';
		throw new Error(
			`${opts.batchKey}: coverage mismatch — ${[ms, ex].filter(Boolean).join('; ')}`
		);
	}
	return got;
}

// === Shared partition iterator ==============================================
// All three proposers share the same shape: for each partition of the corpus,
// load fragments + existing annotations, prune stale, decide target batches
// (the ones not yet annotated for this proposer's gated field), call the
// proposer per batch, merge the result into the annotation record, write the
// updated annotations file back.

type RunResult = {
	partitionsProcessed: number;
	batchesAnnotated: number;
	fragmentsAnnotated: number;
};

async function runOverCorpus(opts: {
	corpusId: string;
	contentSourceFilter?: string;
	batchFilter?: string;
	force?: boolean;
	/** Returns true when the annotation record is already complete for this
	 *  proposer (e.g. has themes_generator set for the themes pass). */
	isFragmentDone: (ann: FragmentAnnotation | undefined) => boolean;
	/** Build (systemPrompt, userPrompt, schema) for one batch's fragments. */
	buildCall: (batchKey: string, fragments: Fragment[]) => {
		systemPrompt: string;
		userPrompt: string;
		schema: object;
	};
	/** Apply the model's per-fragment output onto the annotation record. */
	applyToRecord: (
		ann: FragmentAnnotation,
		modelOutput: Record<string, unknown>,
		nowIso: string
	) => void;
	/** Update the partition annotations file's meta.dimensions[...] block. */
	updateMeta: (
		file: AnnotationFile,
		annotatedBatches: string[],
		nowIso: string
	) => void;
}): Promise<RunResult> {
	const manifest = await loadCorpusManifest(opts.corpusId);
	if (!manifest) throw new Error(`Corpus ${opts.corpusId} has no manifest.`);

	const result: RunResult = {
		partitionsProcessed: 0,
		batchesAnnotated: 0,
		fragmentsAnnotated: 0
	};

	for (const partition of manifest.partitions) {
		const cs = partition.content_source;
		if (opts.contentSourceFilter && cs !== opts.contentSourceFilter) continue;
		const fragmentsDoc = await loadCorpusFragments(opts.corpusId, cs);
		if (!fragmentsDoc || fragmentsDoc.fragments.length === 0) continue;

		const partitionFragments = fragmentsDoc.fragments;
		const batches = new Map<string, Fragment[]>();
		for (const f of partitionFragments) {
			const key = batchKeyOf(f);
			const arr = batches.get(key) ?? [];
			arr.push(f);
			batches.set(key, arr);
		}
		const allBatches = [...batches.keys()].sort();

		// Existing annotations (prune stale ids that no longer exist in fragments).
		const existing: AnnotationFile = (await loadCorpusAnnotations(opts.corpusId, cs)) ?? {
			meta: {
				schema_version: '1.0',
				corpus_id: opts.corpusId,
				content_source: cs,
				updated_at: new Date().toISOString()
			},
			annotations: {}
		};
		const currentFragmentIds = new Set(partitionFragments.map((f) => f.id));
		const annotations: Record<string, FragmentAnnotation> = {};
		for (const [id, ann] of Object.entries(existing.annotations ?? {})) {
			if (currentFragmentIds.has(id)) annotations[id] = ann;
		}

		// Choose target batches.
		const isBatchDone = (key: string) =>
			(batches.get(key) ?? []).every((f) => opts.isFragmentDone(annotations[f.id]));
		let targets: string[];
		if (opts.batchFilter) {
			if (!batches.has(opts.batchFilter)) continue;
			targets = [opts.batchFilter];
		} else {
			targets = allBatches.filter((k) => opts.force || !isBatchDone(k));
		}
		if (targets.length === 0) {
			result.partitionsProcessed += 1;
			continue;
		}

		for (const key of targets) {
			const batchFragments = batches.get(key)!;
			const expectedIds = batchFragments.map((f) => f.id);
			const { systemPrompt, userPrompt, schema } = opts.buildCall(key, batchFragments);
			const got = await callProposer<{ fragment_id: string; [k: string]: unknown }>({
				systemPrompt,
				userPrompt,
				schema,
				expectedIds,
				batchKey: key
			});
			const nowIso = new Date().toISOString();
			for (const id of expectedIds) {
				const modelOutput = got.get(id)!;
				if (!annotations[id]) annotations[id] = {};
				opts.applyToRecord(annotations[id], modelOutput, nowIso);
			}
			result.batchesAnnotated += 1;
			result.fragmentsAnnotated += batchFragments.length;
		}

		// Recompute annotatedBatches over the full batch list so the meta accurately
		// reflects ALL batches currently complete (not just the ones this run
		// processed — earlier runs may have already filled some).
		const annotatedBatches = allBatches.filter(isBatchDone);
		const sortedAnnotations: Record<string, FragmentAnnotation> = {};
		for (const id of Object.keys(annotations).sort()) sortedAnnotations[id] = annotations[id];
		const outFile: AnnotationFile = {
			meta: existing.meta ?? {
				schema_version: '1.0',
				corpus_id: opts.corpusId,
				content_source: cs,
				updated_at: new Date().toISOString()
			},
			annotations: sortedAnnotations
		};
		opts.updateMeta(outFile, annotatedBatches, new Date().toISOString());
		await saveCorpusAnnotations(opts.corpusId, cs, outFile);
		result.partitionsProcessed += 1;
	}

	return result;
}

// === Themes proposer ========================================================

const themesSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		annotations: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					fragment_id: { type: 'string' },
					themes: { type: 'array', items: { type: 'string', enum: themeIds } },
					subthemes: { type: 'array', items: { type: 'string', enum: subthemeIds } },
					confidence: { type: 'number' },
					note: { type: 'string' }
				},
				required: ['fragment_id', 'themes', 'subthemes', 'confidence', 'note']
			}
		}
	},
	required: ['annotations']
};

const themesCodebookForPrompt = codebook.themes.map((t) => ({
	id: t.id,
	label: t.label,
	description: t.description,
	subthemes: (t.subthemes ?? []).map((s) => ({
		id: s.id,
		label: s.label,
		description: s.description
	}))
}));

const THEMES_SYSTEM_PROMPT = `You are a qualitative-research analyst tagging fragments of patient/caregiver voice with the codebook themes / subthemes they substantively touch.

The codebook below is STUDY-AGNOSTIC — three universal themes (Treatment, Clinical Trials, Condition-Specific), each with subthemes following a shared spine. Tag the same way regardless of which condition the corpus is about.

For every fragment you return:
- themes: an array of theme ids the fragment is genuinely ABOUT. 0 or more. Empty for admin / off-topic / bare-affirmation fragments.
- subthemes: an array of subtheme ids. 0 or more. A subtheme may ONLY appear if its parent theme is also in the themes array (validated after — DO NOT emit orphan subthemes).
- confidence: 0.0–1.0.
- note: short reviewer note, or "".

Guidance:
- Tag substantively, not on passing mentions. "I'm so excited for you!" gets themes=[], NOT clinical_trials.
- Many fragments touch one theme via several subthemes (e.g., a comment about cost + travel + caregiver burden could be clinical_trials × [trial_barriers, trial_decision_factors]).
- Cross-theme is common — e.g., refractory-treatment fragments often touch BOTH treatment (negative_experiences) AND clinical_trials (trial_motivators).
- Use ONLY ids from the codebook. Do not invent.
- For forum / social corpora: bare well-wishes, congrats, and questions without substantive content get themes=[], subthemes=[], confidence ~0.5, note explaining why.
- Read surrounding fragments (same batch, posted order) for context, but tag each on its own content.

CODEBOOK:
${JSON.stringify(themesCodebookForPrompt, null, 2)}`;

const THEMES_VERSION = 'propose-fragment-themes@0.1-inline';

export async function proposeFragmentThemes(
	corpusId: string,
	opts: { contentSource?: string; batch?: string; force?: boolean } = {}
): Promise<RunResult> {
	return runOverCorpus({
		corpusId,
		contentSourceFilter: opts.contentSource,
		batchFilter: opts.batch,
		force: opts.force,
		isFragmentDone: (ann) => ann?.segment_tags?.themes_generator != null,
		buildCall: (batchKey, batchFragments) => ({
			systemPrompt: THEMES_SYSTEM_PROMPT,
			userPrompt:
				`Tag every fragment of batch "${batchKey}" with themes + subthemes. ` +
				`Return exactly one annotation per fragment, using the same fragment_id. ` +
				`Fragments, in posted order:\n\n${JSON.stringify(
					batchFragments.map((f) => ({ fragment_id: f.id, text: f.text })),
					null,
					2
				)}`,
			schema: themesSchema
		}),
		applyToRecord: (record, out, nowIso) => {
			// Subtheme→parent validation (mirrors the script). Auto-add the parent
			// when the LLM forgot it; throw on unknown subtheme.
			const themes = Array.isArray(out.themes) ? [...(out.themes as string[])] : [];
			const subthemes = Array.isArray(out.subthemes) ? (out.subthemes as string[]) : [];
			for (const sub of subthemes) {
				const parent = subthemeToParentTheme.get(sub);
				if (!parent) {
					throw new Error(`subtheme "${sub}" is not in the codebook.`);
				}
				if (!themes.includes(parent)) themes.push(parent);
			}
			const prior = record.segment_tags ?? ({} as SegmentTagsAnnotation);
			record.segment_tags = {
				themes,
				subthemes,
				emotions: prior.emotions ?? [],
				topics: prior.topics ?? [],
				sentiment_score: prior.sentiment_score ?? null,
				confidence: prior.confidence ?? null,
				note: prior.note ?? '',
				source: prior.source ?? 'ai_proposed',
				review_status: prior.review_status ?? 'pending',
				themes_generator: THEMES_VERSION,
				themes_generated_at: nowIso,
				themes_confidence: typeof out.confidence === 'number' ? out.confidence : 0,
				themes_note: typeof out.note === 'string' ? out.note : ''
			};
		},
		updateMeta: (file, annotatedBatches, nowIso) => {
			const meta = (file.meta as Record<string, unknown>) ?? {};
			const dimensions = ((meta.dimensions as Record<string, unknown>) ?? {});
			const segDim = ((dimensions.segment_tags as Record<string, unknown>) ?? {});
			const fieldsPopulated = new Set([
				...((segDim.fields_populated as string[]) ?? []).filter(
					(f) => f !== 'themes' && f !== 'subthemes'
				),
				'themes',
				'subthemes'
			]);
			dimensions.segment_tags = {
				...segDim,
				themes_generator: 'src/lib/server/corpus-autotag-pipeline.ts#proposeFragmentThemes',
				themes_model: MODEL,
				themes_codebook_schema_version: codebook.meta?.schema_version ?? null,
				themes_last_generated_at: nowIso,
				themes_annotated_batches: annotatedBatches,
				fields_populated: [...fieldsPopulated]
			};
			meta.dimensions = dimensions;
			meta.updated_at = nowIso;
			file.meta = meta as AnnotationFile['meta'];
		}
	});
}

// === Sentiment proposer =====================================================

const sentimentSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		annotations: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				properties: {
					fragment_id: { type: 'string' },
					sentiment_score: { type: 'integer', enum: [-2, -1, 0, 1, 2] },
					emotions: { type: 'array', items: { type: 'string', enum: emotionIds } },
					confidence: { type: 'number' },
					note: { type: 'string' }
				},
				required: ['fragment_id', 'sentiment_score', 'emotions', 'confidence', 'note']
			}
		}
	},
	required: ['annotations']
};

const SENTIMENT_SYSTEM_PROMPT = `You are a qualitative-research analyst tagging fragments of patient/caregiver voice for sentiment and emotion.

For every fragment you return:
- sentiment_score: an integer on this scale:
${JSON.stringify(codebook.meta?.sentiment_scale, null, 2)}
- emotions: an array of emotion ids the speaker is expressing. 0 or more — DO NOT over-tag. A bare "good luck!" or "congrats" is best left empty, or with a single emotion like "hope" or "joy" at low confidence.
- confidence: overall confidence in the annotation, 0.0–1.0.
- note: short reviewer note or "" if none. Use it for ambiguity or low-confidence calls.

Guidance:
- Bare affirmations, well-wishes, congrats, and content-free fragments: sentiment 0 or +1, emotions [] or one low-confidence emotion, confidence ~0.5, note explaining "bare well-wishes" or similar.
- Reflect the SPEAKER's emotional state in this fragment — not what the topic generally evokes. ("CAR-T is intense" said matter-of-factly is sentiment 0; "I'm terrified of CAR-T" is sentiment -1 or -2 with fear/apprehension.)
- For caregivers describing a loved one's experience, capture the caregiver's emotion (often grief, fear, hope), not the loved one's.
- Use ONLY emotion ids from the list below. Do not invent ids.
- Read the surrounding fragments (same batch, in posted order) for context, but tag each fragment on its own content.

EMOTION VOCABULARY (the only valid ids):
${JSON.stringify(emotionIds, null, 2)}`;

export async function proposeFragmentSentiment(
	corpusId: string,
	opts: { contentSource?: string; batch?: string; force?: boolean } = {}
): Promise<RunResult> {
	return runOverCorpus({
		corpusId,
		contentSourceFilter: opts.contentSource,
		batchFilter: opts.batch,
		force: opts.force,
		isFragmentDone: (ann) => ann?.segment_tags?.sentiment_score != null,
		buildCall: (batchKey, batchFragments) => ({
			systemPrompt: SENTIMENT_SYSTEM_PROMPT,
			userPrompt:
				`Tag every fragment of batch "${batchKey}" for sentiment and emotion. ` +
				`Return exactly one annotation per fragment, using the same fragment_id. ` +
				`Fragments, in posted order:\n\n${JSON.stringify(
					batchFragments.map((f) => ({ fragment_id: f.id, text: f.text })),
					null,
					2
				)}`,
			schema: sentimentSchema
		}),
		applyToRecord: (record, out) => {
			const prior = record.segment_tags ?? ({} as SegmentTagsAnnotation);
			record.segment_tags = {
				themes: prior.themes ?? [],
				subthemes: prior.subthemes ?? [],
				emotions: Array.isArray(out.emotions) ? (out.emotions as string[]) : [],
				topics: prior.topics ?? [],
				sentiment_score: typeof out.sentiment_score === 'number' ? out.sentiment_score : 0,
				confidence: typeof out.confidence === 'number' ? out.confidence : null,
				note: typeof out.note === 'string' ? out.note : '',
				source: 'ai_proposed',
				review_status: 'pending',
				...(prior.themes_generator ? { themes_generator: prior.themes_generator } : {}),
				...(prior.themes_generated_at
					? { themes_generated_at: prior.themes_generated_at }
					: {}),
				...(prior.themes_confidence != null
					? { themes_confidence: prior.themes_confidence }
					: {}),
				...(prior.themes_note ? { themes_note: prior.themes_note } : {})
			};
		},
		updateMeta: (file, annotatedBatches, nowIso) => {
			const meta = (file.meta as Record<string, unknown>) ?? {};
			const dimensions = ((meta.dimensions as Record<string, unknown>) ?? {});
			const segDim = ((dimensions.segment_tags as Record<string, unknown>) ?? {});
			const priorFields = new Set([
				...((segDim.fields_populated as string[]) ?? []),
				'sentiment_score',
				'emotions',
				'confidence',
				'note'
			]);
			dimensions.segment_tags = {
				...segDim,
				generator: 'src/lib/server/corpus-autotag-pipeline.ts#proposeFragmentSentiment',
				model: MODEL,
				codebook_schema_version: codebook.meta?.schema_version ?? null,
				last_generated_at: nowIso,
				annotated_batches: annotatedBatches,
				fields_populated: [...priorFields]
			};
			meta.dimensions = dimensions;
			meta.updated_at = nowIso;
			file.meta = meta as AnnotationFile['meta'];
		}
	});
}

// === Stages proposer ========================================================

export async function proposeFragmentStages(
	corpusId: string,
	opts: { contentSource?: string; batch?: string; force?: boolean } = {}
): Promise<RunResult> {
	const manifest = await loadCorpusManifest(corpusId);
	if (!manifest) throw new Error(`Corpus ${corpusId} has no manifest.`);
	const indication = manifest.indications?.[0];
	if (!indication) throw new Error(`Corpus ${corpusId} has no indication; can't load journey.`);
	const journey: JourneySchema | null = await loadJourneySchema(indication);
	if (!journey) throw new Error(`Journey schema for "${indication}" not found.`);

	const stageIds = journey.stages.map((s) => s.id);
	const stepIds = journey.stages.flatMap((s) => s.steps.map((step) => step.id));
	const stepToParentStage = new Map<string, string>();
	for (const s of journey.stages) {
		for (const step of s.steps) stepToParentStage.set(step.id, s.id);
	}

	const stagesSchema = {
		type: 'object',
		additionalProperties: false,
		properties: {
			annotations: {
				type: 'array',
				items: {
					type: 'object',
					additionalProperties: false,
					properties: {
						fragment_id: { type: 'string' },
						stages: {
							type: 'array',
							items: {
								type: 'object',
								additionalProperties: false,
								properties: {
									stage_id: { type: 'string', enum: stageIds },
									step_id: { type: 'string', enum: [...stepIds, ''] },
									confidence: { type: 'number' }
								},
								required: ['stage_id', 'step_id', 'confidence']
							}
						},
						confidence: { type: 'number' },
						note: { type: 'string' }
					},
					required: ['fragment_id', 'stages', 'confidence', 'note']
				}
			}
		},
		required: ['annotations']
	};

	const journeyForPrompt = journey.stages.map((s) => ({
		id: s.id,
		order: s.order,
		label: s.label,
		description: s.description,
		steps: s.steps.map((step) => ({
			id: step.id,
			label: step.label,
			description: step.description
		}))
	}));

	const STAGES_SYSTEM_PROMPT = `You are a qualitative-research analyst tagging fragments of patient/caregiver voice with the journey stage(s) they discuss.

You are given a per-indication CLINICAL JOURNEY TAXONOMY below. For each fragment, decide which stage(s) the fragment is genuinely ABOUT — not which stage the speaker is currently in (a person in maintenance can reminisce about diagnosis; a community member can ask about a stage they aren't in). Multi-label is allowed and expected; many fragments straddle two adjacent stages.

For every fragment you return:
- stages: an array of { stage_id, step_id, confidence }.
  - 0 stages when the fragment is admin / off-topic / a bare affirmation / well-wishes-only / content-free.
  - 1 stage when the fragment is clearly anchored.
  - 2+ stages when the fragment genuinely spans (e.g. "I went off it because the cost was too much, and then I started gaining again" → discontinuation/cost AND post-discontinuation/regain).
  - step_id is the finer-grained sub-step inside the stage. Use "" (empty string) when the fragment is about the stage broadly but no specific step applies.
  - confidence is your confidence in THAT stage assignment, 0.0–1.0.
- confidence: overall confidence in the whole annotation, 0.0–1.0.
- note: a short reviewer note, or "" if none. Use it to flag ambiguity or explain a low-confidence call (e.g. "off-topic for this indication's taxonomy" or "ambiguous between stages X and Y").

Guidance:
- Use ONLY stage_ids and step_ids in the taxonomy below. Do not invent ids. step_id MUST be a step inside the chosen stage_id (validated after).
- Forum / social fragments include a lot of well-wishes, congrats, and short questions. These get stages=[] with a note explaining why (e.g. "bare well-wishes, no substantive content").
- Read the surrounding fragments (same batch, in posted order) for context, but tag each fragment on its own content.
- A fragment that mentions a stage in passing without being substantively about it should NOT get tagged with that stage.
- Hypothetical or attitudinal framing ("if I tried CAR-T, I'd worry about the chemo conditioning") still tags into the stage being discussed.
- For patient/caregiver community forums, reflect the speaker's framing: a caregiver describing their loved one's CAR-T hospitalization tags into the in-trial-experience stages, even though the caregiver isn't the patient.

CLINICAL JOURNEY TAXONOMY — ${journey.meta.label}:
${JSON.stringify(journeyForPrompt, null, 2)}`;

	return runOverCorpus({
		corpusId,
		contentSourceFilter: opts.contentSource,
		batchFilter: opts.batch,
		force: opts.force,
		isFragmentDone: (ann) => ann?.stages != null,
		buildCall: (batchKey, batchFragments) => ({
			systemPrompt: STAGES_SYSTEM_PROMPT,
			userPrompt:
				`Tag every fragment of batch "${batchKey}". ` +
				`Return exactly one annotation per fragment, using the same fragment_id. ` +
				`Fragments, in posted order:\n\n${JSON.stringify(
					batchFragments.map((f) => ({ fragment_id: f.id, text: f.text })),
					null,
					2
				)}`,
			schema: stagesSchema
		}),
		applyToRecord: (record, out) => {
			const rawStages = (out.stages ?? []) as Array<{
				stage_id: string;
				step_id: string;
				confidence: number;
			}>;
			// step_id ∈ stage_id validation (the JSON schema enum can't express
			// the parent-child constraint).
			for (const s of rawStages) {
				if (s.step_id !== '' && stepToParentStage.get(s.step_id) !== s.stage_id) {
					throw new Error(
						`step_id "${s.step_id}" does not belong to stage_id "${s.stage_id}"`
					);
				}
			}
			const next: StagesAnnotation = {
				values: rawStages.map((s) => ({
					stage_id: s.stage_id,
					step_id: s.step_id || null,
					confidence: s.confidence
				})),
				overall_confidence:
					typeof out.confidence === 'number' ? out.confidence : 0.5,
				note: typeof out.note === 'string' ? out.note : '',
				source: 'ai_proposed',
				review_status: 'pending'
			};
			record.stages = next;
		},
		updateMeta: (file, annotatedBatches, nowIso) => {
			const meta = (file.meta as Record<string, unknown>) ?? {};
			const dimensions = ((meta.dimensions as Record<string, unknown>) ?? {});
			dimensions.stages = {
				generator: 'src/lib/server/corpus-autotag-pipeline.ts#proposeFragmentStages',
				model: MODEL,
				indication,
				journey_schema_version: journey.meta.schema_version,
				last_generated_at: nowIso,
				annotated_batches: annotatedBatches
			};
			meta.dimensions = dimensions;
			meta.updated_at = nowIso;
			file.meta = meta as AnnotationFile['meta'];
		}
	});
}

// === Chain entry point ======================================================

export type ChainStepReporter = (label: string) => void;

/** Run the three proposers in order (themes → sentiment → stages), reporting
 *  step labels via `onStep`. Each step writes its dimension via corpus-store
 *  and self-skips already-annotated batches, so re-running this on a
 *  partially-tagged corpus only processes the new work. */
export async function runCorpusAutotagChain(
	corpusId: string,
	onStep: ChainStepReporter
): Promise<{
	themes: RunResult;
	sentiment: RunResult;
	stages: RunResult;
}> {
	onStep('Proposing themes');
	const themes = await proposeFragmentThemes(corpusId);
	onStep('Proposing sentiment + emotions');
	const sentiment = await proposeFragmentSentiment(corpusId);
	onStep('Proposing journey stages');
	const stages = await proposeFragmentStages(corpusId);
	return { themes, sentiment, stages };
}
