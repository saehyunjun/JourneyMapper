/**
 * search-interview-alignment.ts
 *
 * Pairs the search-volume signal (what people actually search for) with the
 * interview-mention signal (what they actually talk about in interviews), for a
 * single indication. The v1 wires lupus_nephritis: 8 real treatment search
 * queries from disease-insights against the 24 mock interview clusters in
 * lupus_nephritis_keyword_usage.json.
 *
 * Matching is variant-based and case-insensitive. A search query matches an
 * interview cluster when the query (lowercased) equals one of the cluster's
 * `variants[]` strings, the cluster's `id`, or its `label` (with brand-name
 * parenthetical stripped, e.g. "Voclosporin (Lupkynis)" → "voclosporin"). This
 * catches both generic-name searches ("Mycophenolate" → mycophenolate cluster)
 * and brand-name searches ("Lupkynis" → voclosporin cluster via its variant
 * list). When a query matches multiple clusters, the highest-count cluster
 * wins. Single matches per side: a cluster paired to one query, a query paired
 * to one cluster — keeps the connector graph readable.
 *
 * Returns the three populations the alignment viz needs:
 *   - matched: paired search+interview rows (the "they agree" set)
 *   - searchOnly: search queries with no interview cluster (the "people search
 *     for it but don't talk about it" gap — usually emerging or unfamiliar
 *     treatments)
 *   - interviewOnly: interview clusters with no search query (the "people talk
 *     about it but don't search for it" gap — usually familiar / established
 *     treatments people don't need to look up)
 *
 * The column-display arrays (leftColumn, rightColumn) preserve magnitude rank
 * within each side and carry an optional matchKey the renderer uses to draw
 * the gutter connectors.
 */
import searchData from '$lib/content/disease-insights/lupus-nephritis/search/treatment_searches_us.json';
import interviewUsage from './lupus_nephritis_keyword_usage.json';

export type SearchItem = { query: string; volume: number };
export type InterviewItem = { clusterId: string; label: string; count: number };
export type MatchedPair = { matchKey: string; search: SearchItem; interview: InterviewItem };

export type ColumnRow<T> = { item: T; matchKey?: string };

export type SearchInterviewAlignment = {
	matched: MatchedPair[];
	searchOnly: SearchItem[];
	interviewOnly: InterviewItem[];
	leftColumn: ColumnRow<SearchItem>[];
	rightColumn: ColumnRow<InterviewItem>[];
	totals: {
		searchVolume: number;
		interviewMentions: number;
		matchedCount: number;
		searchItems: number;
		interviewItems: number;
	};
};

type SearchFile = {
	indication_id: string;
	title: string;
	subtitle: string;
	unit: string;
	geography: string;
	data: { topic: string; volume: number }[];
};

type UsageKeyword = {
	id: string;
	label: string;
	parent_theme: string;
	parent_subtheme: string;
	variants: string[];
	count: number;
};
type UsageCategory = { id: string; label: string; keywords: UsageKeyword[] };
type UsageFile = { categories: UsageCategory[] };

const search = searchData as SearchFile;
const usage = interviewUsage as UsageFile;

const norm = (s: string) => s.toLowerCase().trim();

/** Strip a trailing parenthetical: "Voclosporin (Lupkynis)" → "voclosporin". */
function strippedLabel(label: string): string {
	return norm(label.replace(/\s*\([^)]*\)\s*$/, ''));
}

/** Build a (matchable string) → cluster lookup spanning every keyword's id,
 *  label, stripped-label, and variants[]. One cluster may have several keys. */
function buildClusterLookup(keywords: UsageKeyword[]): Map<string, UsageKeyword> {
	const m = new Map<string, UsageKeyword>();
	for (const k of keywords) {
		const keys = new Set<string>([norm(k.id), norm(k.label), strippedLabel(k.label)]);
		for (const v of k.variants ?? []) keys.add(norm(v));
		for (const key of keys) {
			if (!key) continue;
			// If two clusters claim the same key (unlikely with this dataset), the
			// higher-count one wins — surfaces the louder signal in the viz.
			const prev = m.get(key);
			if (!prev || k.count > prev.count) m.set(key, k);
		}
	}
	return m;
}

/**
 * Pick interview clusters eligible for cross-matching against the search
 * signal. The search dataset is treatment-name-only, so we restrict the
 * interview side to clusters whose parent_subtheme tags them as treatment
 * health history (drug clusters). Symptoms / comorbidities / labs are
 * legitimate interview-only signal but they don't belong in this comparison —
 * a "Fatigue cluster has no search query" row would be a noise finding.
 */
function eligibleInterviewKeywords(): UsageKeyword[] {
	const out: UsageKeyword[] = [];
	for (const cat of usage.categories) {
		for (const k of cat.keywords) {
			if (k.parent_subtheme === 'treatment_health_history') out.push(k);
		}
	}
	return out;
}

// --- Per-row narrative (data-driven; no LLM, no quote bank yet) -------------
//
// The slide's right-hand pane is row-reactive: hovering a matched pair or a
// gap row swaps the headline + body. These functions keep that framing in
// one place. Quote-bank integration is a future hook — LN has no real
// interview corpus today.

export type AlignmentRowNarrative = {
	headline: string;
	body: string;
	quote?: { text: string; attribution?: string };
};

function fmtVolForAlignment(v: number): string {
	if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
	return String(v);
}

/** Narrative for a matched pair row — both sides have signal. */
export function narrativeForMatchedPair(m: MatchedPair): AlignmentRowNarrative {
	const v = fmtVolForAlignment(m.search.volume);
	const ratio = m.interview.count > 0 ? Math.round(m.search.volume / m.interview.count) : 0;
	return {
		headline: `"${m.search.query}" — ${v}/mo searched, ${m.interview.count} interview mentions.`,
		body: `Patients searched "${m.search.query}" ${v} times a month against ${m.interview.count} cluster mentions for ${m.interview.label}.${ratio > 0 ? ` That's roughly ${ratio.toLocaleString()} searches per interview mention — a clean treatment-level alignment.` : ''}`
	};
}

/** Narrative for a search-only gap — query has volume but no interview echo. */
export function narrativeForSearchGap(s: SearchItem): AlignmentRowNarrative {
	const v = fmtVolForAlignment(s.volume);
	return {
		headline: `"${s.query}" — ${v}/mo searched. No interview echo.`,
		body: `Patients searched "${s.query}" ${v} times a month, but the term has no matching cluster in the interview corpus. Could be an emerging option patients are reaching for that interviews haven't yet caught — or a treatment your protocol didn't probe.`
	};
}

/** Narrative for an interview-only cluster — talked about, not searched. */
export function narrativeForInterviewGap(i: InterviewItem): AlignmentRowNarrative {
	return {
		headline: `${i.label} — ${i.count} interview mentions. Not searched.`,
		body: `${i.label} surfaced ${i.count} times in interviews but doesn't show up in patient search behavior at meaningful volume. Likely an established treatment patients know without needing to look up.`
	};
}

/** Default narrative when nothing is hovered — surfaces the headline read. */
export function narrativeOverview(a: SearchInterviewAlignment): AlignmentRowNarrative {
	const topMatch = a.matched[0];
	const topGap = a.searchOnly[0];
	const headline = `${a.totals.matchedCount} of ${a.totals.searchItems} searched treatments echo in interview talk.`;
	const bits: string[] = [];
	if (topMatch) {
		bits.push(
			`Strongest pair: "${topMatch.search.query}" (${fmtVolForAlignment(topMatch.search.volume)}/mo) ↔ ${topMatch.interview.label} (${topMatch.interview.count} mentions).`
		);
	}
	if (topGap) {
		bits.push(
			`Largest gap: "${topGap.query}" — ${fmtVolForAlignment(topGap.volume)}/mo with no interview counterpart. Hover any row for its specific read.`
		);
	}
	return { headline, body: bits.join(' ') };
}

export function computeLupusNephritisAlignment(): SearchInterviewAlignment {
	const interviewKeywords = eligibleInterviewKeywords();
	const lookup = buildClusterLookup(interviewKeywords);

	// First pass: tentatively match each search query → best interview cluster.
	type Tentative = { search: SearchItem; clusterId?: string; matchKey?: string };
	const tentatives: Tentative[] = search.data
		.map((d) => ({ query: d.topic, volume: d.volume }))
		.sort((a, b) => b.volume - a.volume)
		.map((s) => {
			const cluster = lookup.get(norm(s.query));
			return cluster
				? { search: s, clusterId: cluster.id, matchKey: cluster.id }
				: { search: s };
		});

	// One-cluster-per-query: if two queries point at the same cluster (rare
	// here but possible — e.g. "Mycophenolate" and "Cellcept" both →
	// mycophenolate cluster), the higher-volume query keeps the match, the
	// other falls into searchOnly.
	const claimed = new Set<string>();
	for (const t of tentatives) {
		if (t.clusterId && !claimed.has(t.clusterId)) claimed.add(t.clusterId);
		else if (t.clusterId && claimed.has(t.clusterId)) {
			t.clusterId = undefined;
			t.matchKey = undefined;
		}
	}

	const clusterById = new Map(interviewKeywords.map((k) => [k.id, k]));
	const matched: MatchedPair[] = [];
	const searchOnly: SearchItem[] = [];
	for (const t of tentatives) {
		if (t.clusterId && t.matchKey) {
			const k = clusterById.get(t.clusterId);
			if (k) {
				matched.push({
					matchKey: t.matchKey,
					search: t.search,
					interview: { clusterId: k.id, label: k.label, count: k.count }
				});
				continue;
			}
		}
		searchOnly.push(t.search);
	}

	const matchedClusterIds = new Set(matched.map((m) => m.interview.clusterId));
	const interviewOnly: InterviewItem[] = interviewKeywords
		.filter((k) => !matchedClusterIds.has(k.id))
		.map((k) => ({ clusterId: k.id, label: k.label, count: k.count }))
		.sort((a, b) => b.count - a.count);

	// Column display order: rank by magnitude within each column. Matched rows
	// stay in their natural rank — connectors will simply cross when the search
	// rank and interview rank diverge (which is part of the read).
	const leftColumn: ColumnRow<SearchItem>[] = [...search.data]
		.map((d) => ({ query: d.topic, volume: d.volume }))
		.sort((a, b) => b.volume - a.volume)
		.map((s) => {
			const m = matched.find((mp) => mp.search.query === s.query);
			return m ? { item: s, matchKey: m.matchKey } : { item: s };
		});

	const rightColumn: ColumnRow<InterviewItem>[] = interviewKeywords
		.map((k) => ({ clusterId: k.id, label: k.label, count: k.count }))
		.sort((a, b) => b.count - a.count)
		.map((iv) => {
			const m = matched.find((mp) => mp.interview.clusterId === iv.clusterId);
			return m ? { item: iv, matchKey: m.matchKey } : { item: iv };
		});

	const searchVolume = search.data.reduce((s, d) => s + d.volume, 0);
	const interviewMentions = interviewKeywords.reduce((s, k) => s + k.count, 0);

	return {
		matched,
		searchOnly,
		interviewOnly,
		leftColumn,
		rightColumn,
		totals: {
			searchVolume,
			interviewMentions,
			matchedCount: matched.length,
			searchItems: search.data.length,
			interviewItems: interviewKeywords.length
		}
	};
}
