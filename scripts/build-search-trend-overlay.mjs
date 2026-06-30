#!/usr/bin/env node
/**
 * build-search-trend-overlay.mjs
 *
 * Reads the raw Google-Trends export at `lnsearchvolumetrends.json`, joins it
 * with weekly patient-mention counts derived from the `ln_reddit_2026q1` forum
 * corpus, and writes the digital-data envelope to
 *   src/lib/content/disease-insights/lupus-nephritis/search/treatment_trends_us.json
 *
 * Mention counting rules:
 *   - Source dedupe: a fragment counts once per (post_id, comment_id) tuple.
 *     The corpus carries both sentence-split children and analyst-merged
 *     parents that share that tuple; we collapse them to avoid double-counting
 *     the same user moment.
 *   - Variant match: case-insensitive substring against the fragment text.
 *     One mention per query per (source, week).
 *   - Week bucket: each fragment's `date_observed` is rounded down to the
 *     Sunday-of-week (UTC). That matches the Trends export, which is also
 *     Sunday-weekly.
 *
 * Deterministic, no LLM. Re-run with `node scripts/build-search-trend-overlay.mjs`.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const TRENDS_INPUT = resolve(REPO_ROOT, 'lnsearchvolumetrends.json');
const CORPUS_DIR = resolve(
	REPO_ROOT,
	'src/lib/content/corpora/ln_reddit_2026q1/fragments'
);
const OUT_PATH = resolve(
	REPO_ROOT,
	'src/lib/content/disease-insights/lupus-nephritis/search/treatment_trends_us.json'
);

/**
 * One entry per Google-Trends column in the raw export. Each maps to a display
 * label (what the chart shows) and a variant list used for corpus matching.
 * Cluster ids point back to lupus-nephritis/lexicon/keyword_clusters.json
 * where applicable; CAR-T and the broad-research / clinical-trials queries
 * have no exact cluster yet and use hand-curated variants.
 */
const QUERIES = [
	{
		key: 'lupus belimumab: (United States)',
		query: 'lupus belimumab',
		display_label: 'Belimumab (Benlysta)',
		cluster_id: 'belimumab',
		match_variants: ['belimumab', 'benlysta']
	},
	{
		key: 'lupus anifrolumab: (United States)',
		query: 'lupus anifrolumab',
		display_label: 'Anifrolumab (Saphnelo)',
		cluster_id: 'anifrolumab',
		match_variants: ['anifrolumab', 'saphnelo']
	},
	{
		key: 'lupus car-t: (United States)',
		query: 'lupus car-t',
		display_label: 'CAR-T for lupus',
		cluster_id: null,
		match_variants: ['car-t', 'car t cell', 'car-t cell', 'cart cell', 'cd19 car']
	},
	{
		key: 'lupus clinical trials: (United States)',
		query: 'lupus clinical trials',
		display_label: 'Clinical trials',
		cluster_id: null,
		match_variants: [
			'clinical trial',
			'phase 1 trial',
			'phase i trial',
			'phase 2 trial',
			'phase ii trial',
			'phase 3 trial',
			'phase iii trial',
			'trial enrollment',
			'enrolled in a trial',
			'enroll in a trial',
			'the trial'
		]
	},
	{
		key: 'lupus treatment research: (United States)',
		query: 'lupus treatment research',
		display_label: 'Treatment research',
		cluster_id: null,
		match_variants: [
			'new treatment',
			'novel treatment',
			'new therapy',
			'novel therapy',
			'experimental treatment',
			'investigational treatment',
			'breakthrough',
			'treatment research',
			'research study'
		]
	}
];

// ---------- Date utilities ----------

/** Parse "5/23/21" → "2021-05-23". Returns null if malformed. */
function trendsWeekToIso(s) {
	const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(s);
	if (!m) return null;
	const month = Number(m[1]);
	const day = Number(m[2]);
	const yy = Number(m[3]);
	const year = 2000 + yy;
	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Round an ISO date or datetime down to the Sunday-of-week (UTC). */
function sundayOfWeekIso(value) {
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return null;
	const dayIdx = d.getUTCDay(); // 0=Sun
	const sunday = new Date(
		Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dayIdx)
	);
	return sunday.toISOString().slice(0, 10);
}

// ---------- Corpus loading ----------

async function loadCorpusFragments() {
	const sources = ['social_post.json', 'social_comment.json'];
	const all = [];
	for (const f of sources) {
		const raw = await readFile(resolve(CORPUS_DIR, f), 'utf8');
		const parsed = JSON.parse(raw);
		const frags = Array.isArray(parsed?.fragments) ? parsed.fragments : [];
		for (const fr of frags) all.push(fr);
	}
	return all;
}

/**
 * Collapse fragments to one row per source tuple (post_id, comment_id). The
 * row's text is the longest text we observed for that tuple — picks the
 * analyst-merged parent over its sentence-split children when available.
 */
function dedupeBySourceTuple(fragments) {
	const map = new Map();
	for (const fr of fragments) {
		const ref = fr.source_ref ?? {};
		const tupleKey = `${ref.post_id ?? ''}::${ref.comment_id ?? ''}`;
		const date = sundayOfWeekIso(fr.date_observed);
		if (!date) continue;
		const text = typeof fr.text === 'string' ? fr.text : '';
		const existing = map.get(tupleKey);
		if (!existing || text.length > existing.text.length) {
			map.set(tupleKey, { tupleKey, date, text });
		}
	}
	return Array.from(map.values());
}

// ---------- Mention counting ----------

function buildEmptyCounts(weekIsos) {
	const m = new Map();
	for (const iso of weekIsos) m.set(iso, 0);
	return m;
}

function countMentions(dedupedRows, query, weekIsoSet) {
	const counts = new Map();
	const variants = query.match_variants.map((v) => v.toLowerCase());
	for (const row of dedupedRows) {
		if (!weekIsoSet.has(row.date)) continue;
		const text = row.text.toLowerCase();
		const hit = variants.some((v) => text.includes(v));
		if (!hit) continue;
		counts.set(row.date, (counts.get(row.date) ?? 0) + 1);
	}
	return counts;
}

// ---------- Main ----------

async function main() {
	const trendsRaw = await readFile(TRENDS_INPUT, 'utf8');
	const trendsRows = JSON.parse(trendsRaw);

	// Convert trends rows to {iso, values{}}
	const weekRecords = trendsRows
		.map((row) => {
			const iso = trendsWeekToIso(row.Week);
			if (!iso) return null;
			const values = {};
			for (const q of QUERIES) {
				const raw = row[q.key];
				const n = Number(raw);
				values[q.query] = Number.isFinite(n) ? n : 0;
			}
			return { iso, values };
		})
		.filter((r) => r !== null)
		.sort((a, b) => a.iso.localeCompare(b.iso));

	const weekIsos = weekRecords.map((r) => r.iso);
	const weekIsoSet = new Set(weekIsos);

	const fragments = await loadCorpusFragments();
	const deduped = dedupeBySourceTuple(fragments);

	const corpusDateMin = deduped.reduce(
		(min, r) => (min === null || r.date < min ? r.date : min),
		null
	);
	const corpusDateMax = deduped.reduce(
		(max, r) => (max === null || r.date > max ? r.date : max),
		null
	);

	const series = QUERIES.map((q) => {
		const mentionMap = countMentions(deduped, q, weekIsoSet);
		const search_index = weekRecords.map((r) => r.values[q.query]);
		const mention_count = weekIsos.map((iso) => mentionMap.get(iso) ?? 0);
		return {
			query: q.query,
			display_label: q.display_label,
			cluster_id: q.cluster_id,
			match_variants: q.match_variants,
			search_index,
			mention_count
		};
	});

	const envelope = {
		id: 'lupus_nephritis_treatment_trends_us',
		type: 'search_volume_timeseries',
		indication_id: 'lupus_nephritis',
		therapeutic_area_ids: ['immunology', 'nephrology'],
		title: 'Lupus treatment-research search trends (US, weekly)',
		subtitle:
			'Google Trends index (0–100, US) for five LN/SLE treatment queries, paired with patient-mention counts derived from the ln_reddit_2026q1 forum corpus.',
		unit: 'google_trends_index_0_100',
		geography: 'US',
		time_period: {
			start_iso: weekIsos[0] ?? null,
			end_iso: weekIsos[weekIsos.length - 1] ?? null,
			grain: 'week_start_sunday',
			week_count: weekIsos.length
		},
		source: {
			search: {
				type: 'google_trends',
				notes:
					'Weekly index, US. 0 means below the Google Trends privacy floor for that week, not literal zero. Exported manually from trends.google.com.'
			},
			mentions: {
				type: 'corpus_derivation',
				corpus_ids: ['ln_reddit_2026q1'],
				partitions: ['social_post', 'social_comment'],
				method:
					'Deduplicate fragments by (post_id, comment_id), keeping the longest text per tuple. Case-insensitive substring match of `match_variants` against fragment text. Date_observed rounded down to Sunday-of-week (UTC).',
				generator: 'scripts/build-search-trend-overlay.mjs',
				corpus_observed_window: {
					start_iso: corpusDateMin,
					end_iso: corpusDateMax,
					note:
						'Mention overlay is only meaningful in this window; weeks outside it are zero by definition.'
				}
			}
		},
		dimensions: ['query', 'week'],
		measures: ['search_index', 'mention_count'],
		weeks: weekIsos,
		series
	};

	await writeFile(OUT_PATH, JSON.stringify(envelope, null, 2) + '\n', 'utf8');

	// Console summary for the operator
	const totalMentions = series.reduce(
		(acc, s) => acc + s.mention_count.reduce((a, n) => a + n, 0),
		0
	);
	console.log(`wrote ${OUT_PATH}`);
	console.log(
		`weeks: ${weekIsos.length}  (${weekIsos[0]} → ${weekIsos[weekIsos.length - 1]})`
	);
	console.log(
		`corpus tuples: ${deduped.length}  observed window ${corpusDateMin} → ${corpusDateMax}`
	);
	console.log(`total mentions matched: ${totalMentions}`);
	for (const s of series) {
		const sum = s.mention_count.reduce((a, n) => a + n, 0);
		const peakIdx = s.search_index.reduce(
			(best, v, i) => (v > s.search_index[best] ? i : best),
			0
		);
		console.log(
			`  ${s.query.padEnd(26)}  mentions=${String(sum).padStart(3)}  search peak=${s.search_index[peakIdx]} @ ${weekIsos[peakIdx]}`
		);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
