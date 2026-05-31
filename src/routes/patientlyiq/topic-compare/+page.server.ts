/**
 * Topic Compare — pick a single topic (drug, sponsor, or lexicon cluster) and
 * compare mention volume × sentiment × search-volume across every indication
 * that has corpora on disk.
 *
 * Same-topic-across-indications view. The chip + typeahead picker on the
 * client is fed by the topic catalog this loader builds; the per-indication
 * rows draw from the mention index and the search-trend index.
 *
 * Spike at /patientlyiq/topic-compare per CLAUDE.md's spike-then-commit rule.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PageServerLoad } from './$types';
import { listCorpusBundles } from '$lib/server/corpus-store';
import {
	diseaseInsightManifests,
	getDatasetRef,
	type DiseaseInsightManifest
} from '$lib/content/disease-insights';
import indicationsRaw from '$lib/content/registries/indications.json';
import drugsRaw from '$lib/content/registries/drugs.json';
import sponsorsRaw from '$lib/content/registries/sponsors.json';
import lexiconRaw from '$lib/content/wctglpdemo-data/keyword_lexicon.json';
import codebookRaw from '$lib/content/wctglpdemo-data/codebook.json';
import { buildKeywordMatcher, type Cluster as MatcherCluster } from '$lib/content/wctglpdemo-data/keywords';
import type { Drug as DrugEntity } from '$lib/content/registries/types';
import type { IndicationId } from '$lib/content/registries/types';

export type TopicKind = 'drug' | 'sponsor' | 'cluster';
export type TopicKey = `${TopicKind}:${string}`;

export type Topic = {
	key: TopicKey;
	kind: TopicKind;
	id: string;
	label: string;
	sublabel?: string;
	/** All cluster ids whose mentions count toward this topic. Drug topics
	 *  resolve 1:1 (cluster.id === drug.id for the 22 drug-FK clusters);
	 *  sponsor topics fan out across every drug they sponsor. */
	cluster_ids: string[];
	/** Free-text needles for typeahead match (label, brand names, variants). */
	haystack: string;
};

export type IndicationCard = {
	id: IndicationId;
	label: string;
	abbreviation: string | null;
};

export type MentionCell = {
	count: number;
	/** Raw sentiment scores in -2..+2, one per matched fragment. */
	sentiments: number[];
};

export type TrendSeries = {
	weeks: string[];
	values: number[];
};

type LexiconCluster = {
	id: string;
	label: string;
	description?: string;
	indications: string[];
	drug_id?: string;
	parent_theme?: string;
	variants?: string[];
};

type LexiconFile = { clusters: LexiconCluster[] };

type IndicationsFile = {
	items: Array<{ id: IndicationId; label: string; abbreviation?: string | null }>;
};

type DrugItem = {
	id: string;
	label: string;
	generic_name: string;
	brand_names: string[];
	sponsor_id: string | null;
	indication_ids: IndicationId[];
};

type SponsorItem = { id: string; label: string };

type SearchTrendsFile = {
	time_period: { start_iso: string; end_iso: string; grain: string; week_count: number };
	weeks: string[];
	series: Array<{
		query: string;
		display_label: string;
		cluster_id: string | null;
		match_variants: string[];
		search_index: number[];
		mention_count: number[];
	}>;
};

const CONTENT_ROOT = resolve(process.cwd(), 'src/lib/content/disease-insights');

function loadDatasetJson<T>(manifest: DiseaseInsightManifest, datasetId: string): T | null {
	const ref = getDatasetRef(manifest, datasetId);
	if (!ref) return null;
	const path = resolve(CONTENT_ROOT, manifest.slug, ref.path);
	if (!existsSync(path)) return null;
	return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export const load: PageServerLoad = async ({ url }) => {
	const indications = (indicationsRaw as IndicationsFile).items;
	const drugs = (drugsRaw as { items: DrugItem[] }).items;
	const sponsors = (sponsorsRaw as { items: SponsorItem[] }).items;
	const clusters = (lexiconRaw as LexiconFile).clusters;

	// Which indications have at least one corpus? That's our row set.
	const corpora = await listCorpusBundles();
	const indicationsWithCorpora = new Set<IndicationId>();
	for (const c of corpora) for (const ind of c.manifest.indications) indicationsWithCorpora.add(ind);
	const indicationCards: IndicationCard[] = indications
		.filter((i) => indicationsWithCorpora.has(i.id))
		.map((i) => ({ id: i.id, label: i.label, abbreviation: i.abbreviation ?? null }));

	// Cluster lookup by id, used by both topic resolution and the trends index.
	const clusterById = new Map(clusters.map((c) => [c.id, c]));

	// --- Topic catalog -------------------------------------------------------
	// Drugs: every drug becomes a topic. Its cluster_ids field is the 1:1
	// cluster (when present). Some drugs have no cluster yet; we still keep
	// them in the catalog so the typeahead is complete, but they'll show 0
	// mentions everywhere — that's informative (shows lexicon gap).
	const topics: Topic[] = [];
	for (const d of drugs) {
		const cluster = clusterById.get(d.id);
		topics.push({
			key: `drug:${d.id}`,
			kind: 'drug',
			id: d.id,
			label: d.label,
			sublabel: d.generic_name === d.id ? undefined : d.generic_name,
			cluster_ids: cluster ? [cluster.id] : [],
			haystack: [d.label, d.generic_name, ...d.brand_names, d.id].join(' ').toLowerCase()
		});
	}

	// Sponsors: each becomes a topic whose cluster_ids fan out across every
	// drug they sponsor. Skip sponsors with zero sponsored drugs in our
	// registry — they'd be empty rows everywhere.
	const drugsBySponsor = new Map<string, DrugItem[]>();
	for (const d of drugs) {
		if (!d.sponsor_id) continue;
		const arr = drugsBySponsor.get(d.sponsor_id) ?? [];
		arr.push(d);
		drugsBySponsor.set(d.sponsor_id, arr);
	}
	for (const s of sponsors) {
		const sponsored = drugsBySponsor.get(s.id) ?? [];
		if (!sponsored.length) continue;
		const sponsoredClusterIds = sponsored
			.map((d) => clusterById.get(d.id)?.id)
			.filter((x): x is string => !!x);
		topics.push({
			key: `sponsor:${s.id}`,
			kind: 'sponsor',
			id: s.id,
			label: s.label,
			sublabel: `${sponsored.length} drug${sponsored.length === 1 ? '' : 's'}`,
			cluster_ids: sponsoredClusterIds,
			haystack: [s.label, s.id, ...sponsored.map((d) => d.label)].join(' ').toLowerCase()
		});
	}

	// Clusters: surface non-drug clusters whose parent theme is interesting
	// for the topic-compare lens — clinical_trials and treatment. Drug
	// clusters are already represented as drug topics above; skip them to
	// avoid duplicates in the typeahead.
	const drugClusterIds = new Set(drugs.map((d) => d.id));
	const INTERESTING_THEMES = new Set(['clinical_trials', 'treatment']);
	for (const c of clusters) {
		if (drugClusterIds.has(c.id)) continue;
		if (c.parent_theme && !INTERESTING_THEMES.has(c.parent_theme)) continue;
		topics.push({
			key: `cluster:${c.id}`,
			kind: 'cluster',
			id: c.id,
			label: c.label,
			sublabel: c.parent_theme,
			cluster_ids: [c.id],
			haystack: [c.label, c.id, ...(c.variants ?? [])].join(' ').toLowerCase()
		});
	}

	// --- Mentions × sentiment index -----------------------------------------
	// For each indication that has corpora, build a per-cluster aggregate:
	//   clusterId → { count, sentiments[] }
	// We can't read from FragmentAnnotation.segment_tags.topics[] because that
	// field is unpopulated across the LN/MS/obesity corpora today. Instead,
	// run the shared regex-based keyword matcher over fragment text (this is
	// the same path the dashboard / KeywordText use). One matcher built over
	// the full cluster set so a topic in any indication can match against any
	// corpus.
	const codebookThemes = (codebookRaw as { themes: { id: string; label?: string; subthemes?: { id: string; label?: string }[] }[] }).themes;
	const matcher = buildKeywordMatcher(
		clusters as MatcherCluster[],
		codebookThemes,
		drugs as DrugEntity[]
	);

	const mentionsByIndication: Record<string, Record<string, MentionCell>> = {};
	const fragmentCountByIndication: Record<string, number> = {};
	for (const ind of indicationCards) {
		mentionsByIndication[ind.id] = {};
		fragmentCountByIndication[ind.id] = 0;
	}
	// Group fragment {text, sentiment} pairs by indication so we make one
	// matcher pass per indication. Sentiment falls back to 0 (neutral) when
	// the annotation has no score so we still count the mention.
	const fragsByIndication = new Map<string, { text: string; sentiment: number }[]>();
	for (const ind of indicationCards) fragsByIndication.set(ind.id, []);
	for (const c of corpora) {
		for (const ind of c.manifest.indications) {
			const bucket = fragsByIndication.get(ind);
			if (!bucket) continue;
			fragmentCountByIndication[ind] += c.fragments.length;
			for (const f of c.fragments) {
				const ann = c.annotations[f.id];
				const sentiment =
					typeof ann?.segment_tags?.sentiment_score === 'number'
						? ann.segment_tags.sentiment_score
						: 0;
				bucket.push({ text: f.text, sentiment });
			}
		}
	}
	for (const [indId, frags] of fragsByIndication) {
		const blocks = matcher.keywordBlocks(frags);
		const acc = mentionsByIndication[indId];
		for (const kb of blocks) {
			if (!kb.blocks.length) continue;
			acc[kb.keywordId] = {
				count: kb.blocks.length,
				sentiments: kb.blocks.map((b) => b.sentiment)
			};
		}
	}

	// --- Search-trend index --------------------------------------------------
	// Per indication, load treatment_trends_us.json if present and flatten its
	// series into clusterId → { weeks, values }. Only LN has this dataset
	// today; MS/obesity rows will show no trend (gracefully).
	const trendsByIndication: Record<string, { weeks: string[]; byCluster: Record<string, TrendSeries> }> = {};
	for (const m of diseaseInsightManifests) {
		if (!indicationsWithCorpora.has(m.id)) continue;
		const trends = loadDatasetJson<SearchTrendsFile>(
			m,
			`${m.id}_treatment_trends_us`
		);
		if (!trends) continue;
		const byCluster: Record<string, TrendSeries> = {};
		for (const s of trends.series) {
			if (!s.cluster_id) continue;
			byCluster[s.cluster_id] = { weeks: trends.weeks, values: s.search_index };
		}
		trendsByIndication[m.id] = { weeks: trends.weeks, byCluster };
	}

	// --- Pick an initial topic ----------------------------------------------
	// Honor ?topic= if it points to a real topic; otherwise pick the topic
	// with the highest aggregate mention count across all indications so the
	// page lands on something meaningful.
	const requestedKey = url.searchParams.get('topic') as TopicKey | null;
	const topicByKey = new Map(topics.map((t) => [t.key, t]));
	let initialTopicKey: TopicKey | null = null;
	if (requestedKey && topicByKey.has(requestedKey)) {
		initialTopicKey = requestedKey;
	} else {
		let best: { key: TopicKey; total: number } | null = null;
		for (const t of topics) {
			let total = 0;
			for (const ind of indicationCards) {
				for (const cid of t.cluster_ids) {
					total += mentionsByIndication[ind.id]?.[cid]?.count ?? 0;
				}
			}
			if (!best || total > best.total) best = { key: t.key, total };
		}
		initialTopicKey = best?.key ?? topics[0]?.key ?? null;
	}

	return {
		indications: indicationCards,
		fragmentCountByIndication,
		topics,
		initialTopicKey,
		mentionsByIndication,
		trendsByIndication
	};
};
