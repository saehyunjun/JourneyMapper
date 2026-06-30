/**
 * exec-summary-data.ts
 *
 * Unified per-indication data builder for the patientlyiq executive summary.
 *
 * Returns a single `ExecSummaryData` shape regardless of indication so the
 * page's bento cells render the same way for obesity (wctglpdemo interview
 * corpus) and for LN / MS (fragment corpora). Built statically — Vite glob
 * imports do all the file discovery, no server round-trip required.
 *
 * Inputs:
 *   - exec-summary-config.json: per-indication anchor sub-theme + sentiment axes
 *   - obesity → wctglpdemo-data analysis + executive-summary modules
 *   - LN / MS → corpora/<id>/{fragments,annotations}/*.json + dashboard_blurbs
 */
import type { Fragment, FragmentAnnotation } from '$lib/content/corpora/types';
import {
	buildKeywordMatcher,
	type Cluster,
	type KeywordMatcher
} from '$lib/content/wctglpdemo-data/keywords';
import lexiconRaw from '$lib/content/wctglpdemo-data/keyword_lexicon.json';
import codebookRaw from '$lib/content/wctglpdemo-data/codebook.json';
import drugsRaw from '$lib/content/registries/drugs.json';
import type { Drug as DrugEntity } from '$lib/content/registries/types';
import { titleCase } from '$lib/content/wctglpdemo-data/analysis';
import {
	summaryStats as glp1Stats,
	sentimentLean as glp1Lean,
	buildFindings as buildObesityFindings,
	type Finding,
	type ClusterBar,
	type Distribution,
	type SummaryQuote
} from '$lib/content/wctglpdemo-data/executive-summary';
import { quotes as glp1Quotes } from '$lib/content/wctglpdemo-data/analysis';
import { annotations as glp1Anns, segments as glp1Segments } from '$lib/content/wctglpdemo-data/analysis';
import type { ThemeFragment } from '$lib/content/wctglpdemo-data/analysis';
import { getOverviewBlurb } from '$lib/content/wctglpdemo-data/dashboard-blurbs';
import configRaw from './exec-summary-config.json';
import blurbsRaw from './exec-summary-blurbs.json';

export type { Finding, ClusterBar, Distribution, SummaryQuote };

// --- Types ------------------------------------------------------------------

export type SentimentAxisSpec =
	| { label: string; kind: 'keyword' | 'theme' | 'subtheme'; id: string }
	| { label: string; kind: 'complement' };

export type ExecSummaryConfig = {
	anchor_subtheme: { id: string; label: string };
	sentiment_axes: SentimentAxisSpec[];
	drug_callouts: { label: string; content: string }[];
	clinical_trials_blurb: string;
};

export type AxisBreakdown = {
	id: string;
	label: string;
	total: number;
	positive: number;
	negative: number;
	neutral: number;
	posPct: number;
	negPct: number;
	neuPct: number;
	lean: 'positive' | 'negative' | 'mixed';
};

export type AnchorQuote = {
	id: string;
	text: string;
	speakerId: string;
	speakerLabel: string;
	sentiment: number;
	themes: string[];
	subthemes: string[];
	questionId?: string | null;
};

export type ExecSummaryBlurb = { headline: string; caption: string };

/** Per-finding analyst copy overlay — supplied by exec-summary-blurbs.json
 *  when the proposer has run. Optional fields fall back to the computed
 *  Finding's templated text. */
export type FindingCopy = {
	eyebrow?: string;
	headline?: string;
	lede?: string;
	analysis?: string;
};

/** Bridge-narrative cell content — the throughline card opposite the hero. */
export type BridgeNarrativeBlurb = {
	eyebrow: string;
	headline: string;
	caption: string;
	body: string;
	points?: { value?: string | number; label: string }[];
	tone?: 'positive' | 'negative' | 'neutral';
};

export type ExecSummaryData = {
	indication: string;
	corpusKind: 'interview' | 'fragments' | 'mixed';
	headlineStats: { value: number; label: string }[];
	overallLean: AxisBreakdown;
	axes: AxisBreakdown[];
	anchorSubtheme: { id: string; label: string } | null;
	anchorQuotes: AnchorQuote[];
	overviewBlurb: string | null;
	/** Analyst-voice headline + caption for the sentiment widget. Null when no
	 *  blurb is on file (the page falls back to a generic phrase). */
	sentimentLeanBlurb: ExecSummaryBlurb | null;
	/** Analyst-voice headline + caption for the anchor sub-theme cell. */
	anchorSubthemeBlurb: ExecSummaryBlurb | null;
	/** Top finding rendered in the lead-chart cell (full-width waffle). */
	leadFinding: Finding | null;
	/** Second finding rendered in the finding-b cell (1/3 stat card). */
	secondFinding: Finding | null;
	/** Throughline card opposite the hero. Null falls back to omitting the cell. */
	bridgeNarrative: BridgeNarrativeBlurb | null;
	/** Quote teaser cell (1/3, beside the bubble) — pulled from the anchor pool
	 *  but distinct from the top-3 stacked-quotes selection. */
	teaserQuote: AnchorQuote | null;
	/** Long-form anchor verbatim (full-width). */
	longQuote: AnchorQuote | null;
};

// --- Config helpers ---------------------------------------------------------

type ConfigFile = {
	schema_version: string;
	indications: Record<string, ExecSummaryConfig>;
};

const CONFIG = configRaw as ConfigFile;

export function getExecSummaryConfig(indicationId: string): ExecSummaryConfig | null {
	return CONFIG.indications?.[indicationId] ?? null;
}

type BlurbsFile = {
	schema_version: string;
	indications: Record<
		string,
		{
			overview?: string;
			sentiment_lean?: ExecSummaryBlurb;
			anchor_subtheme?: ExecSummaryBlurb;
			bridge_narrative?: BridgeNarrativeBlurb;
			lead_finding?: FindingCopy;
			second_finding?: FindingCopy;
		}
	>;
};

const BLURBS = blurbsRaw as BlurbsFile;

function getBlurbsForIndication(indicationId: string) {
	return BLURBS.indications?.[indicationId] ?? null;
}

// --- Lexicon matcher (shared) -----------------------------------------------

type Lexicon = { clusters: Cluster[] };
type CodebookSubtheme = { id: string; label?: string };
type CodebookTheme = { id: string; label?: string; subthemes?: CodebookSubtheme[] };
type Codebook = { themes: CodebookTheme[] };

const matcher: KeywordMatcher = buildKeywordMatcher(
	(lexiconRaw as Lexicon).clusters,
	(codebookRaw as Codebook).themes,
	(drugsRaw as { items: DrugEntity[] }).items
);

const subthemeLabelMap = new Map<string, string>();
for (const t of (codebookRaw as Codebook).themes) {
	for (const s of t.subthemes ?? []) subthemeLabelMap.set(s.id, s.label ?? s.id);
}

// --- Corpus discovery (static Vite glob) ------------------------------------

type ManifestFile = { id: string; label: string; indications: string[] };
type FragmentsFile = { fragments?: Fragment[] };
type AnnotationsFile = { annotations?: Record<string, FragmentAnnotation> };

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
	indications: string[];
	fragments: Fragment[];
	annotations: Record<string, FragmentAnnotation>;
};

const CORPUS_BUNDLES: Map<string, CorpusBundle> = (() => {
	const out = new Map<string, CorpusBundle>();
	for (const [path, m] of Object.entries(manifestGlob)) {
		const id = path.split('/').slice(-2, -1)[0];
		out.set(id, { id, indications: m.indications ?? [], fragments: [], annotations: {} });
	}
	for (const [path, f] of Object.entries(fragmentsGlob)) {
		const id = path.split('/').slice(-3, -2)[0];
		const b = out.get(id);
		if (b) for (const fr of f.fragments ?? []) b.fragments.push(fr);
	}
	for (const [path, a] of Object.entries(annotationsGlob)) {
		const id = path.split('/').slice(-3, -2)[0];
		const b = out.get(id);
		if (b) Object.assign(b.annotations, a.annotations ?? {});
	}
	return out;
})();

function bundlesForIndication(indicationId: string): CorpusBundle[] {
	return [...CORPUS_BUNDLES.values()].filter((b) => b.indications.includes(indicationId));
}

// --- Speaker labeling -------------------------------------------------------

function speakerIdOf(f: Fragment): string {
	const r = f.source_ref;
	if (r.kind === 'interview') return r.interview_id;
	if (r.kind === 'youtube_transcript' || r.kind === 'podcast_transcript') return r.media_id;
	if (r.kind === 'search_query') return r.source_dataset;
	return ('author_handle_hash' in r && r.author_handle_hash) || '(unknown)';
}

function speakerLabel(id: string): string {
	const m = id.match(/(\d{2,})\D*$/);
	if (m) return `Anon ${m[1]}`;
	if (id.startsWith('participant_')) return titleCase(id);
	return id;
}

// --- Axis evaluation --------------------------------------------------------

type Datapoint = { id: string; sentiment: number; text: string; speakerId: string };

function leanFromCounts(pos: number, neg: number, neu: number): AxisBreakdown['lean'] {
	if (pos > neg * 1.2) return 'positive';
	if (neg > pos * 1.2) return 'negative';
	return 'mixed';
}

function breakdown(id: string, label: string, points: Datapoint[]): AxisBreakdown {
	const pos = points.filter((p) => p.sentiment > 0).length;
	const neg = points.filter((p) => p.sentiment < 0).length;
	const neu = points.length - pos - neg;
	const total = points.length;
	const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
	return {
		id,
		label,
		total,
		positive: pos,
		negative: neg,
		neutral: neu,
		posPct: pct(pos),
		negPct: pct(neg),
		neuPct: pct(neu),
		lean: leanFromCounts(pos, neg, neu)
	};
}

/** Partition a flat list of (text, sentiment, …) points across the configured
 *  axes. A point lands in the FIRST axis it matches; the trailing 'complement'
 *  axis (if any) sweeps up everything still unmatched. Points can repeat
 *  across multiple non-complement axes (a fragment tagged with two keywords
 *  shows up in both columns) — that's intentional, the columns are comparative
 *  not exclusive. */
function evaluateAxes(
	specs: SentimentAxisSpec[],
	points: Datapoint[],
	keywordHitCheck: (text: string, clusterId: string) => boolean,
	annotationOf: (pointId: string) => { themes: string[]; subthemes: string[] } | null
): AxisBreakdown[] {
	if (!specs.length) return [];

	// Track which points have been consumed by a non-complement axis so that
	// the complement axis can take the residual.
	const matchedSomewhere = new Set<string>();
	const axes: AxisBreakdown[] = [];

	for (const spec of specs) {
		if (spec.kind === 'complement') {
			const residual = points.filter((p) => !matchedSomewhere.has(p.id));
			axes.push(breakdown(`__complement__${spec.label}`, spec.label, residual));
			continue;
		}
		const filtered = points.filter((p) => {
			if (spec.kind === 'keyword') return keywordHitCheck(p.text, spec.id);
			const ann = annotationOf(p.id);
			if (!ann) return false;
			if (spec.kind === 'theme') return ann.themes.includes(spec.id);
			return ann.subthemes.includes(spec.id);
		});
		for (const f of filtered) matchedSomewhere.add(f.id);
		axes.push(breakdown(`${spec.kind}__${spec.id}`, spec.label, filtered));
	}

	return axes;
}

// --- Anchor-quote ranking ---------------------------------------------------

/** "Quotable" length sweet-spot heuristic for fragment text. Penalises fragments
 *  that are too short (< 25 chars) or too long (> 280 chars). Returns 0-1. */
function lengthScore(text: string): number {
	const n = text.length;
	if (n < 25) return n / 25;
	if (n > 280) return Math.max(0, 1 - (n - 280) / 400);
	return 1;
}

function pickTopAnchorQuotes(
	candidates: AnchorQuote[],
	k: number
): AnchorQuote[] {
	return [...candidates]
		.sort((a, b) => {
			const aScore = Math.abs(a.sentiment) * 0.6 + lengthScore(a.text) * 0.4;
			const bScore = Math.abs(b.sentiment) * 0.6 + lengthScore(b.text) * 0.4;
			return bScore - aScore;
		})
		.slice(0, k);
}

// --- Corpus findings (cluster waffle + supporting stats) --------------------

/** Cluster labels that ARE the theme they're scoped under — surfacing them
 *  as drivers produces tautologies ("clinical trial drove negative trial
 *  sentiment"). Mirrors SELF_DRIVER_TAUTOLOGIES in executive-summary.ts so
 *  the same rule lands on corpus-derived findings. */
const SELF_DRIVER_TAUTOLOGIES: Record<string, string[]> = {
	clinical_trials: ['clinical trial', 'clinical trials'],
	treatment: ['treatment'],
	condition_specific: ['condition specific', 'condition-specific']
};

/** Stance-only clusters — pure affect / generic evaluation that never carries
 *  signal as a driver. Same list as executive-summary.ts. */
const STANCE_ONLY_DRIVER_IDS = new Set<string>([
	'concern',
	'harm',
	'better',
	'guinea_pig',
	'lawsuits'
]);

const MIN_CLUSTER_N = 2;
const TOP_K = 5;

type CorpusClusterRow = {
	clusterId: string;
	clusterLabel: string;
	positive: number;
	negative: number;
	neutral: number;
	blocks: { sentiment: number; interview_id: string }[];
	fragmentIds: string[];
};

/** Build one cluster-row per keyword cluster across the supplied themed
 *  datapoints. Each row aggregates fragments whose text contains the cluster
 *  (via the shared keyword matcher), tagged with the fragment's sentiment. */
function buildCorpusClusterRows(points: Datapoint[]): CorpusClusterRow[] {
	const rowById = new Map<string, CorpusClusterRow>();
	for (const c of (lexiconRaw as Lexicon).clusters) {
		const seen = new Set<string>();
		const row: CorpusClusterRow = {
			clusterId: c.id,
			clusterLabel: c.label,
			positive: 0,
			negative: 0,
			neutral: 0,
			blocks: [],
			fragmentIds: []
		};
		for (const p of points) {
			if (seen.has(p.id)) continue;
			const hits = matcher.keywordCounts([p.text]);
			if (!hits.some((h) => h.keywordId === c.id)) continue;
			seen.add(p.id);
			row.blocks.push({ sentiment: p.sentiment, interview_id: p.speakerId });
			row.fragmentIds.push(p.id);
			if (p.sentiment > 0) row.positive += 1;
			else if (p.sentiment < 0) row.negative += 1;
			else row.neutral += 1;
		}
		if (row.blocks.length) rowById.set(c.id, row);
	}
	return [...rowById.values()];
}

function dropSelfDrivers(rows: CorpusClusterRow[], scopeTheme: string): CorpusClusterRow[] {
	const anchors = new Set(SELF_DRIVER_TAUTOLOGIES[scopeTheme] ?? []);
	return rows.filter((r) => {
		if (STANCE_ONLY_DRIVER_IDS.has(r.clusterId)) return false;
		if (anchors.size && anchors.has(r.clusterLabel.toLowerCase().trim())) return false;
		return true;
	});
}

function aggregateDistribution(rows: CorpusClusterRow[]): Distribution {
	const seen = new Set<string>();
	let positive = 0;
	let neutral = 0;
	let negative = 0;
	for (const r of rows) {
		for (let i = 0; i < r.fragmentIds.length; i += 1) {
			const fid = r.fragmentIds[i];
			if (seen.has(fid)) continue;
			seen.add(fid);
			const block = r.blocks[i];
			if (block.sentiment > 0) positive += 1;
			else if (block.sentiment < 0) negative += 1;
			else neutral += 1;
		}
	}
	return { positive, neutral, negative };
}

function rowsToClusterBars(rows: CorpusClusterRow[]): ClusterBar[] {
	return rows.map((r) => ({
		id: r.clusterId,
		label: r.clusterLabel,
		count: r.blocks.length,
		positive: r.positive,
		negative: r.negative,
		neutral: r.neutral,
		blocks: r.blocks
	}));
}

function fragmentsFromRows(
	rows: CorpusClusterRow[],
	fragmentsById: Map<string, Fragment>,
	annotations: Record<string, FragmentAnnotation>
): ThemeFragment[] {
	const seen = new Set<string>();
	const out: ThemeFragment[] = [];
	for (const r of rows) {
		for (const fid of r.fragmentIds) {
			if (seen.has(fid)) continue;
			seen.add(fid);
			const f = fragmentsById.get(fid);
			if (!f) continue;
			const ann = annotations[fid]?.segment_tags;
			out.push({
				segment_id: f.id,
				text: f.text,
				char_start: 0,
				char_end: f.text.length,
				interview_id: speakerIdOf(f),
				question_id: '',
				sentiment: ann?.sentiment_score ?? 0,
				emotions: ann?.emotions ?? [],
				flags: [],
				in_pull_quote: false,
				quote_id: null
			});
		}
	}
	return out.sort((a, b) => a.segment_id.localeCompare(b.segment_id));
}

function pickSummaryQuoteFromRows(
	rows: CorpusClusterRow[],
	fragmentsById: Map<string, Fragment>,
	annotations: Record<string, FragmentAnnotation>,
	prefer: 'positive' | 'negative'
): SummaryQuote | null {
	const candidates = new Map<string, { f: Fragment; sentiment: number; themes: string[] }>();
	for (const r of rows) {
		for (let i = 0; i < r.fragmentIds.length; i += 1) {
			const fid = r.fragmentIds[i];
			if (candidates.has(fid)) continue;
			const f = fragmentsById.get(fid);
			if (!f) continue;
			const ann = annotations[fid]?.segment_tags;
			candidates.set(fid, {
				f,
				sentiment: ann?.sentiment_score ?? 0,
				themes: ann?.themes ?? []
			});
		}
	}
	const pool = [...candidates.values()].filter((c) =>
		prefer === 'positive' ? c.sentiment > 0 : c.sentiment < 0
	);
	const set = pool.length ? pool : [...candidates.values()];
	if (!set.length) return null;
	const best = [...set].sort((a, b) => {
		const aScore = Math.abs(a.sentiment) * 0.6 + lengthScore(a.f.text) * 0.4;
		const bScore = Math.abs(b.sentiment) * 0.6 + lengthScore(b.f.text) * 0.4;
		return bScore - aScore;
	})[0];
	const sid = speakerIdOf(best.f);
	return {
		id: best.f.id,
		isStarred: false,
		interview_id: sid,
		question_id: '',
		text: best.f.text,
		sentiment: best.sentiment,
		themes: best.themes,
		score: Math.abs(best.sentiment) * 0.6 + lengthScore(best.f.text) * 0.4
	};
}

type CorpusFindingSpec = {
	id: Finding['id'];
	scopeTheme: 'clinical_trials' | 'treatment' | 'condition_specific';
	tone: Finding['tone'];
	prefer: 'positive' | 'negative';
	defaultEyebrow: string;
	templatedHeadline: (top: string[]) => string;
	templatedDetail: (rows: CorpusClusterRow[], dist: Distribution) => string;
	figureFrom: (dist: Distribution) => number;
	rankBy: (a: CorpusClusterRow, b: CorpusClusterRow) => number;
	floor: (r: CorpusClusterRow) => boolean;
};

/** Pretty inline label for use mid-sentence — drops parenthetical
 *  disambiguation ("Side effects (as barrier)" → "side effects") and lowers
 *  the first letter on words that aren't acronyms. */
function inlineClusterLabel(label: string): string {
	const stripped = label.replace(/\s*\([^)]*\)\s*/g, '').trim();
	return stripped
		.split(/(\s+)/)
		.map((tok) => (/^[A-Z0-9-]+$/.test(tok) ? tok : tok.toLowerCase()))
		.join('');
}

function joinNames(names: string[]): string {
	if (!names.length) return '';
	if (names.length === 1) return names[0];
	if (names.length === 2) return `${names[0]} and ${names[1]}`;
	return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

const FINDING_SPECS: CorpusFindingSpec[] = [
	{
		id: 'negative-treatment',
		scopeTheme: 'treatment',
		tone: 'negative',
		prefer: 'negative',
		defaultEyebrow: 'Drivers of negative treatment sentiment',
		templatedHeadline: (top) =>
			`${top.length ? joinNames(top) : 'Treatment'} drove the loudest negative reactions.`.replace(
				/^[a-z]/,
				(c) => c.toUpperCase()
			),
		templatedDetail: (rows, dist) => {
			const total = dist.positive + dist.neutral + dist.negative;
			return `Across the ${rows.length} keyword clusters that surfaced most in negative treatment talk, ${dist.negative} of the underlying ${total} fragments came back negative.`;
		},
		figureFrom: (d) => d.negative,
		rankBy: (a, b) =>
			b.negative - a.negative ||
			b.negative / b.blocks.length - a.negative / a.blocks.length ||
			b.blocks.length - a.blocks.length,
		floor: (r) => r.negative >= 2 && r.blocks.length >= MIN_CLUSTER_N
	},
	{
		id: 'negative-trial',
		scopeTheme: 'clinical_trials',
		tone: 'negative',
		prefer: 'negative',
		defaultEyebrow: 'Drivers of negative trial sentiment',
		templatedHeadline: (top) =>
			`${top.length ? joinNames(top) : 'Trial logistics'} drove the negative reaction to clinical trials.`.replace(
				/^[a-z]/,
				(c) => c.toUpperCase()
			),
		templatedDetail: (rows, dist) => {
			const total = dist.positive + dist.neutral + dist.negative;
			return `Across the ${rows.length} keyword clusters that surfaced most in negative trial talk, ${dist.negative} of the underlying ${total} fragments came back negative.`;
		},
		figureFrom: (d) => d.negative,
		rankBy: (a, b) =>
			b.negative - a.negative ||
			b.negative / b.blocks.length - a.negative / a.blocks.length ||
			b.blocks.length - a.blocks.length,
		floor: (r) => r.negative >= 2 && r.blocks.length >= MIN_CLUSTER_N
	},
	{
		id: 'positive-treatment',
		scopeTheme: 'treatment',
		tone: 'positive',
		prefer: 'positive',
		defaultEyebrow: 'Drivers of positive treatment sentiment',
		templatedHeadline: (top) =>
			`${top.length ? joinNames(top) : 'Treatment'} drew the warmest positive reactions.`.replace(
				/^[a-z]/,
				(c) => c.toUpperCase()
			),
		templatedDetail: (rows, dist) => {
			const total = dist.positive + dist.neutral + dist.negative;
			return `Across the ${rows.length} keyword clusters that surfaced most in positive treatment talk, ${dist.positive} of the underlying ${total} fragments came back positive.`;
		},
		figureFrom: (d) => d.positive,
		rankBy: (a, b) =>
			b.positive - a.positive ||
			b.positive / b.blocks.length - a.positive / a.blocks.length ||
			b.blocks.length - a.blocks.length,
		floor: (r) => r.positive >= 2 && r.blocks.length >= MIN_CLUSTER_N
	}
];

function buildOneCorpusFinding(
	spec: CorpusFindingSpec,
	points: Datapoint[],
	annotations: Record<string, FragmentAnnotation>,
	fragmentsById: Map<string, Fragment>,
	copy: FindingCopy | undefined
): Finding | null {
	const scoped = points.filter((p) => {
		const themes = annotations[p.id]?.segment_tags?.themes ?? [];
		return themes.includes(spec.scopeTheme);
	});
	if (!scoped.length) return null;

	const rows = dropSelfDrivers(buildCorpusClusterRows(scoped), spec.scopeTheme)
		.filter(spec.floor)
		.sort(spec.rankBy)
		.slice(0, TOP_K);
	if (!rows.length) return null;

	const dist = aggregateDistribution(rows);
	const total = dist.positive + dist.neutral + dist.negative;
	const figureVal = spec.figureFrom(dist);
	const topLabels = rows.slice(0, 3).map((r) => inlineClusterLabel(r.clusterLabel));
	const templatedHeadline = spec.templatedHeadline(topLabels);
	const templatedDetail = spec.templatedDetail(rows, dist);
	const labelWord = spec.prefer === 'positive' ? 'positive' : 'negative';

	return {
		id: spec.id,
		tone: spec.tone,
		eyebrow: copy?.eyebrow ?? spec.defaultEyebrow,
		stat: {
			value: String(figureVal),
			caption: `${labelWord} mentions · ${total} fragments`
		},
		headline: copy?.headline ?? templatedHeadline,
		detail: templatedDetail,
		lede: copy?.lede,
		analysis: copy?.analysis,
		clusters: rowsToClusterBars(rows),
		distribution: dist,
		quote: pickSummaryQuoteFromRows(rows, fragmentsById, annotations, spec.prefer),
		fragments: fragmentsFromRows(rows, fragmentsById, annotations)
	};
}

/** Build the top two findings for a corpus-based indication. Returns [lead,
 *  second] picked from the most-negative-loaded scopes first; positive
 *  treatment falls in only when no second negative finding qualifies. */
function buildCorpusFindings(
	points: Datapoint[],
	annotations: Record<string, FragmentAnnotation>,
	fragmentsById: Map<string, Fragment>,
	leadCopy: FindingCopy | undefined,
	secondCopy: FindingCopy | undefined
): { leadFinding: Finding | null; secondFinding: Finding | null } {
	const all = FINDING_SPECS.map((spec) =>
		buildOneCorpusFinding(spec, points, annotations, fragmentsById, undefined)
	).filter((f): f is Finding => f !== null);

	if (!all.length) return { leadFinding: null, secondFinding: null };

	// Lead = whichever finding has the most absolute supporting signal (count
	// on the labelled side). Second = next, picking opposite tone where
	// possible so the page surfaces a richer story than two negative cells.
	const ranked = [...all].sort((a, b) => {
		const aSig =
			a.tone === 'positive' ? a.distribution.positive : a.distribution.negative;
		const bSig =
			b.tone === 'positive' ? b.distribution.positive : b.distribution.negative;
		return bSig - aSig;
	});

	const lead = ranked[0];
	const second = ranked.find((f) => f.id !== lead.id) ?? null;

	const applyCopy = (f: Finding | null, copy: FindingCopy | undefined): Finding | null => {
		if (!f) return null;
		if (!copy) return f;
		return {
			...f,
			eyebrow: copy.eyebrow ?? f.eyebrow,
			headline: copy.headline ?? f.headline,
			lede: copy.lede ?? f.lede,
			analysis: copy.analysis ?? f.analysis
		};
	};

	return {
		leadFinding: applyCopy(lead, leadCopy),
		secondFinding: applyCopy(second, secondCopy)
	};
}

// --- Obesity (wctglpdemo) ---------------------------------------------------

function buildObesity(indicationId: string, cfg: ExecSummaryConfig): ExecSummaryData {
	const annBySeg = new Map(glp1Anns.map((a) => [a.segment_id, a]));
	const segById = new Map(glp1Segments.map((s) => [s.segment_id, s]));

	// Datapoints: themed annotations with text from the segment they belong to.
	const themed = glp1Anns.filter((a) => a.themes.length > 0);
	const points: Datapoint[] = themed
		.map((a): Datapoint | null => {
			const s = segById.get(a.segment_id);
			if (!s) return null;
			return {
				id: a.segment_id,
				sentiment: a.sentiment,
				text: s.text,
				speakerId: a.interview_id
			};
		})
		.filter((p): p is Datapoint => !!p);

	const axes = evaluateAxes(
		cfg.sentiment_axes,
		points,
		(text, clusterId) => {
			const counts = matcher.keywordCounts([text]);
			return counts.some((c) => c.keywordId === clusterId);
		},
		(pointId) => {
			const a = annBySeg.get(pointId);
			if (!a) return null;
			return { themes: a.themes, subthemes: a.subthemes ?? [] };
		}
	);

	// Anchor quotes: filter annotations by the anchor subtheme, prefer
	// quote_bank entries when their segment_ids intersect (they're hand-scored,
	// stronger), else fall back to raw segment text. Same source-of-truth as
	// the LN/MS path (codebook subthemes), but ranking gets a quote_bank
	// shortcut when available.
	const anchor = cfg.anchor_subtheme;
	let anchorQuotes: AnchorQuote[] = [];
	if (anchor?.id) {
		const matchingAnns = glp1Anns.filter((a) =>
			(a.subthemes ?? []).includes(anchor.id)
		);
		const matchingSegIds = new Set(matchingAnns.map((a) => a.segment_id));
		// Pass 1: quote_bank entries whose segment_ids hit the matching pool.
		const bankHits: AnchorQuote[] = glp1Quotes
			.filter((q) => (q.segment_ids ?? []).some((sid) => matchingSegIds.has(sid)))
			.sort((a, b) => (b.quote_score?.overall ?? 0) - (a.quote_score?.overall ?? 0))
			.slice(0, 3)
			.map((q): AnchorQuote => ({
				id: q.quote_id,
				text: q.text,
				speakerId: q.interview_id,
				speakerLabel: titleCase(q.interview_id),
				sentiment: q.sentiment,
				themes: q.themes,
				subthemes: q.subthemes ?? [],
				questionId: q.question_id
			}));
		if (bankHits.length >= 3) {
			anchorQuotes = bankHits;
		} else {
			// Pass 2: fall back to raw matching segments, ranked by the same
			// heuristic the corpora-side uses.
			const segCandidates: AnchorQuote[] = matchingAnns
				.map((a): AnchorQuote | null => {
					const seg = segById.get(a.segment_id);
					if (!seg) return null;
					return {
						id: a.segment_id,
						text: seg.text,
						speakerId: a.interview_id,
						speakerLabel: titleCase(a.interview_id),
						sentiment: a.sentiment,
						themes: a.themes,
						subthemes: a.subthemes ?? [],
						questionId: seg.question_id ?? null
					};
				})
				.filter((q): q is AnchorQuote => !!q);
			anchorQuotes = pickTopAnchorQuotes(segCandidates, 3);
		}
	}

	// Obesity findings already exist as a runtime build — pluck lead/second.
	const obesityFindings = buildObesityFindings();
	const blurbs = getBlurbsForIndication(indicationId);
	const applyCopy = (f: Finding | undefined, copy: FindingCopy | undefined): Finding | null => {
		if (!f) return null;
		if (!copy) return f;
		return {
			...f,
			eyebrow: copy.eyebrow ?? f.eyebrow,
			headline: copy.headline ?? f.headline,
			lede: copy.lede ?? f.lede,
			analysis: copy.analysis ?? f.analysis
		};
	};
	const leadFinding = applyCopy(obesityFindings[0], blurbs?.lead_finding);
	const secondFinding = applyCopy(obesityFindings[1], blurbs?.second_finding);

	// Teaser quote: longest verbatim from the obesity quote_bank that isn't
	// already in the top-3 stacked. Long quote: highest-scored quote overall.
	const stackedIds = new Set(anchorQuotes.map((q) => q.id));
	const teaserSource = [...glp1Quotes]
		.filter((q) => !stackedIds.has(q.quote_id))
		.sort((a, b) => (b.quote_score?.overall ?? 0) - (a.quote_score?.overall ?? 0))[0];
	const teaserQuote: AnchorQuote | null = teaserSource
		? {
				id: teaserSource.quote_id,
				text: teaserSource.text,
				speakerId: teaserSource.interview_id,
				speakerLabel: titleCase(teaserSource.interview_id),
				sentiment: teaserSource.sentiment,
				themes: teaserSource.themes,
				subthemes: teaserSource.subthemes ?? [],
				questionId: teaserSource.question_id
			}
		: null;
	const longSource = [...glp1Quotes].sort(
		(a, b) => (b.quote_score?.overall ?? 0) - (a.quote_score?.overall ?? 0)
	)[0];
	const longQuote: AnchorQuote | null = longSource
		? {
				id: longSource.quote_id,
				text: longSource.text,
				speakerId: longSource.interview_id,
				speakerLabel: titleCase(longSource.interview_id),
				sentiment: longSource.sentiment,
				themes: longSource.themes,
				subthemes: longSource.subthemes ?? [],
				questionId: longSource.question_id
			}
		: null;

	return {
		indication: indicationId,
		corpusKind: 'interview',
		headlineStats: [
			{ value: glp1Stats.interviews, label: 'interviews' },
			{ value: glp1Stats.themes, label: 'themes' },
			{ value: glp1Stats.segments, label: 'moments' },
			{ value: glp1Stats.quotes, label: 'pull quotes' }
		],
		overallLean: {
			id: '__overall__',
			label: 'Overall',
			total: glp1Lean.total,
			positive: glp1Lean.positive,
			negative: glp1Lean.negative,
			neutral: glp1Lean.neutral,
			posPct: glp1Lean.posPct,
			negPct: glp1Lean.negPct,
			neuPct: glp1Lean.neutralPct,
			lean: glp1Lean.lean
		},
		axes,
		anchorSubtheme: anchor?.id ? anchor : null,
		anchorQuotes,
		overviewBlurb: blurbs?.overview ?? getOverviewBlurb(indicationId),
		sentimentLeanBlurb: blurbs?.sentiment_lean ?? null,
		anchorSubthemeBlurb: blurbs?.anchor_subtheme ?? null,
		leadFinding,
		secondFinding,
		bridgeNarrative: blurbs?.bridge_narrative ?? null,
		teaserQuote,
		longQuote
	};
}

// --- Corpus-based (LN, MS, others as they land) -----------------------------

function buildFromCorpus(indicationId: string, cfg: ExecSummaryConfig): ExecSummaryData {
	const bundles = bundlesForIndication(indicationId);
	const fragments: Fragment[] = bundles.flatMap((b) => b.fragments);
	const annotations: Record<string, FragmentAnnotation> = Object.assign(
		{},
		...bundles.map((b) => b.annotations)
	);

	const themed: Datapoint[] = [];
	const themedFragments: Fragment[] = [];
	for (const f of fragments) {
		const ann = annotations[f.id]?.segment_tags;
		if (!ann) continue;
		if (!(ann.themes ?? []).length) continue;
		if (typeof ann.sentiment_score !== 'number') continue;
		themed.push({
			id: f.id,
			sentiment: ann.sentiment_score,
			text: f.text,
			speakerId: speakerIdOf(f)
		});
		themedFragments.push(f);
	}

	const pos = themed.filter((p) => p.sentiment > 0).length;
	const neg = themed.filter((p) => p.sentiment < 0).length;
	const neu = themed.length - pos - neg;
	const total = themed.length;
	const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

	const axes = evaluateAxes(
		cfg.sentiment_axes,
		themed,
		(text, clusterId) => {
			const counts = matcher.keywordCounts([text]);
			return counts.some((c) => c.keywordId === clusterId);
		},
		(pointId) => {
			const ann = annotations[pointId]?.segment_tags;
			if (!ann) return null;
			return { themes: ann.themes ?? [], subthemes: ann.subthemes ?? [] };
		}
	);

	const speakers = new Set(themed.map((p) => p.speakerId)).size;
	const distinctThemes = new Set<string>();
	for (const f of themedFragments) {
		for (const t of annotations[f.id]?.segment_tags?.themes ?? []) distinctThemes.add(t);
	}

	// Anchor: filter themed fragments whose annotation subthemes include the
	// configured anchor subtheme. No quote_bank for these corpora, so we rank
	// by sentiment-strength + length sweet-spot.
	const anchor = cfg.anchor_subtheme;
	const anchorCandidates: AnchorQuote[] = anchor?.id
		? themedFragments
			.filter((f) => (annotations[f.id]?.segment_tags?.subthemes ?? []).includes(anchor.id))
			.map((f): AnchorQuote => {
				const ann = annotations[f.id]!.segment_tags!;
				const sid = speakerIdOf(f);
				return {
					id: f.id,
					text: f.text,
					speakerId: sid,
					speakerLabel: speakerLabel(sid),
					sentiment: ann.sentiment_score ?? 0,
					themes: ann.themes ?? [],
					subthemes: ann.subthemes ?? []
				};
			})
		: [];
	const anchorQuotes = pickTopAnchorQuotes(anchorCandidates, 3);

	// Lead + second findings, derived from clustered theme rows.
	const fragmentsById = new Map(fragments.map((f) => [f.id, f]));
	const blurbs = getBlurbsForIndication(indicationId);
	const { leadFinding, secondFinding } = buildCorpusFindings(
		themed,
		annotations,
		fragmentsById,
		blurbs?.lead_finding,
		blurbs?.second_finding
	);

	// Teaser quote: highest-scored anchor candidate not already in the top 3.
	const stackedIds = new Set(anchorQuotes.map((q) => q.id));
	const remaining = anchorCandidates.filter((c) => !stackedIds.has(c.id));
	const teaserQuote = pickTopAnchorQuotes(remaining, 1)[0] ?? null;

	// Long quote: best long-form anchor — same scoring as the stack but with
	// the length sweet-spot pushed to 200-340 chars for full-width display.
	const longSweet = (text: string): number => {
		const n = text.length;
		if (n < 120) return n / 120;
		if (n > 340) return Math.max(0, 1 - (n - 340) / 400);
		return 1;
	};
	const longQuote: AnchorQuote | null =
		[...anchorCandidates]
			.sort((a, b) => {
				const aScore = Math.abs(a.sentiment) * 0.5 + longSweet(a.text) * 0.5;
				const bScore = Math.abs(b.sentiment) * 0.5 + longSweet(b.text) * 0.5;
				return bScore - aScore;
			})
			.find((c) => !stackedIds.has(c.id) && c.id !== teaserQuote?.id) ?? null;

	return {
		indication: indicationId,
		corpusKind: 'fragments',
		headlineStats: [
			{ value: speakers, label: 'authors' },
			{ value: distinctThemes.size, label: 'themes' },
			{ value: total, label: 'moments' },
			{ value: anchorCandidates.length, label: 'anchor pool' }
		],
		overallLean: {
			id: '__overall__',
			label: 'Overall',
			total,
			positive: pos,
			negative: neg,
			neutral: neu,
			posPct: pct(pos),
			negPct: pct(neg),
			neuPct: pct(neu),
			lean: leanFromCounts(pos, neg, neu)
		},
		axes,
		anchorSubtheme: anchor?.id ? anchor : null,
		anchorQuotes,
		overviewBlurb: blurbs?.overview ?? getOverviewBlurb(indicationId),
		sentimentLeanBlurb: blurbs?.sentiment_lean ?? null,
		anchorSubthemeBlurb: blurbs?.anchor_subtheme ?? null,
		leadFinding,
		secondFinding,
		bridgeNarrative: blurbs?.bridge_narrative ?? null,
		teaserQuote,
		longQuote
	};
}

// --- Public entry -----------------------------------------------------------

/** Returns a unified ExecSummaryData for the page to render, or null when the
 *  indication has no exec-summary config (the page should show a "not
 *  configured" placeholder). */
export function getExecSummaryData(indicationId: string): ExecSummaryData | null {
	const cfg = getExecSummaryConfig(indicationId);
	if (!cfg) return null;
	if (indicationId === 'obesity') return buildObesity(indicationId, cfg);
	if (bundlesForIndication(indicationId).length === 0) return null;
	return buildFromCorpus(indicationId, cfg);
}

/** Tells the page whether it has data to render for this indication. */
export function hasExecSummaryData(indicationId: string): boolean {
	const cfg = getExecSummaryConfig(indicationId);
	if (!cfg) return false;
	if (indicationId === 'obesity') return true;
	return bundlesForIndication(indicationId).length > 0;
}
