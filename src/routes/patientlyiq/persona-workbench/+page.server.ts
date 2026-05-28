/**
 * Persona Workbench server load.
 *
 * Returns the data needed for the analyst to pick a corpus, browse its
 * authors, and review existing personas:
 *   - corpora_summary: one row per corpus with manifest + author/fragment
 *     counts. Full fragment text NOT included — the page hits /api/personas/derive
 *     for any selection, so we keep the initial payload small.
 *   - corpora_authors: per-corpus, the author handles + fragment counts +
 *     1–2 sample fragment texts (truncated) for the multi-select UI.
 *   - existing_personas: all personas (the page filters client-side by the
 *     active corpus's indications).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { listCorpora, listJourneys } from '$lib/server/corpora';
import { listPersonas } from '$lib/server/personas';
import type { PersonaFilter } from '$lib/content/personas/types';
import type { IndicationId } from '$lib/content/registries/types';
import type { PageServerLoad } from './$types';

// --- Taxonomy groupings for the filter-builder pickers ----------------------

type CodebookTheme = { id: string; label?: string; subthemes?: { id: string }[] };
type Codebook = {
	themes: CodebookTheme[];
	emotion_tags?: Array<{ id: string }>;
};

const codebook = JSON.parse(
	readFileSync(resolve(process.cwd(), 'src/lib/content/wctglpdemo-data/codebook.json'), 'utf8')
) as Codebook;

/** Every theme id in codebook order; used as the "themes" availability list. */
const ALL_THEME_IDS: string[] = codebook.themes.map((t) => t.id);

/** Theme-id → ordered subtheme-ids, sourced from the live codebook. */
const SUBTHEME_GROUPS: Array<{ id: string; label: string; ids: string[] }> = codebook.themes.map(
	(t) => ({
		id: t.id,
		label: t.label ?? titleCase(t.id),
		ids: (t.subthemes ?? []).map((s) => s.id)
	})
);

/** Emotion valence map — manually classified since codebook.emotion_tags is
 *  a flat list. Three buckets: positive, neutral/mixed, negative. Add new
 *  emotions to one of these arrays when the codebook expands. */
const EMOTION_GROUPS: Array<{ id: string; label: string; ids: string[] }> = [
	{
		id: 'positive',
		label: 'Positive',
		ids: [
			'acceptance', 'admiration', 'anticipation', 'curiosity', 'delight', 'ecstasy',
			'hope', 'interest', 'joy', 'love', 'optimism', 'pride', 'sentimentality',
			'serenity', 'trust'
		]
	},
	{
		id: 'neutral',
		label: 'Neutral / mixed',
		ids: [
			'amazement', 'ambivalence', 'bittersweetness', 'confusion', 'distraction',
			'dominance', 'pensiveness', 'submission', 'surprise', 'unbelief', 'vigilance'
		]
	},
	{
		id: 'negative',
		label: 'Negative',
		ids: [
			'aggression', 'alarm', 'anger', 'annoyance', 'anxiety', 'apprehension',
			'boredom', 'contempt', 'cynicism', 'despair', 'disappointment', 'disgust',
			'envy', 'fear', 'frozenness', 'grief', 'guilt', 'loathing', 'morbideness',
			'outrage', 'pessimism', 'rage', 'remorse', 'sadness', 'shame', 'terror'
		]
	}
];

function titleCase(s: string): string {
	return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Render a hardcoded group list with each member flagged available/not based
 *  on the corpus's seen-tag set. Empty groups are dropped so a corpus that
 *  has zero annotated emotions doesn't render an empty Positive / Neutral /
 *  Negative scaffold. An "Other" bucket catches anything seen in-corpus that
 *  didn't fit any group — codebook drift signal. */
function applyGroups(
	availableIds: Set<string>,
	groups: Array<{ id: string; label: string; ids: string[] }>
): TagGroupView[] {
	const claimed = new Set<string>();
	const out: TagGroupView[] = [];
	for (const g of groups) {
		if (g.ids.length === 0) continue;
		for (const id of g.ids) claimed.add(id);
		out.push({
			id: g.id,
			label: g.label,
			tags: g.ids.map((id) => ({ id, available: availableIds.has(id) }))
		});
	}
	const orphans = [...availableIds].filter((id) => !claimed.has(id)).sort();
	if (orphans.length > 0) {
		out.push({
			id: '__other',
			label: 'Other',
			tags: orphans.map((id) => ({ id, available: true }))
		});
	}
	return out;
}

const SAMPLE_TEXT_CHARS = 240;
const EVIDENCE_TEXT_CHARS = 360;

export type AuthorRow = {
	author_handle_hash: string;
	fragment_count: number;
	annotated_count: number;
	role_seen: string | null;
	sample_text: string;
};

export type CorpusSummary = {
	id: string;
	label: string;
	indications: IndicationId[];
	total_fragments: number;
	authored_fragments: number;
	distinct_authors: number;
	annotated_fragments: number;
};

export type EvidenceFragment = {
	id: string;
	author_handle_hash: string | null;
	text: string;
};

/** One suggestion enriched with evidence text. Fields beyond
 *  EvidenceFragment[] mirror the artifact's `suggestions[]` shape — we
 *  re-emit them rather than re-deriving so the UI can show stats and
 *  stage/subtheme/sentiment context directly. */
export type SuggestionRow = {
	id: string;
	rank: number;
	proposed_filter: PersonaFilter;
	seed_authors: string[];
	exemplar_author: string;
	attached_singletons: string[];
	fragment_count: number;
	cohesion: number;
	distinctness: number;
	top_themes: Array<{ id: string; share: number }>;
	top_subthemes: Array<{ id: string; share: number }>;
	top_stages: Array<{ id: string; share: number }>;
	top_steps: Array<{ id: string; share: number }>;
	top_emotions: Array<{ id: string; share: number }>;
	sentiment: { mean: number; std: number | null } | null;
	overlaps_existing: Array<{ persona_id: string; jaccard: number }>;
	evidence: EvidenceFragment[];
};

/** A single tag inside a group. `available` is true when the tag actually
 *  appears in at least one annotation in this corpus; false means it's part
 *  of the codebook / journey taxonomy but the corpus has no tagged examples,
 *  so the UI shows it dimmed and click-blocked. */
export type TagOption = {
	id: string;
	available: boolean;
};

/** A taxonomy-aware group rendered as a sub-section in the filter picker. */
export type TagGroupView = {
	id: string;
	label: string;
	tags: TagOption[];
};

/** Per-corpus tag inventory powering the filter-builder pickers. The picker
 *  shows the FULL codebook / journey taxonomy, so the analyst can see what's
 *  conceivable; tags that aren't in the corpus's annotations are flagged
 *  unavailable and rendered as dimmed/disabled chips. */
export type CorpusAvailability = {
	subthemes: TagGroupView[];
	emotions: TagGroupView[];
	themes: TagOption[];
	stages: TagOption[];
	steps: TagGroupView[];
	sentiment_min: number | null;
	sentiment_max: number | null;
};

export type SuggestionsArtifact = {
	meta: {
		corpus_id: string;
		generated_at: string;
		params: {
			min_fragments: number;
			distance_cutoff: number;
			min_cluster_size: number;
			share_threshold: number;
			role_threshold: number;
			singleton_attach_cutoff: number;
		};
		universe: {
			total_fragments: number;
			total_authors: number;
			seed_authors: number;
			singleton_authors: number;
			attached_singletons: number;
			unattached_authors: number;
		};
	};
	suggestions: SuggestionRow[];
	unattached_authors: string[];
} | null;

export const load: PageServerLoad = async () => {
	const corpora = listCorpora();
	const journeys = listJourneys();

	const corpora_summary: CorpusSummary[] = [];
	const corpora_authors: Record<string, AuthorRow[]> = {};
	const corpora_suggestions: Record<string, SuggestionsArtifact> = {};
	const corpora_availability: Record<string, CorpusAvailability> = {};

	for (const c of corpora) {
		const byAuthor = new Map<string, {
			fragments: typeof c.fragments;
			annotated: number;
			role: string | null;
		}>();
		let authored = 0;
		let annotatedTotal = 0;

		const seenEmotions = new Set<string>();
		const seenSubthemes = new Set<string>();
		const seenThemes = new Set<string>();
		const seenStages = new Set<string>();
		const seenSteps = new Set<string>();
		let sentMin: number | null = null;
		let sentMax: number | null = null;

		for (const f of c.fragments) {
			const h = (f.source_ref as { author_handle_hash?: string }).author_handle_hash;
			const ann = c.annotations[f.id];
			const isAnnotated = ann != null;
			if (isAnnotated) {
				annotatedTotal += 1;
				for (const e of ann.segment_tags?.emotions ?? []) seenEmotions.add(e);
				for (const s of ann.segment_tags?.subthemes ?? []) seenSubthemes.add(s);
				for (const t of ann.segment_tags?.themes ?? []) seenThemes.add(t);
				for (const sv of ann.stages?.values ?? []) {
					if (sv.stage_id) seenStages.add(sv.stage_id);
					if (sv.step_id) seenSteps.add(sv.step_id);
				}
				const s = ann.segment_tags?.sentiment_score;
				if (typeof s === 'number') {
					if (sentMin === null || s < sentMin) sentMin = s;
					if (sentMax === null || s > sentMax) sentMax = s;
				}
			}
			if (!h) continue;
			authored += 1;
			if (!byAuthor.has(h)) byAuthor.set(h, { fragments: [], annotated: 0, role: null });
			const slot = byAuthor.get(h)!;
			slot.fragments.push(f);
			if (isAnnotated) slot.annotated += 1;
			const r = f.speaker_attrs?.role;
			if (r?.value && !slot.role) slot.role = String(r.value);
		}

		// Full stage + step taxonomy for the corpus's indications, used as the
		// candidate set the UI shows (with unavailable ones dimmed). If a corpus
		// spans multiple indications and they disagree on a step's parent stage,
		// the first journey wins.
		const allStageIds: string[] = [];
		const stepGroups = new Map<string, { label: string; ids: string[] }>();
		for (const ind of c.manifest.indications) {
			const j = journeys[ind];
			if (!j) continue;
			for (const stage of j.stages ?? []) {
				const stageId = stage.id as string;
				if (!allStageIds.includes(stageId)) allStageIds.push(stageId);
				const stageLabel = (stage as { label?: string }).label ?? titleCase(stageId);
				for (const step of (stage as { steps?: { id: string }[] }).steps ?? []) {
					if (!stepGroups.has(stageId)) stepGroups.set(stageId, { label: stageLabel, ids: [] });
					const slot = stepGroups.get(stageId)!;
					if (!slot.ids.includes(step.id)) slot.ids.push(step.id);
				}
			}
		}
		const stepGroupArr = [...stepGroups.entries()].map(([id, { label, ids }]) => ({
			id,
			label,
			ids
		}));

		corpora_availability[c.manifest.id] = {
			emotions: applyGroups(seenEmotions, EMOTION_GROUPS),
			subthemes: applyGroups(seenSubthemes, SUBTHEME_GROUPS),
			themes: ALL_THEME_IDS.map((id) => ({ id, available: seenThemes.has(id) })),
			stages: allStageIds.map((id) => ({ id, available: seenStages.has(id) })),
			steps: applyGroups(seenSteps, stepGroupArr),
			sentiment_min: sentMin,
			sentiment_max: sentMax
		};

		corpora_summary.push({
			id: c.manifest.id,
			label: c.manifest.label,
			indications: c.manifest.indications,
			total_fragments: c.fragments.length,
			authored_fragments: authored,
			distinct_authors: byAuthor.size,
			annotated_fragments: annotatedTotal
		});

		corpora_authors[c.manifest.id] = [...byAuthor.entries()]
			.map(([author_handle_hash, slot]): AuthorRow => {
				// Pick the longest fragment as the sample — usually carries the
				// most narrative weight, helps the analyst recognize the author.
				const longest = slot.fragments.reduce((a, b) =>
					(a.text?.length ?? 0) >= (b.text?.length ?? 0) ? a : b
				);
				const text = longest?.text ?? '';
				return {
					author_handle_hash,
					fragment_count: slot.fragments.length,
					annotated_count: slot.annotated,
					role_seen: slot.role,
					sample_text:
						text.length > SAMPLE_TEXT_CHARS ? text.slice(0, SAMPLE_TEXT_CHARS) + '…' : text
				};
			})
			.sort(
				(a, b) =>
					b.fragment_count - a.fragment_count ||
					a.author_handle_hash.localeCompare(b.author_handle_hash)
			);

		// Suggestions artifact — generated by scripts/propose-persona-suggestions.mjs.
		// Missing artifact is fine; the Suggestions tab shows an empty state.
		const artifactPath = resolve(
			process.cwd(),
			`src/lib/content/corpora/${c.manifest.id}/artifacts/persona_suggestions.json`
		);
		if (existsSync(artifactPath)) {
			const raw = JSON.parse(readFileSync(artifactPath, 'utf8')) as {
				meta: SuggestionsArtifact extends infer T ? (T extends { meta: infer M } ? M : never) : never;
				suggestions: Array<
					Omit<SuggestionRow, 'evidence'> & { evidence_fragment_ids: string[] }
				>;
				unattached_authors: string[];
			};

			const fragmentById = new Map(c.fragments.map((f) => [f.id, f] as const));
			const suggestions: SuggestionRow[] = raw.suggestions.map((s) => {
				const evidence: EvidenceFragment[] = (s.evidence_fragment_ids ?? [])
					.map((id) => {
						const f = fragmentById.get(id);
						if (!f) return null;
						const t = f.text ?? '';
						return {
							id,
							author_handle_hash:
								(f.source_ref as { author_handle_hash?: string }).author_handle_hash ?? null,
							text: t.length > EVIDENCE_TEXT_CHARS ? t.slice(0, EVIDENCE_TEXT_CHARS) + '…' : t
						};
					})
					.filter((x): x is EvidenceFragment => x !== null);
				// Drop the raw id list — the page only needs the resolved evidence rows.
				const { evidence_fragment_ids: _ignored, ...rest } = s;
				return { ...rest, evidence };
			});

			corpora_suggestions[c.manifest.id] = {
				meta: raw.meta,
				suggestions,
				unattached_authors: raw.unattached_authors ?? []
			};
		} else {
			corpora_suggestions[c.manifest.id] = null;
		}
	}

	return {
		corpora_summary,
		corpora_authors,
		corpora_suggestions,
		corpora_availability,
		existing_personas: listPersonas()
	};
};
