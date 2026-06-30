/**
 * lexicon-stats-corpus.ts — keyword/theme aggregates over the fragment corpora.
 *
 * Sister module to wctglpdemo-data/lexicon-stats.ts. Same `GroupStats` shape,
 * same drawer (GroupStatsDrawer), but the input data is the corpus pool
 * (corpora/<id>/{fragments,annotations}) rather than the GLP-1 interview
 * cohort's segments.json. Routed by the active indication.
 *
 * Built statically: Vite glob-imports every corpus manifest + per-content_source
 * fragments and annotations file at build time, so the drawer doesn't need a
 * server round-trip to compute.
 *
 * Matching is the same deterministic substring scan over fragment.text that
 * lexicon-stats.ts runs over segment.text — the per-instance keyword_tags
 * files are NOT consulted, so the stats agree with what the analyst sees
 * highlighted in KeywordText regardless of whether the auto-tag pipeline
 * has been pointed at the corpus yet.
 */
import type { Fragment, FragmentAnnotation } from '$lib/content/corpora/types';
import {
	buildKeywordMatcher,
	type Cluster,
	type KeywordMatcher
} from '$lib/content/wctglpdemo-data/keywords';
import { countWords } from '$lib/content/wctglpdemo-data/word-tokenize';
import lexiconRaw from '$lib/content/wctglpdemo-data/keyword_lexicon.json';
import codebookRaw from '$lib/content/wctglpdemo-data/codebook.json';
import drugsRaw from '$lib/content/registries/drugs.json';
import type { Drug as DrugEntity } from '$lib/content/registries/types';
import { SENTIMENT_LABELS, titleCase } from '$lib/content/wctglpdemo-data/analysis';
import type { GroupKind, GroupStats } from '$lib/types/group-stats';

type Lexicon = { clusters: Cluster[] };
type CodebookSubtheme = { id: string; label?: string; description?: string };
type CodebookTheme = {
	id: string;
	label?: string;
	description?: string;
	subthemes?: CodebookSubtheme[];
};
type Codebook = { themes: CodebookTheme[] };

type ManifestFile = {
	id: string;
	label: string;
	indications: string[];
};

type FragmentsFile = { fragments?: Fragment[] };
type AnnotationsFile = { annotations?: Record<string, FragmentAnnotation> };

// --- Static load of every corpus on disk ------------------------------------

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

type CorpusBundle = {
	id: string;
	label: string;
	indications: string[];
	fragments: Fragment[];
	annotations: Record<string, FragmentAnnotation>;
};

function bundleByCorpus(): Map<string, CorpusBundle> {
	const corpora = new Map<string, CorpusBundle>();

	for (const [path, manifest] of Object.entries(manifestGlob)) {
		const corpusId = path.split('/').slice(-2, -1)[0];
		corpora.set(corpusId, {
			id: manifest.id ?? corpusId,
			label: manifest.label ?? corpusId,
			indications: manifest.indications ?? [],
			fragments: [],
			annotations: {}
		});
	}

	for (const [path, file] of Object.entries(fragmentsGlob)) {
		const corpusId = path.split('/').slice(-3, -2)[0];
		const bundle = corpora.get(corpusId);
		if (!bundle) continue;
		for (const f of file.fragments ?? []) bundle.fragments.push(f);
	}

	for (const [path, file] of Object.entries(annotationsGlob)) {
		const corpusId = path.split('/').slice(-3, -2)[0];
		const bundle = corpora.get(corpusId);
		if (!bundle) continue;
		Object.assign(bundle.annotations, file.annotations ?? {});
	}

	return corpora;
}

const CORPUS_BUNDLES = bundleByCorpus();

// Indication -> set of corpus ids that declare it.
const CORPUS_BY_INDICATION = new Map<string, string[]>();
for (const bundle of CORPUS_BUNDLES.values()) {
	for (const ind of bundle.indications) {
		const list = CORPUS_BY_INDICATION.get(ind) ?? [];
		list.push(bundle.id);
		CORPUS_BY_INDICATION.set(ind, list);
	}
}

// --- Matchers + theme metadata ----------------------------------------------

const matcher: KeywordMatcher = buildKeywordMatcher(
	(lexiconRaw as Lexicon).clusters,
	(codebookRaw as Codebook).themes,
	(drugsRaw as { items: DrugEntity[] }).items
);

const themeMeta = new Map<string, { label: string; description: string }>();
for (const t of (codebookRaw as Codebook).themes) {
	themeMeta.set(t.id, { label: t.label ?? titleCase(t.id), description: t.description ?? '' });
}

const clusterMeta = new Map<string, { label: string; categoryLabel: string }>();
for (const cat of matcher.categories) {
	for (const kw of cat.keywords) {
		clusterMeta.set(kw.id, { label: kw.label, categoryLabel: cat.label });
	}
}

// --- Speaker grouping --------------------------------------------------------

/** Same logic as journey-workbench's speakerIdOf — interview_id for interviews,
 *  media_id for transcripts, author_handle_hash for social/forum, etc. */
function speakerIdOf(f: Fragment): string {
	const ref = f.source_ref;
	if (ref.kind === 'interview') return ref.interview_id;
	if (ref.kind === 'youtube_transcript' || ref.kind === 'podcast_transcript') return ref.media_id;
	if (ref.kind === 'search_query') return ref.source_dataset;
	// social / forum / blog branch — has author_handle_hash on the type.
	return ('author_handle_hash' in ref && ref.author_handle_hash) || '(unknown)';
}

/** Masks raw corpus-derived speaker ids so source names like 'reddit' don't
 *  leak into the per-participant breakdown. Mirrors speakerLabelById in
 *  journey-workbench. */
function speakerLabel(id: string): string {
	const m = id.match(/(\d{2,})\D*$/);
	if (m) return `Anon ${m[1]}`;
	if (id.startsWith('participant_')) return titleCase(id);
	return id;
}

// --- Aggregation -------------------------------------------------------------

function aggregate(fragments: Fragment[], annotations: Record<string, FragmentAnnotation>) {
	const sentiment = [-2, -1, 0, 1, 2].map((value) => ({
		value,
		label: SENTIMENT_LABELS[value],
		count: 0
	}));
	let sentN = 0;
	let sentSum = 0;
	const emoTally = new Map<string, number>();
	const themeTally = new Map<string, number>();

	for (const f of fragments) {
		const ann = annotations[f.id]?.segment_tags;
		if (!ann) continue;
		const s = ann.sentiment_score;
		if (typeof s === 'number') {
			const slot = sentiment.find((c) => c.value === s);
			if (slot) slot.count++;
			sentSum += s;
			sentN++;
		}
		for (const e of ann.emotions ?? []) emoTally.set(e, (emoTally.get(e) ?? 0) + 1);
		for (const t of ann.themes ?? []) themeTally.set(t, (themeTally.get(t) ?? 0) + 1);
	}

	const avgSentiment = sentN ? sentSum / sentN : null;
	const emotions = [...emoTally]
		.map(([id, count]) => ({ id, label: titleCase(id), count }))
		.sort((a, b) => b.count - a.count);
	const commonWords = countWords(fragments.map((f) => f.text)).slice(0, 12);

	return { sentiment, avgSentiment, emotions, themeTally, commonWords };
}

function perParticipant(fragments: Fragment[]) {
	const tally = new Map<string, number>();
	for (const f of fragments) {
		const sid = speakerIdOf(f);
		tally.set(sid, (tally.get(sid) ?? 0) + 1);
	}
	return [...tally]
		.map(([interviewId, count]) => ({ interviewId, label: speakerLabel(interviewId), count }))
		.sort((a, b) => b.count - a.count);
}

/** Concatenate every corpus bundle attached to the indication. Cross-cutting
 *  corpora (declaring multiple indications) contribute to each. */
function fragmentsForIndication(indicationId: string): {
	fragments: Fragment[];
	annotations: Record<string, FragmentAnnotation>;
} {
	const ids = CORPUS_BY_INDICATION.get(indicationId) ?? [];
	const fragments: Fragment[] = [];
	const annotations: Record<string, FragmentAnnotation> = {};
	for (const id of ids) {
		const bundle = CORPUS_BUNDLES.get(id);
		if (!bundle) continue;
		fragments.push(...bundle.fragments);
		Object.assign(annotations, bundle.annotations);
	}
	return { fragments, annotations };
}

// --- Public API --------------------------------------------------------------

/** Indication has at least one fragment corpus loaded. The layout uses this to
 *  decide whether to route through this module or the wctglpdemo fallback. */
export function hasCorpusForIndication(indicationId: string): boolean {
	const ids = CORPUS_BY_INDICATION.get(indicationId);
	return !!ids && ids.length > 0;
}

export function keywordStats(indicationId: string, keywordId: string): GroupStats {
	const meta = clusterMeta.get(keywordId);
	const { fragments, annotations } = fragmentsForIndication(indicationId);

	const matchingFragments: Fragment[] = [];
	let mentions = 0;
	for (const f of fragments) {
		const counts = matcher.keywordCounts([f.text]);
		const row = counts.find((c) => c.keywordId === keywordId);
		if (row) {
			matchingFragments.push(f);
			mentions += row.count;
		}
	}

	const agg = aggregate(matchingFragments, annotations);

	return {
		kind: 'keyword',
		id: keywordId,
		label: meta?.label ?? titleCase(keywordId),
		context: meta?.categoryLabel ?? '',
		invocations: mentions,
		invocationUnit: mentions === 1 ? 'mention' : 'mentions',
		segmentCount: matchingFragments.length,
		participantCount: new Set(matchingFragments.map((f) => speakerIdOf(f))).size,
		sentiment: agg.sentiment,
		avgSentiment: agg.avgSentiment,
		emotions: agg.emotions,
		relatedThemes: [...agg.themeTally]
			.map(([id, count]) => ({ id, label: themeMeta.get(id)?.label ?? titleCase(id), count }))
			.sort((a, b) => b.count - a.count),
		commonWords: agg.commonWords,
		perParticipant: perParticipant(matchingFragments)
	};
}

export function themeStats(indicationId: string, themeId: string): GroupStats {
	const { fragments, annotations } = fragmentsForIndication(indicationId);
	const matchingFragments = fragments.filter((f) =>
		(annotations[f.id]?.segment_tags?.themes ?? []).includes(themeId)
	);
	const agg = aggregate(matchingFragments, annotations);

	return {
		kind: 'theme',
		id: themeId,
		label: themeMeta.get(themeId)?.label ?? titleCase(themeId),
		context: themeMeta.get(themeId)?.description ?? '',
		invocations: matchingFragments.length,
		invocationUnit: matchingFragments.length === 1 ? 'tagged fragment' : 'tagged fragments',
		segmentCount: matchingFragments.length,
		participantCount: new Set(matchingFragments.map((f) => speakerIdOf(f))).size,
		sentiment: agg.sentiment,
		avgSentiment: agg.avgSentiment,
		emotions: agg.emotions,
		relatedThemes: [...agg.themeTally]
			.filter(([id]) => id !== themeId)
			.map(([id, count]) => ({ id, label: themeMeta.get(id)?.label ?? titleCase(id), count }))
			.sort((a, b) => b.count - a.count),
		commonWords: agg.commonWords,
		perParticipant: perParticipant(matchingFragments)
	};
}

export function groupStats(indicationId: string, kind: GroupKind, id: string): GroupStats {
	if (kind === 'keyword') return keywordStats(indicationId, id);
	if (kind === 'theme') return themeStats(indicationId, id);
	// Subtheme stats aren't aggregated at this layer — workbench owns those.
	return {
		kind,
		id,
		label: titleCase(id),
		context: '',
		invocations: 0,
		invocationUnit: 'fragments',
		segmentCount: 0,
		participantCount: 0,
		sentiment: [-2, -1, 0, 1, 2].map((value) => ({
			value,
			label: SENTIMENT_LABELS[value],
			count: 0
		})),
		avgSentiment: null,
		emotions: [],
		relatedThemes: [],
		commonWords: [],
		perParticipant: []
	};
}
