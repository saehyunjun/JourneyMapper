/**
 * keywords.ts
 *
 * Runtime keyword matcher over the lexicon — the UI-side counterpart to
 * scripts/build-keyword-usage.mjs. Same lexicon, same matching rules
 * (case-insensitive; space/hyphen runs flexible; non-alphanumeric boundaries),
 * so what gets bolded on screen and what build-keyword-usage.mjs counts agree.
 *
 * Two ways to use this module:
 *
 *   1. **Factory (preferred, indication-scoped).** Call
 *      `buildKeywordMatcher(clusters, themes, drugs)` with a slice fetched
 *      from `/api/lexicon?indication=<id>` (or the server's
 *      `getLexiconSlice`). Use this for any new consumer — it avoids pulling
 *      the full lexicon into the client bundle and lets the toggle UI swap
 *      matchers per indication. When a cluster carries a `drug_id`, the
 *      matching DrugEntity's generic_name + brand_names[] are merged into
 *      the cluster's match regex, so brand names can drift out of
 *      cluster.variants over time without losing match coverage.
 *
 *   2. **Default matcher (legacy, full-bundle).** The module-level exports
 *      (`keywordRuns`, `keywordTags`, `keywordCounts`, `keywordBlocks`,
 *      `clusters`, `categories`) are built lazily from the statically-
 *      imported `keyword_lexicon.json` + `codebook.json`. This forces the
 *      whole lexicon into every page's bundle. Existing consumers still use
 *      this path; migrate them to the factory + the `/api/lexicon` endpoint
 *      as you touch them. New code should NOT use the default matcher.
 *
 * Codebook 2.0 note: clusters declare parent_theme + parent_subtheme. The
 * exported `categoryId` / `categoryLabel` field names on spans/counts carry
 * the parent_subtheme id and the subtheme's display label respectively — kept
 * under those names for compatibility with downstream consumers
 * (KeywordOrbit, ThemeHeatmap, analysis-page).
 */
import lexiconRaw from './keyword_lexicon.json';
import codebookRaw from './codebook.json';
import drugsRaw from '$lib/content/registries/drugs.json';
import type { Drug as DrugEntity } from '$lib/content/registries/types';
import type { Entity, EntityKind } from '$lib/content/entities/types';

type DrugsRegistryFile = { items: DrugEntity[] };

// --- Types ------------------------------------------------------------------

export type Cluster = {
	id: string;
	label: string;
	description?: string;
	/** Lexicon 3.2+: string[] FK → registries/indications.json items[].id.
	 *  Empty array = cross-cutting (visible under every indication). Optional
	 *  on reads so legacy 3.1 rows with singular `indication: string` still
	 *  parse. */
	indications?: string[];
	/** Lexicon 3.4: string[] FK → registries/burden_categories.json items[].id.
	 *  Empty array = unclassified. Cross-cutting axis parallel to indications. */
	burden_category_ids?: string[];
	/** Lexicon 3.5: optional FK → registries/drugs.json items[].id. */
	drug_id?: string;
	parent_theme: string;
	parent_subtheme: string;
	variants: string[];
	/** Phase-1-closure: optional precomputed embedding for the retrieval-first
	 *  annotation path (Phase 3). Today nothing reads or writes this field. */
	embedding?: number[];
};

type Lexicon = { meta?: unknown; clusters: Cluster[] };

type CodebookSubtheme = { id: string; label?: string; description?: string };
type CodebookTheme = { id: string; label?: string; subthemes?: CodebookSubtheme[] };
type Codebook = { themes: CodebookTheme[] };

export type Keyword = Cluster;
export type Category = { id: string; label: string; description: string; keywords: Keyword[] };

export type KeywordSpan = {
	start: number;
	end: number;
	text: string;
	keywordId: string;
	keywordLabel: string;
	categoryId: string; // = cluster.parent_subtheme (transitional name)
	categoryLabel: string; // = label of that parent subtheme
	/** True when the span came from a per-instance keyword_tags row, not the
	 *  lexicon's variant regex. Used by KeywordText to mark the DOM span so the
	 *  drawer's right-click handler can target the per-instance row. */
	isInstance?: boolean;
};

/** Per-instance keyword tag, in text-relative offsets. Source-of-truth lives in
 *  keyword_tags.json keyed on (segment_id, char_start, char_end); the caller is
 *  responsible for filtering to the current segment and subtracting the
 *  segment's char_start before passing in. */
export type InstanceKeywordTag = { start: number; end: number; keywordId: string };

export type TextRun = { text: string; span?: KeywordSpan };

export type KeywordTags = {
	categories: { id: string; label: string }[];
	keywords: { id: string; label: string; categoryId: string }[];
};

export type KeywordCount = {
	keywordId: string;
	keywordLabel: string;
	categoryId: string;
	categoryLabel: string;
	count: number;
};

export type KeywordBlocks = {
	keywordId: string;
	keywordLabel: string;
	categoryId: string;
	categoryLabel: string;
	blocks: { sentiment: number }[];
};

/** A single matched entity in some text. Phase 2 of the codebook migration:
 *  entities are matched in parallel with clusters, but the existing render
 *  layer routes only `keywordId` clicks (to GroupStatsDrawer). Entity spans
 *  are visible to callers that opt in via the new `entitySpans` method;
 *  Phase 3 will wire them to EntityDetailDrawer in the render layer. */
export type EntityMatch = {
	start: number;
	end: number;
	text: string;
	entityId: string;
	entityKind: EntityKind;
	entityLabel: string;
	/** Which surface_forms[] string actually matched. */
	matchedSurfaceForm: string;
};

/** The full matcher API. Returned by `buildKeywordMatcher`; the module-level
 *  exports are this same shape, built from the bundled lexicon. */
export type KeywordMatcher = {
	clusters: Cluster[];
	categories: Category[];
	keywordRuns(text: string, instanceTags?: InstanceKeywordTag[]): TextRun[];
	keywordTags(text: string): KeywordTags;
	keywordCounts(texts: string[]): KeywordCount[];
	keywordBlocks(fragments: { text: string; sentiment: number }[]): KeywordBlocks[];
	/** Phase 2 (codebook migration): every entity surface-form hit in `text`,
	 *  possibly overlapping with cluster matches. Render-layer integration
	 *  lands in Phase 3 — for now this is read by smoke tests and any opt-in
	 *  consumer. Returns empty when the matcher was built without entities. */
	entitySpans(text: string): EntityMatch[];
	/** The entity list this matcher was built with. Empty on the legacy
	 *  default matcher (which doesn't carry an entity slice). */
	entities: Entity[];
};

// --- Internal helpers (pure, no module-level state) -------------------------

const normalize = (s: string) => s.replace(/[‘’]/g, "'");
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * One case-insensitive regex per cluster: an alternation of all its variants,
 * longest first, bounded by non-alphanumeric lookarounds, with space/hyphen
 * runs made flexible. Identical construction to build-keyword-usage.mjs.
 *
 * When the cluster carries a drug_id and the matching DrugEntity is provided,
 * the drug's generic_name and brand_names[] are merged into the source list
 * (deduped by lowercase form). This lets the lexicon stop hard-coding brand
 * names in cluster.variants over time without breaking match coverage.
 */
function clusterRegex(c: Cluster, drug?: DrugEntity): RegExp {
	const seen = new Set<string>();
	const sources: string[] = [];
	const push = (raw: string | undefined) => {
		if (!raw) return;
		const n = normalize(raw);
		const key = n.toLowerCase().trim();
		if (!key || seen.has(key)) return;
		seen.add(key);
		sources.push(n);
	};
	for (const v of c.variants) push(v);
	if (drug) {
		push(drug.generic_name);
		for (const b of drug.brand_names) push(b);
	}
	const alts = sources
		.sort((a, b) => b.length - a.length)
		.map((v) => escapeRegex(v).replace(/[\s-]+/g, '[\\s-]+'));
	return new RegExp(`(?<![A-Za-z0-9])(?:${alts.join('|')})(?![A-Za-z0-9])`, 'gi');
}

/** Same construction shape as clusterRegex but sourced from an entity's
 *  surface_forms[]. Case-insensitive, longest-first alternation, word-
 *  boundary lookarounds, flexible whitespace/hyphen runs. Entities with
 *  zero surface forms compile to a regex that matches nothing (kept for
 *  uniformity — the caller iterates entities unconditionally). */
function entityRegex(e: Entity): RegExp {
	const seen = new Set<string>();
	const sources: string[] = [];
	for (const sf of e.surface_forms ?? []) {
		const n = normalize(sf);
		const key = n.toLowerCase().trim();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		sources.push(n);
	}
	if (sources.length === 0) {
		// Compile to a regex that can't match anything — keeps the iteration
		// uniform and avoids a per-entity presence check in the hot path.
		return /(?!)/;
	}
	const alts = sources
		.sort((a, b) => b.length - a.length)
		.map((v) => escapeRegex(v).replace(/[\s-]+/g, '[\\s-]+'));
	return new RegExp(`(?<![A-Za-z0-9])(?:${alts.join('|')})(?![A-Za-z0-9])`, 'gi');
}

function subthemeLabelMap(themes: CodebookTheme[]): Map<string, string> {
	const m = new Map<string, string>();
	for (const t of themes ?? []) {
		for (const s of t.subthemes ?? []) m.set(s.id, s.label ?? s.id);
	}
	return m;
}

// --- Factory ----------------------------------------------------------------

/**
 * Build a matcher from an explicit clusters slice and codebook themes — the
 * indication-scoped path. Consumers fetch a slice from `/api/lexicon` (or
 * `getLexiconSlice` server-side) and pass it through here, so only the active
 * indication's clusters plus every cross-cutting cluster (indications: [])
 * get compiled into regexes and shipped to the client.
 *
 * `drugs` (optional) is the drug-entity slice for the active indication. When
 * a cluster carries `drug_id`, the drug's generic_name and brand_names[] are
 * merged into that cluster's match regex. Pass `slice.drugs` from
 * /api/lexicon; matchers without drug awareness can omit it.
 *
 * `entities` (optional, Phase 2 of the codebook migration) is the new
 * Entity slice — drugs, biomarkers, sponsors, symptoms, concepts, trials,
 * conditions. When provided, the returned matcher exposes `entitySpans(text)`
 * which matches entity surface forms in parallel with cluster matching.
 * The legacy cluster path is unchanged. See ENTITY_REGISTRY.md and
 * CODEBOOK_MIGRATION_PLAN.md for the migration contract.
 */
export function buildKeywordMatcher(
	clusters: Cluster[],
	themes: CodebookTheme[],
	drugs: DrugEntity[] = [],
	entities: Entity[] = []
): KeywordMatcher {
	const subLabel = subthemeLabelMap(themes);
	const drugById = new Map<string, DrugEntity>(drugs.map((d) => [d.id, d]));
	const compiled = clusters.map((cluster) => ({
		cluster,
		regex: clusterRegex(cluster, cluster.drug_id ? drugById.get(cluster.drug_id) : undefined),
		parentSubthemeLabel: subLabel.get(cluster.parent_subtheme) ?? cluster.parent_subtheme
	}));
	const clusterById = new Map(clusters.map((c) => [c.id, c]));

	// Phase 2: entity regexes compiled in parallel. Skipped entirely when the
	// caller omits entities, so the default-matcher path (which today does
	// not load entity registries) pays nothing.
	const compiledEntities = entities.map((entity) => ({
		entity,
		regex: entityRegex(entity)
	}));

	/** Codebook 2.0 transitional shim — group flat clusters under their
	 *  parent_subtheme so consumers expecting the old `categories[].keywords[]`
	 *  shape keep working. */
	const categories: Category[] = (() => {
		const byParent = new Map<string, Keyword[]>();
		for (const c of clusters) {
			const list = byParent.get(c.parent_subtheme) ?? [];
			list.push(c);
			byParent.set(c.parent_subtheme, list);
		}
		return [...byParent.entries()].map(([id, keywords]) => ({
			id,
			label: subLabel.get(id) ?? id,
			description: '',
			keywords
		}));
	})();

	/** Every cluster match in `text`, possibly overlapping across clusters. */
	function rawMatches(text: string): KeywordSpan[] {
		const norm = normalize(text);
		const out: KeywordSpan[] = [];
		for (const { cluster, regex, parentSubthemeLabel } of compiled) {
			regex.lastIndex = 0;
			for (const m of norm.matchAll(regex)) {
				const start = m.index ?? 0;
				const end = start + m[0].length;
				out.push({
					start,
					end,
					text: text.slice(start, end),
					keywordId: cluster.id,
					keywordLabel: cluster.label,
					categoryId: cluster.parent_subtheme,
					categoryLabel: parentSubthemeLabel
				});
			}
		}
		return out;
	}

	function instanceTagToSpan(tag: InstanceKeywordTag, text: string): KeywordSpan | null {
		const cluster = clusterById.get(tag.keywordId);
		if (!cluster) return null;
		if (tag.start < 0 || tag.end > text.length || tag.end <= tag.start) return null;
		return {
			start: tag.start,
			end: tag.end,
			text: text.slice(tag.start, tag.end),
			keywordId: cluster.id,
			keywordLabel: cluster.label,
			categoryId: cluster.parent_subtheme,
			categoryLabel: subLabel.get(cluster.parent_subtheme) ?? cluster.parent_subtheme,
			isInstance: true
		};
	}

	function keywordRuns(text: string, instanceTags: InstanceKeywordTag[] = []): TextRun[] {
		const instanceCandidates = instanceTags
			.map((t) => instanceTagToSpan(t, text))
			.filter((s): s is KeywordSpan => !!s)
			.sort((a, b) => a.start - b.start || b.end - a.end);
		const instanceSpans: KeywordSpan[] = [];
		let lastInstanceEnd = -1;
		for (const s of instanceCandidates) {
			if (s.start >= lastInstanceEnd) {
				instanceSpans.push(s);
				lastInstanceEnd = s.end;
			}
		}

		const overlapsInstance = (a: number, b: number) =>
			instanceSpans.some((is) => is.start < b && a < is.end);
		const variantSpans = rawMatches(text).filter((vs) => !overlapsInstance(vs.start, vs.end));

		const spans = [...instanceSpans, ...variantSpans].sort(
			(a, b) => a.start - b.start || b.end - a.end
		);
		const picked: KeywordSpan[] = [];
		let lastEnd = -1;
		for (const s of spans) {
			if (s.start >= lastEnd) {
				picked.push(s);
				lastEnd = s.end;
			}
		}
		if (!picked.length) return [{ text }];

		const runs: TextRun[] = [];
		let cursor = 0;
		for (const s of picked) {
			if (s.start > cursor) runs.push({ text: text.slice(cursor, s.start) });
			runs.push({ text: text.slice(s.start, s.end), span: s });
			cursor = s.end;
		}
		if (cursor < text.length) runs.push({ text: text.slice(cursor) });
		return runs;
	}

	function keywordTags(text: string): KeywordTags {
		const matches = rawMatches(text);
		const keywordIds = new Set(matches.map((m) => m.keywordId));
		const categoryIds = new Set(matches.map((m) => m.categoryId));

		const seenCats = new Set<string>();
		const cats: KeywordTags['categories'] = [];
		const keywords: KeywordTags['keywords'] = [];
		for (const cluster of clusters) {
			if (keywordIds.has(cluster.id))
				keywords.push({ id: cluster.id, label: cluster.label, categoryId: cluster.parent_subtheme });
			if (categoryIds.has(cluster.parent_subtheme) && !seenCats.has(cluster.parent_subtheme)) {
				seenCats.add(cluster.parent_subtheme);
				cats.push({
					id: cluster.parent_subtheme,
					label: subLabel.get(cluster.parent_subtheme) ?? cluster.parent_subtheme
				});
			}
		}
		return { categories: cats, keywords };
	}

	function keywordCounts(texts: string[]): KeywordCount[] {
		const tally = new Map<string, number>();
		for (const t of texts) {
			for (const m of rawMatches(t)) tally.set(m.keywordId, (tally.get(m.keywordId) ?? 0) + 1);
		}
		const out: KeywordCount[] = [];
		for (const cluster of clusters) {
			const count = tally.get(cluster.id) ?? 0;
			if (count > 0) {
				out.push({
					keywordId: cluster.id,
					keywordLabel: cluster.label,
					categoryId: cluster.parent_subtheme,
					categoryLabel: subLabel.get(cluster.parent_subtheme) ?? cluster.parent_subtheme,
					count
				});
			}
		}
		return out.sort((a, b) => b.count - a.count || a.keywordLabel.localeCompare(b.keywordLabel));
	}

	function keywordBlocks(
		fragments: { text: string; sentiment: number }[]
	): KeywordBlocks[] {
		const blocksByKw = new Map<string, { sentiment: number }[]>();
		for (const f of fragments) {
			const ids = new Set<string>();
			for (const m of rawMatches(f.text)) ids.add(m.keywordId);
			for (const id of ids) {
				let list = blocksByKw.get(id);
				if (!list) {
					list = [];
					blocksByKw.set(id, list);
				}
				list.push({ sentiment: f.sentiment });
			}
		}
		const out: KeywordBlocks[] = [];
		for (const cluster of clusters) {
			const blocks = blocksByKw.get(cluster.id);
			if (blocks && blocks.length) {
				out.push({
					keywordId: cluster.id,
					keywordLabel: cluster.label,
					categoryId: cluster.parent_subtheme,
					categoryLabel: subLabel.get(cluster.parent_subtheme) ?? cluster.parent_subtheme,
					blocks
				});
			}
		}
		return out.sort(
			(a, b) => b.blocks.length - a.blocks.length || a.keywordLabel.localeCompare(b.keywordLabel)
		);
	}

	/** Phase 2 of the codebook migration: every entity surface-form hit in
	 *  `text`, possibly overlapping with cluster matches. Returns empty when
	 *  the matcher was built without entities. Result is sorted by start
	 *  ascending, then by end descending (longest-match preference at the
	 *  same start). Overlaps between entity matches are NOT deduplicated
	 *  here — a span can carry multiple entity tags (multi-tag contract). */
	function entitySpans(text: string): EntityMatch[] {
		if (compiledEntities.length === 0) return [];
		const norm = normalize(text);
		const out: EntityMatch[] = [];
		for (const { entity, regex } of compiledEntities) {
			regex.lastIndex = 0;
			for (const m of norm.matchAll(regex)) {
				const start = m.index ?? 0;
				const end = start + m[0].length;
				out.push({
					start,
					end,
					text: text.slice(start, end),
					entityId: entity.id,
					entityKind: entity.kind,
					entityLabel: entity.label,
					matchedSurfaceForm: m[0]
				});
			}
		}
		return out.sort((a, b) => a.start - b.start || b.end - a.end);
	}

	return {
		clusters,
		categories,
		keywordRuns,
		keywordTags,
		keywordCounts,
		keywordBlocks,
		entitySpans,
		entities
	};
}

// --- Legacy default matcher (deprecated — full-bundle path) -----------------
// The exports below build a matcher from the statically-imported lexicon +
// codebook. This forces the whole lexicon into every page that imports this
// module. Existing consumers (KeywordOrbit, ThemeHeatmap, analysis +page,
// community +page, topicTree, journey, lexicon-stats, quote-text) still
// use this path; migrate them to `buildKeywordMatcher` + `/api/lexicon` as
// each one is touched. Once all callers have migrated, delete the static
// imports above and the block below.

const defaultMatcher: KeywordMatcher = buildKeywordMatcher(
	(lexiconRaw as Lexicon).clusters,
	(codebookRaw as Codebook).themes,
	(drugsRaw as DrugsRegistryFile).items
);

/** @deprecated Use `buildKeywordMatcher(slice.clusters, slice.themes).clusters` with a slice from `/api/lexicon`. */
export const clusters = defaultMatcher.clusters;
/** @deprecated Use `buildKeywordMatcher(...).categories`. */
export const categories = defaultMatcher.categories;
/** @deprecated Use `buildKeywordMatcher(...).keywordRuns`. */
export const keywordRuns = defaultMatcher.keywordRuns;
/** @deprecated Use `buildKeywordMatcher(...).keywordTags`. */
export const keywordTags = defaultMatcher.keywordTags;
/** @deprecated Use `buildKeywordMatcher(...).keywordCounts`. */
export const keywordCounts = defaultMatcher.keywordCounts;
/** @deprecated Use `buildKeywordMatcher(...).keywordBlocks`. */
export const keywordBlocks = defaultMatcher.keywordBlocks;
