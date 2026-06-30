/**
 * theme-tags.ts — server-side loader for the new per-span ThemeTag rows
 * written by scripts/propose-theme-tags.mjs.
 *
 * Phase 5 of the codebook migration. Reads `<corpus>/theme_tags/<source>.json`
 * (the output of propose-theme-tags.mjs) and exposes aggregated queries for
 * the ThemeStatsDrawer:
 *   - by theme_id (exact match): all tag rows for one theme
 *   - by suffix wildcard (e.g. `*.financial`): all tag rows whose theme_id
 *     ends with `.financial` across every axis
 *
 * Bundled-glob loading mirrors lexicon-stats-corpus.ts. The files are small
 * (≤ a few hundred KB per corpus) and rarely change at runtime, so static
 * import is the right tradeoff.
 *
 * Stats aggregation includes sentiment cross-reference: when a tag row's
 * fragment has a sentiment_score in `corpora/<id>/annotations/<source>.json`,
 * the sentiment is folded into the per-theme distribution.
 */
import type {
	Fragment,
	FragmentAnnotation
} from '$lib/content/corpora/types';

type ThemeTagSpan = { start: number; end: number; text: string };
type ThemeTagRow = {
	span: ThemeTagSpan;
	theme_id: string;
	tagger: 'human' | 'llm-proposed' | 'llm-accepted';
	confidence: number;
	rationale?: string;
	created_at?: string;
};

type ThemeTagsFile = {
	meta?: { corpus_id?: string; content_source?: string; [k: string]: unknown };
	theme_tags: Record<string, ThemeTagRow[]>;
};

type ManifestFile = {
	id?: string;
	label?: string;
	indications: string[];
};

type FragmentsFile = { fragments?: Fragment[] };
type AnnotationsFile = { annotations?: Record<string, FragmentAnnotation> };

// --- Static load of every corpus's theme_tags + manifest + sentiment ---------

const themeTagsGlob = import.meta.glob<ThemeTagsFile>(
	'/src/lib/content/corpora/*/theme_tags/*.json',
	{ eager: true, import: 'default' }
);
const manifestGlob = import.meta.glob<ManifestFile>(
	'/src/lib/content/corpora/*/manifest.json',
	{ eager: true, import: 'default' }
);
const fragmentsGlob = import.meta.glob<FragmentsFile>(
	'/src/lib/content/corpora/*/fragments/*.json',
	{ eager: true, import: 'default' }
);
const annotationsGlob = import.meta.glob<AnnotationsFile>(
	'/src/lib/content/corpora/*/annotations/*.json',
	{ eager: true, import: 'default' }
);

// Index by corpus_id → records
type CorpusBundle = {
	corpus_id: string;
	indications: string[];
	tagRows: { fragment_id: string; row: ThemeTagRow; content_source: string }[];
	fragmentTextById: Map<string, string>;
	sentimentByFragmentId: Map<string, number | null>;
};

function buildIndex(): Map<string, CorpusBundle> {
	const idx = new Map<string, CorpusBundle>();
	for (const [path, manifest] of Object.entries(manifestGlob)) {
		const corpus_id = path.match(/corpora\/([^/]+)\/manifest\.json$/)?.[1];
		if (!corpus_id) continue;
		idx.set(corpus_id, {
			corpus_id,
			indications: manifest.indications ?? [],
			tagRows: [],
			fragmentTextById: new Map(),
			sentimentByFragmentId: new Map()
		});
	}
	// Theme tags
	for (const [path, doc] of Object.entries(themeTagsGlob)) {
		const m = path.match(/corpora\/([^/]+)\/theme_tags\/([^/]+)\.json$/);
		if (!m) continue;
		const [, corpus_id, content_source] = m;
		const bundle = idx.get(corpus_id);
		if (!bundle) continue;
		for (const [fragment_id, rows] of Object.entries(doc.theme_tags ?? {})) {
			for (const row of rows) {
				bundle.tagRows.push({ fragment_id, row, content_source });
			}
		}
	}
	// Fragment text (for the example excerpts in stats)
	for (const [path, doc] of Object.entries(fragmentsGlob)) {
		const corpus_id = path.match(/corpora\/([^/]+)\/fragments\//)?.[1];
		if (!corpus_id) continue;
		const bundle = idx.get(corpus_id);
		if (!bundle) continue;
		for (const f of doc.fragments ?? []) {
			if (f.text) bundle.fragmentTextById.set(f.id, f.text);
		}
	}
	// Sentiment (cross-reference from legacy annotations)
	for (const [path, doc] of Object.entries(annotationsGlob)) {
		const corpus_id = path.match(/corpora\/([^/]+)\/annotations\//)?.[1];
		if (!corpus_id) continue;
		const bundle = idx.get(corpus_id);
		if (!bundle) continue;
		for (const [fragment_id, ann] of Object.entries(doc.annotations ?? {})) {
			const score = ann.segment_tags?.sentiment_score;
			if (typeof score === 'number') bundle.sentimentByFragmentId.set(fragment_id, score);
		}
	}
	return idx;
}

let cachedIndex: Map<string, CorpusBundle> | null = null;
function index(): Map<string, CorpusBundle> {
	if (!cachedIndex) cachedIndex = buildIndex();
	return cachedIndex;
}

// --- Public API --------------------------------------------------------------

export type ThemeStats = {
	/** Original query — may be an exact theme_id or a wildcard like '*.financial'. */
	query: string;
	/** True when the query was a wildcard pattern that matched multiple themes. */
	isWildcard: boolean;
	/** When isWildcard: the list of matched theme_ids. When exact: a single id. */
	matchedThemeIds: string[];

	/** Total ThemeTag rows across the matched themes. */
	totalTagRows: number;
	/** Distinct fragment count contributing those rows. */
	uniqueFragmentCount: number;

	/** Sentiment distribution from cross-referenced annotation sentiment_score.
	 *  Buckets are conventional -2..2; rows whose fragment has no sentiment are
	 *  in `unknown`. */
	sentiment: { value: number | 'unknown'; label: string; count: number }[];
	avgSentiment: number | null;

	/** Per-theme breakdown when the query is a wildcard. Empty for exact. */
	perThemeBreakdown: { theme_id: string; count: number }[];

	/** Up to 8 example tag rows for the drawer's evidence section. Sorted by
	 *  confidence descending, then by sentiment intensity. */
	examples: {
		fragment_id: string;
		content_source: string;
		span_text: string;
		theme_id: string;
		confidence: number;
		rationale: string;
		sentiment_score: number | null;
	}[];
};

/** Find all corpora that the active indication maps to. An indication can
 *  back multiple corpora (today most are 1:1; iGAN has igan_forum_2026q2). */
export function corpusIdsForIndication(activeIndication: string): string[] {
	const out: string[] = [];
	for (const bundle of index().values()) {
		if (bundle.indications.includes(activeIndication)) out.push(bundle.corpus_id);
	}
	return out;
}

/** Match check supporting both exact and `*.<suffix>` wildcards. */
function themeIdMatches(query: string, theme_id: string): boolean {
	if (!query.includes('*')) return query === theme_id;
	const regex = new RegExp(
		'^' + query.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
	);
	return regex.test(theme_id);
}

/** Aggregate ThemeTag stats for a theme query (exact or wildcard) across the
 *  corpora backing the active indication. */
export function getThemeStats(activeIndication: string, query: string): ThemeStats {
	const corpora = corpusIdsForIndication(activeIndication)
		.map((id) => index().get(id))
		.filter((b): b is CorpusBundle => !!b);

	const isWildcard = query.includes('*');
	const matchedThemeIdSet = new Set<string>();
	const fragmentIds = new Set<string>();
	const perTheme = new Map<string, number>();
	const sentimentByBucket = new Map<number | 'unknown', number>();
	const exampleCandidates: ThemeStats['examples'] = [];

	let sentSum = 0;
	let sentN = 0;

	for (const bundle of corpora) {
		for (const { fragment_id, row, content_source } of bundle.tagRows) {
			if (!themeIdMatches(query, row.theme_id)) continue;
			matchedThemeIdSet.add(row.theme_id);
			fragmentIds.add(fragment_id);
			perTheme.set(row.theme_id, (perTheme.get(row.theme_id) ?? 0) + 1);
			const score = bundle.sentimentByFragmentId.get(fragment_id);
			const bucket: number | 'unknown' =
				typeof score === 'number' ? Math.round(score) : 'unknown';
			sentimentByBucket.set(bucket, (sentimentByBucket.get(bucket) ?? 0) + 1);
			if (typeof score === 'number') {
				sentSum += score;
				sentN += 1;
			}
			exampleCandidates.push({
				fragment_id,
				content_source,
				span_text: row.span.text,
				theme_id: row.theme_id,
				confidence: row.confidence,
				rationale: row.rationale ?? '',
				sentiment_score: typeof score === 'number' ? score : null
			});
		}
	}

	const SENTIMENT_LABELS: Record<number, string> = {
		[-2]: 'Strongly negative',
		[-1]: 'Negative',
		0: 'Neutral',
		1: 'Positive',
		2: 'Strongly positive'
	};

	const sentiment: ThemeStats['sentiment'] = [-2, -1, 0, 1, 2]
		.filter((v) => sentimentByBucket.has(v))
		.map((v) => ({ value: v, label: SENTIMENT_LABELS[v], count: sentimentByBucket.get(v)! }));
	if (sentimentByBucket.has('unknown')) {
		sentiment.push({
			value: 'unknown',
			label: 'No sentiment yet',
			count: sentimentByBucket.get('unknown')!
		});
	}

	const examples = exampleCandidates
		.sort(
			(a, b) =>
				b.confidence - a.confidence ||
				Math.abs(b.sentiment_score ?? 0) - Math.abs(a.sentiment_score ?? 0)
		)
		.slice(0, 8);

	const perThemeBreakdown = isWildcard
		? Array.from(perTheme.entries())
				.sort((a, b) => b[1] - a[1])
				.map(([theme_id, count]) => ({ theme_id, count }))
		: [];

	return {
		query,
		isWildcard,
		matchedThemeIds: Array.from(matchedThemeIdSet),
		totalTagRows: Array.from(perTheme.values()).reduce((s, n) => s + n, 0),
		uniqueFragmentCount: fragmentIds.size,
		sentiment,
		avgSentiment: sentN > 0 ? sentSum / sentN : null,
		perThemeBreakdown,
		examples
	};
}
