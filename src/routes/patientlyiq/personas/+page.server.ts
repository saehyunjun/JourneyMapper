/**
 * Personas page server load.
 *
 * Returns two parallel galleries of cluster-shape data:
 *
 *  - SUGGESTIONS — clusters from scripts/propose-persona-suggestions.mjs,
 *    enriched with corpus + indication + resolved evidence text. Read
 *    straight from persona_suggestions.json artifacts.
 *
 *  - SAVED — analyst-curated PersonaFilter JSONs in src/lib/content/
 *    personas/. For each, we pick the first corpus whose indications
 *    overlap and compute the same bento-shape stats (top_themes, top_
 *    subthemes, sentiment, evidence) on the fly via computePersonaStats.
 *
 * Both lists flow through the same `PersonaView` shape so the bento renders
 * uniformly. The page picks between them with a Suggestions / Saved tab.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { listCorpora } from '$lib/server/corpora';
import { listPersonas } from '$lib/server/personas';
import { computePersonaStats } from '$lib/server/persona-stats';
import type { PersonaFilter } from '$lib/content/personas/types';
import type { IndicationId } from '$lib/content/registries/types';
import type { CorpusBundle } from '$lib/server/corpora';
import type { PageServerLoad } from './$types';

const EVIDENCE_TEXT_CHARS = 480;

export type EvidenceFragment = {
	id: string;
	author_handle_hash: string | null;
	text: string;
};

/** Commonwealth-style narrative archetype, produced by
 *  scripts/propose-persona-narrative.mjs and written to
 *  src/lib/content/personas/<id>.narrative.json. Optional — saved personas
 *  without a sidecar render the cluster-stats bento instead. */
export type PersonaNarrative = {
	tagline: string;
	paragraph: string;
	patient_concerns: string[];
	person_concerns: string[];
	hero_quote_fragment_id: string;
	/** Resolved at load time from the corpus so the page doesn't need to
	 *  cross-reference fragment ids. */
	hero_quote_text: string | null;
	hero_quote_author: string | null;
	generated_at: string;
	filter_hash: string;
};

export type ShareEntry = { id: string; share: number };

/** Unified shape the bento renders. Optional fields carry view-specific
 *  metadata (cohesion / rank for suggestions, color / description for
 *  saved personas) without bloating the common case. */
export type PersonaView = {
	kind: 'suggestion' | 'saved';
	id: string;
	title: string;
	description: string | null;
	corpus_id: string;
	corpus_label: string;
	indication: IndicationId | null;
	filter: PersonaFilter;
	fragment_count: number;
	author_count: number;
	annotated_count: number;
	top_themes: ShareEntry[];
	top_subthemes: ShareEntry[];
	top_stages: ShareEntry[];
	top_steps: ShareEntry[];
	top_emotions: ShareEntry[];
	sentiment: { mean: number; std: number | null } | null;
	evidence: EvidenceFragment[];
	// Suggestion-only metadata
	rank?: number;
	cohesion?: number;
	distinctness?: number;
	seed_authors?: string[];
	attached_singletons?: string[];
	exemplar_author?: string;
	overlaps_existing?: Array<{ persona_id: string; jaccard: number }>;
	// Saved-only metadata
	color?: string;
	narrative?: PersonaNarrative;
};

type RawSuggestion = {
	id: string;
	rank: number;
	proposed_filter: PersonaFilter;
	seed_authors: string[];
	exemplar_author: string;
	attached_singletons: string[];
	fragment_count: number;
	cohesion: number;
	distinctness: number;
	top_themes: ShareEntry[];
	top_subthemes: ShareEntry[];
	top_stages: ShareEntry[];
	top_steps: ShareEntry[];
	top_emotions: ShareEntry[];
	sentiment: { mean: number; std: number | null } | null;
	overlaps_existing: Array<{ persona_id: string; jaccard: number }>;
	evidence_fragment_ids: string[];
};

function titleCase(s: string): string {
	return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Suggestions carry their own ranked top-N tables. We resolve evidence ids
 *  → text but otherwise pass the artifact through. */
function suggestionToView(s: RawSuggestion, c: CorpusBundle): PersonaView {
	const fragmentById = new Map(c.fragments.map((f) => [f.id, f] as const));
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

	const topSubLabel = s.top_subthemes[0]?.id ?? s.top_themes[0]?.id ?? null;
	return {
		kind: 'suggestion',
		id: s.id,
		title: topSubLabel ? titleCase(topSubLabel) : `Cluster #${s.rank}`,
		description: null,
		corpus_id: c.manifest.id,
		corpus_label: c.manifest.label,
		indication: c.manifest.indications[0] ?? null,
		filter: s.proposed_filter,
		// Suggester emits cluster-summary counts directly. The author count
		// reported is seeds + attached singletons.
		fragment_count: s.fragment_count,
		author_count: s.seed_authors.length + s.attached_singletons.length,
		annotated_count: s.fragment_count, // best-effort; artifact lacks annotated count
		top_themes: s.top_themes,
		top_subthemes: s.top_subthemes,
		top_stages: s.top_stages,
		top_steps: s.top_steps,
		top_emotions: s.top_emotions,
		sentiment: s.sentiment,
		evidence,
		rank: s.rank,
		cohesion: s.cohesion,
		distinctness: s.distinctness,
		seed_authors: s.seed_authors,
		attached_singletons: s.attached_singletons,
		exemplar_author: s.exemplar_author,
		overlaps_existing: s.overlaps_existing
	};
}

/** Pick up a `<id>.narrative.json` sidecar alongside the persona file.
 *  Returns null when absent. The hero quote's text + author are resolved
 *  from the corpus so the page renders it without a second lookup. */
function loadNarrative(
	personaId: string,
	corpus: CorpusBundle
): PersonaNarrative | null {
	const path = resolve(process.cwd(), `src/lib/content/personas/${personaId}.narrative.json`);
	if (!existsSync(path)) return null;
	const raw = JSON.parse(readFileSync(path, 'utf8')) as {
		tagline?: string;
		paragraph?: string;
		patient_concerns?: string[];
		person_concerns?: string[];
		hero_quote_fragment_id?: string;
		meta?: { generated_at?: string; filter_hash?: string };
	};
	if (
		typeof raw.tagline !== 'string' ||
		typeof raw.paragraph !== 'string' ||
		!Array.isArray(raw.patient_concerns) ||
		!Array.isArray(raw.person_concerns) ||
		typeof raw.hero_quote_fragment_id !== 'string'
	) {
		console.warn(`[personas] narrative sidecar at ${path} is malformed; skipping`);
		return null;
	}
	const heroFragment = corpus.fragments.find((f) => f.id === raw.hero_quote_fragment_id);
	const heroText = heroFragment?.text ?? null;
	const heroAuthor =
		(heroFragment?.source_ref as { author_handle_hash?: string } | undefined)
			?.author_handle_hash ?? null;
	return {
		tagline: raw.tagline,
		paragraph: raw.paragraph,
		patient_concerns: raw.patient_concerns,
		person_concerns: raw.person_concerns,
		hero_quote_fragment_id: raw.hero_quote_fragment_id,
		hero_quote_text: heroText,
		hero_quote_author: heroAuthor,
		generated_at: raw.meta?.generated_at ?? '',
		filter_hash: raw.meta?.filter_hash ?? ''
	};
}

/** Saved personas store a filter; we compute stats by running it against
 *  the first corpus whose indications overlap applicable_indications. A
 *  persona with no matching corpus is dropped (with a console warning) so
 *  the UI doesn't render an empty pill. If a `<id>.narrative.json` sidecar
 *  exists, its content is attached so the page can render the archetype
 *  layout. */
function savedToView(
	persona: ReturnType<typeof listPersonas>[number],
	corpora: CorpusBundle[]
): PersonaView | null {
	const corpus = corpora.find((c) =>
		c.manifest.indications.some((ind) => persona.applicable_indications.includes(ind))
	);
	if (!corpus) {
		console.warn(
			`[personas] saved persona "${persona.id}" has no matching corpus for indications ${JSON.stringify(persona.applicable_indications)}; skipping`
		);
		return null;
	}
	const stats = computePersonaStats(corpus, persona.filter);
	const narrative = loadNarrative(persona.id, corpus);
	return {
		kind: 'saved',
		id: persona.id,
		title: persona.label,
		description: persona.description,
		corpus_id: corpus.manifest.id,
		corpus_label: corpus.manifest.label,
		indication: corpus.manifest.indications[0] ?? null,
		filter: persona.filter,
		fragment_count: stats.matched_fragments,
		author_count: stats.matched_authors,
		annotated_count: stats.annotated_matches,
		top_themes: stats.top_themes,
		top_subthemes: stats.top_subthemes,
		top_stages: stats.top_stages,
		top_steps: stats.top_steps,
		top_emotions: stats.top_emotions,
		sentiment: stats.sentiment,
		evidence: stats.evidence,
		color: persona.color,
		...(narrative ? { narrative } : {})
	};
}

export const load: PageServerLoad = async () => {
	const corpora = listCorpora();

	// === Suggestions ========================================================

	const suggestions: PersonaView[] = [];
	for (const c of corpora) {
		const artifactPath = resolve(
			process.cwd(),
			`src/lib/content/corpora/${c.manifest.id}/artifacts/persona_suggestions.json`
		);
		if (!existsSync(artifactPath)) continue;
		const raw = JSON.parse(readFileSync(artifactPath, 'utf8')) as { suggestions: RawSuggestion[] };
		for (const s of raw.suggestions) suggestions.push(suggestionToView(s, c));
	}
	suggestions.sort((a, b) => {
		const score = (s: PersonaView) =>
			(s.cohesion ?? 0.5) * Math.log(1 + s.fragment_count) * (0.5 + (s.distinctness ?? 0.5));
		return score(b) - score(a);
	});

	// === Saved ==============================================================

	const saved: PersonaView[] = [];
	for (const p of listPersonas()) {
		const view = savedToView(p, corpora);
		if (view) saved.push(view);
	}
	// Saved personas are user-curated; alphabetical by label is the least-
	// surprising default. Could expose a user-chosen sort later.
	saved.sort((a, b) => a.title.localeCompare(b.title));

	return { suggestions, saved };
};
