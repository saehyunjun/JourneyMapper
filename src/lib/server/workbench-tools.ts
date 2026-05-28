/**
 * server/workbench-tools.ts
 *
 * Tool surface for the Journey Workbench "ask" endpoint. Every question the
 * model answers must be composed from tool results — the model never sees raw
 * fragment text except via get_fragments, which only returns text for IDs the
 * model already named. Counts and rankings come from tool results, not free
 * generation, so the answer is structurally grounded in the corpus.
 *
 * State model: each /ask request creates a fresh WorkbenchSession that owns an
 * in-memory map of filter handles. Handles live only for the lifetime of the
 * tool-use loop; cross-request continuity is not supported by design.
 */

import { fragmentMatchesPersona } from '$lib/content/personas/evaluate';
import type { Persona } from '$lib/content/personas/types';
import type { Fragment } from '$lib/content/corpora/types';
import type { JourneyMap } from '$lib/content/journeys/types';
import {
	listCorpora,
	listJourneys,
	loadProfilesForCorpus,
	type CorpusBundle,
	type FragmentAnnotation
} from './corpora';
import { listPersonas } from './personas';

/** Annotations keyed by fragment_id. Uses the fuller server/corpora shape
 *  (includes topics, which the persona-evaluator's narrower shape omits). */
type AnnotationsMap = Record<string, FragmentAnnotation>;

// ---------------------------------------------------------------------------
// Context (one per request)
// ---------------------------------------------------------------------------

export type WorkbenchContext = {
	indication: string;
	corpora: CorpusBundle[];
	personas: Persona[];
	journey: JourneyMap | null;
	/** Flat fragment list across all visible corpora for the indication. */
	fragments: Fragment[];
	/** fragment_id -> annotation (merged across corpora). */
	annotations: AnnotationsMap;
	/** speaker_id -> { first_name?, last_initial?, ... } (best-effort, merged across corpora). */
	profiles: Record<string, Record<string, unknown>>;
	/** Codebook themes/subthemes index, derived from segment_tags presence. */
	taxonomy: TaxonomyView;
};

export type TaxonomyView = {
	indication: string;
	journey_stages: Array<{
		id: string;
		label: string;
		description: string;
		steps: Array<{ id: string; label: string; description: string }>;
	}>;
	themes: string[];
	subthemes: string[];
	topics: string[];
	emotions: string[];
	roles: string[];
	personas: Array<{ id: string; label: string; description: string }>;
	sentiment_scale: Record<number, string>;
};

const SENTIMENT_LABELS: Record<number, string> = {
	[-2]: 'strongly negative',
	[-1]: 'negative',
	0: 'neutral / mixed',
	1: 'positive',
	2: 'strongly positive'
};

export function loadWorkbenchContext(indication: string): WorkbenchContext {
	const allCorpora = listCorpora();
	const personas = listPersonas().filter((p) =>
		p.applicable_indications.includes(indication as never)
	);
	const corpora = allCorpora.filter((c) => c.manifest.indications.includes(indication as never));
	const journeys = listJourneys();
	const journey = journeys[indication] ?? null;

	const fragments: Fragment[] = [];
	const annotations: AnnotationsMap = {};
	const profiles: Record<string, Record<string, unknown>> = {};
	for (const c of corpora) {
		fragments.push(...c.fragments);
		Object.assign(annotations, c.annotations as Record<string, FragmentAnnotation>);
		Object.assign(profiles, loadProfilesForCorpus(c.manifest.id));
	}

	const themes = new Set<string>();
	const subthemes = new Set<string>();
	const topics = new Set<string>();
	const emotions = new Set<string>();
	const roles = new Set<string>();
	for (const ann of Object.values(annotations)) {
		const tags = ann.segment_tags;
		if (!tags) continue;
		for (const t of tags.themes ?? []) themes.add(t);
		for (const s of tags.subthemes ?? []) subthemes.add(s);
		for (const t of tags.topics ?? []) topics.add(t);
		for (const e of tags.emotions ?? []) emotions.add(e);
	}
	for (const f of fragments) {
		const r = f.speaker_attrs?.role?.value;
		if (r) roles.add(String(r));
	}

	const taxonomy: TaxonomyView = {
		indication,
		journey_stages: (journey?.stages ?? []).map((s) => ({
			id: s.id,
			label: s.label,
			description: s.description,
			steps: s.steps.map((st) => ({ id: st.id, label: st.label, description: st.description }))
		})),
		themes: [...themes].sort(),
		subthemes: [...subthemes].sort(),
		topics: [...topics].sort(),
		emotions: [...emotions].sort(),
		roles: [...roles].sort(),
		personas: personas.map((p) => ({ id: p.id, label: p.label, description: p.description })),
		sentiment_scale: SENTIMENT_LABELS
	};

	return { indication, corpora, personas, journey, fragments, annotations, profiles, taxonomy };
}

// ---------------------------------------------------------------------------
// Filter handles (per-session, in-memory)
// ---------------------------------------------------------------------------

export type FilterPredicate = {
	persona_id?: string;
	stage_ids?: string[];
	step_ids?: string[];
	theme_ids?: string[];
	subtheme_ids?: string[];
	topic_ids?: string[];
	emotion_ids?: string[];
	sentiment_min?: number;
	sentiment_max?: number;
	role?: string;
	content_sources?: string[];
};

export type WorkbenchSession = {
	ctx: WorkbenchContext;
	handles: Map<string, { predicate: FilterPredicate; fragment_ids: string[] }>;
	handleSeq: number;
};

export function createSession(ctx: WorkbenchContext): WorkbenchSession {
	return { ctx, handles: new Map(), handleSeq: 0 };
}

function speakerIdOf(f: Fragment): string {
	if (f.source_ref.kind === 'interview') return f.source_ref.interview_id;
	const ref = f.source_ref as { author_handle_hash?: string };
	return ref.author_handle_hash ?? '(unknown)';
}

function speakerLabel(f: Fragment, ctx: WorkbenchContext): string {
	const id = speakerIdOf(f);
	const p = ctx.profiles[id] as { first_name?: string; last_initial?: string } | undefined;
	if (p) {
		const fn = p.first_name?.trim() ?? '';
		const li = p.last_initial?.trim() ?? '';
		const formed = [fn, li ? `${li}.` : ''].filter(Boolean).join(' ');
		if (formed) return formed;
	}
	return id;
}

function applyPredicate(
	predicate: FilterPredicate,
	ctx: WorkbenchContext
): Fragment[] {
	const persona = predicate.persona_id
		? ctx.personas.find((p) => p.id === predicate.persona_id)
		: null;
	if (predicate.persona_id && !persona) {
		throw new Error(
			`unknown persona_id "${predicate.persona_id}". Valid ids: ${ctx.personas.map((p) => p.id).join(', ')}`
		);
	}

	return ctx.fragments.filter((f) => {
		if (persona && !fragmentMatchesPersona(f, persona, ctx.annotations)) return false;
		const ann = ctx.annotations[f.id];
		const tags = ann?.segment_tags;
		const stages = ann?.stages?.values ?? [];

		if (predicate.stage_ids?.length) {
			if (!stages.some((s) => predicate.stage_ids!.includes(s.stage_id))) return false;
		}
		if (predicate.step_ids?.length) {
			if (!stages.some((s) => s.step_id !== null && predicate.step_ids!.includes(s.step_id)))
				return false;
		}
		if (predicate.theme_ids?.length) {
			if (!(tags?.themes ?? []).some((t) => predicate.theme_ids!.includes(t))) return false;
		}
		if (predicate.subtheme_ids?.length) {
			if (!(tags?.subthemes ?? []).some((s) => predicate.subtheme_ids!.includes(s))) return false;
		}
		if (predicate.topic_ids?.length) {
			if (!(tags?.topics ?? []).some((t) => predicate.topic_ids!.includes(t))) return false;
		}
		if (predicate.emotion_ids?.length) {
			if (!(tags?.emotions ?? []).some((e) => predicate.emotion_ids!.includes(e))) return false;
		}
		if (predicate.sentiment_min !== undefined || predicate.sentiment_max !== undefined) {
			const s = tags?.sentiment_score;
			if (typeof s !== 'number') return false;
			if (predicate.sentiment_min !== undefined && s < predicate.sentiment_min) return false;
			if (predicate.sentiment_max !== undefined && s > predicate.sentiment_max) return false;
		}
		if (predicate.role) {
			const r = f.speaker_attrs?.role?.value;
			if (r !== predicate.role) return false;
		}
		if (predicate.content_sources?.length) {
			if (!predicate.content_sources.includes(f.content_source)) return false;
		}
		return true;
	});
}

function newHandle(session: WorkbenchSession, predicate: FilterPredicate, fragment_ids: string[]) {
	session.handleSeq += 1;
	const handle = `h_${session.handleSeq.toString(36)}`;
	session.handles.set(handle, { predicate, fragment_ids });
	return handle;
}

function resolveHandle(session: WorkbenchSession, handle: string) {
	const entry = session.handles.get(handle);
	if (!entry) {
		throw new Error(
			`unknown handle "${handle}". Call filter_fragments to obtain one. Known handles: ${[...session.handles.keys()].join(', ') || '(none)'}`
		);
	}
	return entry;
}

// ---------------------------------------------------------------------------
// Tool definitions (Anthropic tool-use schema)
// ---------------------------------------------------------------------------

export const TOOL_DEFS = [
	{
		name: 'get_taxonomy',
		description:
			'Return the live taxonomy for the active indication: journey stages/steps, themes, subthemes, topics, emotions, speaker roles, personas, sentiment scale. ALWAYS call this first to learn the exact IDs you can pass to filter_fragments. Never invent IDs.',
		input_schema: {
			type: 'object',
			properties: {},
			additionalProperties: false
		}
	},
	{
		name: 'filter_fragments',
		description:
			'Build a filter over the fragment pool and return a handle plus a count. All filters AND together. Use the IDs returned by get_taxonomy — unknown IDs are rejected. The handle is the only way to pass a filtered set to rank_by_dimension, crosstab, get_fragments, or search_fragments. Cheap to call repeatedly with different filter combinations.',
		input_schema: {
			type: 'object',
			properties: {
				persona_id: {
					type: 'string',
					description: 'Optional persona id from get_taxonomy.personas[].id'
				},
				stage_ids: { type: 'array', items: { type: 'string' } },
				step_ids: { type: 'array', items: { type: 'string' } },
				theme_ids: { type: 'array', items: { type: 'string' } },
				subtheme_ids: { type: 'array', items: { type: 'string' } },
				topic_ids: { type: 'array', items: { type: 'string' } },
				emotion_ids: { type: 'array', items: { type: 'string' } },
				sentiment_min: { type: 'integer', minimum: -2, maximum: 2 },
				sentiment_max: { type: 'integer', minimum: -2, maximum: 2 },
				role: { type: 'string', description: 'Speaker role (e.g. patient, caregiver, clinician)' },
				content_sources: { type: 'array', items: { type: 'string' } }
			},
			additionalProperties: false
		}
	},
	{
		name: 'rank_by_dimension',
		description:
			'Group the fragments behind a handle by one dimension and return ranked counts plus up to 3 sample fragment_ids per bucket. Use this to answer "most/least discussed X" questions.',
		input_schema: {
			type: 'object',
			properties: {
				handle: { type: 'string' },
				dimension: {
					type: 'string',
					enum: ['theme', 'subtheme', 'topic', 'stage', 'step', 'speaker', 'sentiment', 'emotion', 'role']
				},
				limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 }
			},
			required: ['handle', 'dimension'],
			additionalProperties: false
		}
	},
	{
		name: 'crosstab',
		description:
			'2D count matrix over two dimensions for the fragments behind a handle. Each cell includes up to 2 sample fragment_ids. Use for questions like "where on the journey is sentiment worst" → crosstab(stage, sentiment).',
		input_schema: {
			type: 'object',
			properties: {
				handle: { type: 'string' },
				row_dimension: {
					type: 'string',
					enum: ['theme', 'subtheme', 'topic', 'stage', 'step', 'sentiment', 'emotion', 'role']
				},
				col_dimension: {
					type: 'string',
					enum: ['theme', 'subtheme', 'topic', 'stage', 'step', 'sentiment', 'emotion', 'role']
				}
			},
			required: ['handle', 'row_dimension', 'col_dimension'],
			additionalProperties: false
		}
	},
	{
		name: 'get_fragments',
		description:
			'Return full text + annotations + speaker label for up to 10 fragments. Either pass an explicit fragment_ids list (preferred — used to fetch citations you plan to quote) OR pass order_by to get the top N from the handle. Every id must exist or the tool errors.',
		input_schema: {
			type: 'object',
			properties: {
				handle: { type: 'string' },
				fragment_ids: { type: 'array', items: { type: 'string' }, maxItems: 10 },
				order_by: {
					type: 'string',
					enum: ['most_negative', 'most_positive', 'most_recent', 'first']
				},
				limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 }
			},
			required: ['handle'],
			additionalProperties: false
		}
	},
	{
		name: 'search_fragments',
		description:
			'Lexical substring search over fragment text within the handle\'s set. Use only when no codebook tag captures the concept (e.g. user asks about "needle phobia" and there is no matching subtheme/topic). Returns up to 10 fragment_ids ranked by match count; follow up with get_fragments to read them.',
		input_schema: {
			type: 'object',
			properties: {
				handle: { type: 'string' },
				query: { type: 'string', minLength: 2 },
				limit: { type: 'integer', minimum: 1, maximum: 10, default: 10 }
			},
			required: ['handle', 'query'],
			additionalProperties: false
		}
	},
	{
		name: 'get_speaker_voice',
		description:
			'Return a speaker profile + up to 20 of their other fragments. Use to follow up "tell me more about that speaker" or to verify a quote is in character with the rest of their voice.',
		input_schema: {
			type: 'object',
			properties: {
				speaker_id: { type: 'string' },
				limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 }
			},
			required: ['speaker_id'],
			additionalProperties: false
		}
	}
] as const;

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };

export async function executeTool(
	name: string,
	input: Record<string, unknown>,
	session: WorkbenchSession
): Promise<ToolResult> {
	try {
		switch (name) {
			case 'get_taxonomy':
				return { ok: true, data: session.ctx.taxonomy };
			case 'filter_fragments':
				return { ok: true, data: toolFilterFragments(input, session) };
			case 'rank_by_dimension':
				return { ok: true, data: toolRank(input, session) };
			case 'crosstab':
				return { ok: true, data: toolCrosstab(input, session) };
			case 'get_fragments':
				return { ok: true, data: toolGetFragments(input, session) };
			case 'search_fragments':
				return { ok: true, data: toolSearchFragments(input, session) };
			case 'get_speaker_voice':
				return { ok: true, data: toolGetSpeakerVoice(input, session) };
			default:
				return { ok: false, error: `unknown tool "${name}"` };
		}
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
}

function toolFilterFragments(input: Record<string, unknown>, session: WorkbenchSession) {
	const predicate = input as FilterPredicate;
	validateIds(predicate, session.ctx);
	const matched = applyPredicate(predicate, session.ctx);
	const ids = matched.map((f) => f.id);
	const handle = newHandle(session, predicate, ids);
	return { handle, count: ids.length };
}

function validateIds(p: FilterPredicate, ctx: WorkbenchContext) {
	const stageIds = new Set(ctx.taxonomy.journey_stages.map((s) => s.id));
	const stepIds = new Set(ctx.taxonomy.journey_stages.flatMap((s) => s.steps.map((st) => st.id)));
	const themeIds = new Set(ctx.taxonomy.themes);
	const subthemeIds = new Set(ctx.taxonomy.subthemes);
	const topicIds = new Set(ctx.taxonomy.topics);
	const emotionIds = new Set(ctx.taxonomy.emotions);
	const roleIds = new Set(ctx.taxonomy.roles);

	const check = (ids: string[] | undefined, valid: Set<string>, kind: string) => {
		if (!ids) return;
		for (const id of ids) {
			if (!valid.has(id)) {
				throw new Error(
					`unknown ${kind} "${id}". Call get_taxonomy first — valid ${kind}s: ${[...valid].slice(0, 12).join(', ')}${valid.size > 12 ? ', …' : ''}`
				);
			}
		}
	};

	check(p.stage_ids, stageIds, 'stage_id');
	check(p.step_ids, stepIds, 'step_id');
	check(p.theme_ids, themeIds, 'theme_id');
	check(p.subtheme_ids, subthemeIds, 'subtheme_id');
	check(p.topic_ids, topicIds, 'topic_id');
	check(p.emotion_ids, emotionIds, 'emotion_id');
	if (p.role && !roleIds.has(p.role)) {
		throw new Error(`unknown role "${p.role}". Valid roles: ${[...roleIds].join(', ')}`);
	}
}

type Dim = 'theme' | 'subtheme' | 'topic' | 'stage' | 'step' | 'speaker' | 'sentiment' | 'emotion' | 'role';

function bucketKeys(f: Fragment, ctx: WorkbenchContext, dim: Dim): string[] {
	const ann = ctx.annotations[f.id];
	const tags = ann?.segment_tags;
	const stages = ann?.stages?.values ?? [];
	switch (dim) {
		case 'theme':
			return tags?.themes ?? [];
		case 'subtheme':
			return tags?.subthemes ?? [];
		case 'topic':
			return tags?.topics ?? [];
		case 'emotion':
			return tags?.emotions ?? [];
		case 'stage':
			return [...new Set(stages.map((s) => s.stage_id))];
		case 'step':
			return [...new Set(stages.map((s) => s.step_id).filter((x): x is string => x !== null))];
		case 'speaker':
			return [speakerIdOf(f)];
		case 'sentiment': {
			const s = tags?.sentiment_score;
			return typeof s === 'number' ? [String(s)] : [];
		}
		case 'role': {
			const r = f.speaker_attrs?.role?.value;
			return r ? [String(r)] : [];
		}
	}
}

function labelForBucket(dim: Dim, key: string, ctx: WorkbenchContext): string {
	if (dim === 'stage') {
		return ctx.taxonomy.journey_stages.find((s) => s.id === key)?.label ?? key;
	}
	if (dim === 'step') {
		for (const s of ctx.taxonomy.journey_stages) {
			const st = s.steps.find((x) => x.id === key);
			if (st) return `${s.label} / ${st.label}`;
		}
		return key;
	}
	if (dim === 'sentiment') {
		const n = Number(key);
		return `${n >= 0 ? '+' : ''}${n} (${SENTIMENT_LABELS[n] ?? 'unknown'})`;
	}
	return key;
}

function toolRank(input: Record<string, unknown>, session: WorkbenchSession) {
	const handle = String(input.handle);
	const dimension = input.dimension as Dim;
	const limit = (input.limit as number | undefined) ?? 20;
	const entry = resolveHandle(session, handle);
	const ctx = session.ctx;

	const counts = new Map<string, { count: number; samples: string[] }>();
	for (const id of entry.fragment_ids) {
		const f = ctx.fragments.find((x) => x.id === id);
		if (!f) continue;
		const keys = bucketKeys(f, ctx, dimension);
		for (const k of keys) {
			const bucket = counts.get(k) ?? { count: 0, samples: [] };
			bucket.count += 1;
			if (bucket.samples.length < 3) bucket.samples.push(f.id);
			counts.set(k, bucket);
		}
	}

	const rows = [...counts.entries()]
		.map(([key, v]) => ({
			id: key,
			label: labelForBucket(dimension, key, ctx),
			count: v.count,
			sample_fragment_ids: v.samples
		}))
		.sort((a, b) => b.count - a.count)
		.slice(0, limit);

	return { dimension, total_fragments: entry.fragment_ids.length, rows };
}

function toolCrosstab(input: Record<string, unknown>, session: WorkbenchSession) {
	const handle = String(input.handle);
	const row_dim = input.row_dimension as Dim;
	const col_dim = input.col_dimension as Dim;
	const entry = resolveHandle(session, handle);
	const ctx = session.ctx;

	const cells = new Map<string, { count: number; samples: string[] }>();
	const rowKeys = new Set<string>();
	const colKeys = new Set<string>();
	for (const id of entry.fragment_ids) {
		const f = ctx.fragments.find((x) => x.id === id);
		if (!f) continue;
		const rks = bucketKeys(f, ctx, row_dim);
		const cks = bucketKeys(f, ctx, col_dim);
		for (const rk of rks) {
			rowKeys.add(rk);
			for (const ck of cks) {
				colKeys.add(ck);
				const key = `${rk}\x1f${ck}`;
				const cell = cells.get(key) ?? { count: 0, samples: [] };
				cell.count += 1;
				if (cell.samples.length < 2) cell.samples.push(f.id);
				cells.set(key, cell);
			}
		}
	}

	const rows = [...rowKeys].map((rk) => ({
		row_id: rk,
		row_label: labelForBucket(row_dim, rk, ctx),
		cells: [...colKeys].map((ck) => {
			const cell = cells.get(`${rk}\x1f${ck}`);
			return {
				col_id: ck,
				col_label: labelForBucket(col_dim, ck, ctx),
				count: cell?.count ?? 0,
				sample_fragment_ids: cell?.samples ?? []
			};
		})
	}));

	return { row_dimension: row_dim, col_dimension: col_dim, rows };
}

function fragmentView(f: Fragment, ctx: WorkbenchContext) {
	const ann = ctx.annotations[f.id];
	return {
		id: f.id,
		text: f.text,
		speaker_id: speakerIdOf(f),
		speaker_label: speakerLabel(f, ctx),
		content_source: f.content_source,
		date_observed: f.date_observed,
		sentiment: ann?.segment_tags?.sentiment_score ?? null,
		themes: ann?.segment_tags?.themes ?? [],
		subthemes: ann?.segment_tags?.subthemes ?? [],
		topics: ann?.segment_tags?.topics ?? [],
		emotions: ann?.segment_tags?.emotions ?? [],
		stages: (ann?.stages?.values ?? []).map((s) => ({ stage_id: s.stage_id, step_id: s.step_id }))
	};
}

function toolGetFragments(input: Record<string, unknown>, session: WorkbenchSession) {
	const handle = String(input.handle);
	const entry = resolveHandle(session, handle);
	const ctx = session.ctx;
	const allowed = new Set(entry.fragment_ids);

	let picked: Fragment[];
	if (Array.isArray(input.fragment_ids) && input.fragment_ids.length > 0) {
		const ids = input.fragment_ids as string[];
		const unknown = ids.filter((id) => !allowed.has(id));
		if (unknown.length > 0) {
			throw new Error(
				`fragment_ids not in handle "${handle}": ${unknown.join(', ')}. Re-rank or filter to include them.`
			);
		}
		picked = ids
			.map((id) => ctx.fragments.find((f) => f.id === id))
			.filter((f): f is Fragment => Boolean(f));
	} else {
		const order_by = (input.order_by as string | undefined) ?? 'first';
		const limit = Math.min((input.limit as number | undefined) ?? 5, 10);
		const all = entry.fragment_ids
			.map((id) => ctx.fragments.find((f) => f.id === id))
			.filter((f): f is Fragment => Boolean(f));
		const sentOf = (f: Fragment) => ctx.annotations[f.id]?.segment_tags?.sentiment_score ?? 0;
		const sorted = [...all];
		if (order_by === 'most_negative') sorted.sort((a, b) => sentOf(a) - sentOf(b));
		else if (order_by === 'most_positive') sorted.sort((a, b) => sentOf(b) - sentOf(a));
		else if (order_by === 'most_recent')
			sorted.sort((a, b) => b.date_observed.localeCompare(a.date_observed));
		picked = sorted.slice(0, limit);
	}

	return { fragments: picked.map((f) => fragmentView(f, ctx)) };
}

function toolSearchFragments(input: Record<string, unknown>, session: WorkbenchSession) {
	const handle = String(input.handle);
	const query = String(input.query).toLowerCase();
	const limit = Math.min((input.limit as number | undefined) ?? 10, 10);
	const entry = resolveHandle(session, handle);
	const ctx = session.ctx;

	const scored: Array<{ id: string; score: number }> = [];
	for (const id of entry.fragment_ids) {
		const f = ctx.fragments.find((x) => x.id === id);
		if (!f) continue;
		const lc = f.text.toLowerCase();
		if (!lc.includes(query)) continue;
		let score = 0;
		let pos = 0;
		while ((pos = lc.indexOf(query, pos)) !== -1) {
			score += 1;
			pos += query.length;
		}
		scored.push({ id, score });
	}
	scored.sort((a, b) => b.score - a.score);
	return { matches: scored.slice(0, limit) };
}

function toolGetSpeakerVoice(input: Record<string, unknown>, session: WorkbenchSession) {
	const speaker_id = String(input.speaker_id);
	const limit = Math.min((input.limit as number | undefined) ?? 10, 20);
	const ctx = session.ctx;
	const owned = ctx.fragments.filter((f) => speakerIdOf(f) === speaker_id);
	if (owned.length === 0) {
		throw new Error(`unknown speaker_id "${speaker_id}" (no fragments in this indication).`);
	}
	const profile = ctx.profiles[speaker_id] ?? null;
	return {
		speaker_id,
		profile,
		fragments: owned.slice(0, limit).map((f) => fragmentView(f, ctx)),
		total_fragments: owned.length
	};
}

// ---------------------------------------------------------------------------
// Citation validator (for use after the model returns its final text)
// ---------------------------------------------------------------------------

const CITATION_RE = /\[frag:([a-zA-Z0-9_\-:.]+)\]/g;

export type ValidatedAnswer = {
	answer: string;
	citations: Array<{
		id: string;
		text: string;
		speaker_id: string;
		speaker_label: string;
		sentiment: number | null;
		/** Plutchik emotion tag ids (intensity or dyad). May be empty. */
		emotions: string[];
		stages: Array<{ stage_id: string; step_id: string | null }>;
	}>;
	missing_citations: string[];
	valid: boolean;
};

export function validateCitations(answer: string, ctx: WorkbenchContext): ValidatedAnswer {
	const seen = new Set<string>();
	const citations: ValidatedAnswer['citations'] = [];
	const missing: string[] = [];

	let cleaned = answer.replace(CITATION_RE, (match, id: string) => {
		const f = ctx.fragments.find((x) => x.id === id);
		if (!f) {
			if (!missing.includes(id)) missing.push(id);
			return '[citation missing]';
		}
		if (!seen.has(id)) {
			seen.add(id);
			const ann = ctx.annotations[f.id];
			citations.push({
				id: f.id,
				text: f.text,
				speaker_id: speakerIdOf(f),
				speaker_label: speakerLabel(f, ctx),
				sentiment: ann?.segment_tags?.sentiment_score ?? null,
				emotions: ann?.segment_tags?.emotions ?? [],
				stages: (ann?.stages?.values ?? []).map((s) => ({
					stage_id: s.stage_id,
					step_id: s.step_id
				}))
			});
		}
		return match;
	});

	cleaned = cleaned.trim();

	return {
		answer: cleaned,
		citations,
		missing_citations: missing,
		valid: missing.length === 0
	};
}
