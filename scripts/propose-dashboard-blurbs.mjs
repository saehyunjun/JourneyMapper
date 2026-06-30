/**
 * propose-dashboard-blurbs.mjs
 *
 * Analyst-voice copy for the executive-summary dashboard: one overview
 * paragraph + per-finding lede & analysis blurb, per indication. Layered over
 * the existing programmatic copy in executive-summary.ts and the LN
 * placeholder copy in routes/patientlyiq/+page.svelte — the UI prefers the
 * generated text when present and falls back to the template strings.
 *
 * One Haiku 4.5 call per indication (overview + 4 findings batched into one
 * structured-output response). System prompt is cached so the second
 * indication is a prompt-cache hit.
 *
 * Inputs (obesity, real corpus):
 *   - segments.json + segment_tags.json → per-cluster annotated segments
 *   - keyword_usage.json                → cluster matches (cluster, segment_id)
 *   - quote_bank.json                   → verbatim sample quotes for grounding
 * Inputs (lupus_nephritis, placeholder):
 *   - LN mock data duplicated below — keep in sync with the LN_* blocks in
 *     src/routes/patientlyiq/+page.svelte until LN gets real transcripts.
 *
 * Output: src/lib/content/wctglpdemo-data/dashboard_blurbs.json
 *
 * Run:
 *   node scripts/propose-dashboard-blurbs.mjs                # missing only
 *   node scripts/propose-dashboard-blurbs.mjs obesity        # one indication
 *   node scripts/propose-dashboard-blurbs.mjs --force        # all, regenerate
 *
 * Requires ANTHROPIC_API_KEY in JourneyMapper/.env (or env). Note the
 * shell-override gotcha — if you get 401, run with `env -u ANTHROPIC_API_KEY`.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SEGMENTS_FILE = 'src/lib/content/wctglpdemo-data/segments.json';
const TAGS_FILE = 'src/lib/content/wctglpdemo-data/segment_tags.json';
const KW_USAGE_FILE = 'src/lib/content/wctglpdemo-data/keyword_usage.json';
const QUOTES_FILE = 'src/lib/content/wctglpdemo-data/quote_bank.json';
const CODEBOOK_FILE = 'src/lib/content/wctglpdemo-data/codebook.json';
const OUTPUT_FILE = 'src/lib/content/wctglpdemo-data/dashboard_blurbs.json';

const MS_CORPUS = 'src/lib/content/corpora/ms_reddit_2026q1';

const MODEL = 'claude-haiku-4-5';

if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));
if (!process.env.ANTHROPIC_API_KEY) {
	console.error('x ANTHROPIC_API_KEY is not set.');
	console.error('  Add it to JourneyMapper/.env or export it.');
	process.exit(1);
}

// --- Args ---
const args = process.argv.slice(2);
const force = args.includes('--force');
const argIndications = args.filter((a) => !a.startsWith('-'));

const KNOWN_INDICATIONS = ['obesity', 'lupus_nephritis', 'multiple_sclerosis'];
for (const id of argIndications) {
	if (!KNOWN_INDICATIONS.includes(id)) {
		console.error(`x Unknown indication "${id}". Known: ${KNOWN_INDICATIONS.join(', ')}`);
		process.exit(1);
	}
}

// --- Obesity input derivation (port of executive-summary.ts logic) ---------
// Same ranking / filters as the runtime so the generated copy matches the
// findings the UI actually shows. If MIN_CLUSTER_N / TOP_K / HEADLINE_K drift
// from executive-summary.ts, the blurbs will name clusters the UI doesn't.

const MIN_CLUSTER_N = 3;
const TOP_K = 5;

function buildObesityInput() {
	const segments = JSON.parse(readFileSync(resolve(ROOT, SEGMENTS_FILE), 'utf8'));
	const tags = JSON.parse(readFileSync(resolve(ROOT, TAGS_FILE), 'utf8'));
	const usage = JSON.parse(readFileSync(resolve(ROOT, KW_USAGE_FILE), 'utf8'));
	const quotesData = JSON.parse(readFileSync(resolve(ROOT, QUOTES_FILE), 'utf8'));
	const codebook = JSON.parse(readFileSync(resolve(ROOT, CODEBOOK_FILE), 'utf8'));

	const annBySeg = new Map();
	for (const a of tags.annotations) annBySeg.set(a.segment_id, a);
	const segById = new Map();
	for (const s of segments.segments) segById.set(s.segment_id, s);

	const themed = tags.annotations.filter((a) => (a.themes ?? []).length > 0);
	const interviews = new Set(themed.map((a) => a.interview_id));
	const themesSet = new Set(themed.flatMap((a) => a.themes));
	const pos = themed.filter((a) => a.sentiment > 0).length;
	const neg = themed.filter((a) => a.sentiment < 0).length;
	const neu = themed.length - pos - neg;
	const pct = (n) => Math.round((n / themed.length) * 100);

	const overviewStats = {
		interviews: interviews.size,
		segments: themed.length,
		themes: themesSet.size,
		posPct: pct(pos),
		negPct: pct(neg),
		neutralPct: pct(neu),
		lean: pos > neg * 1.2 ? 'positive' : neg > pos * 1.2 ? 'negative' : 'mixed'
	};

	// Per-cluster annotated-segment join, scoped by an annotation predicate.
	function clusterRows(pred) {
		const rows = [];
		for (const cluster of usage.clusters) {
			const seen = new Set();
			const segs = [];
			for (const m of cluster.matches) {
				if (seen.has(m.segment_id)) continue;
				const a = annBySeg.get(m.segment_id);
				if (!a) continue;
				if (!pred(a)) continue;
				seen.add(m.segment_id);
				segs.push({ segment_id: m.segment_id, sentiment: a.sentiment, interview_id: a.interview_id });
			}
			if (!segs.length) continue;
			rows.push({
				cluster,
				segments: segs,
				positive: segs.filter((s) => s.sentiment > 0).length,
				negative: segs.filter((s) => s.sentiment < 0).length,
				neutral: segs.filter((s) => s.sentiment === 0).length
			});
		}
		return rows;
	}

	const negRank = (a, b) =>
		b.negative - a.negative ||
		b.negative / b.segments.length - a.negative / a.segments.length ||
		b.segments.length - a.segments.length;
	const posRank = (a, b) =>
		b.positive - a.positive ||
		b.positive / b.segments.length - a.positive / a.segments.length ||
		b.segments.length - a.segments.length;

	const trialRows = clusterRows((a) => (a.themes ?? []).includes('clinical_trials'));
	const tx = clusterRows((a) => (a.themes ?? []).includes('treatment'));

	const negTrial = trialRows
		.filter((r) => r.negative >= 2 && r.segments.length >= MIN_CLUSTER_N)
		.sort(negRank)
		.slice(0, TOP_K);
	const negTx = tx
		.filter((r) => r.negative >= 2 && r.segments.length >= MIN_CLUSTER_N)
		.sort(negRank)
		.slice(0, TOP_K);
	const posTx = tx
		.filter((r) => r.positive >= 3 && r.segments.length >= MIN_CLUSTER_N)
		.sort(posRank)
		.slice(0, TOP_K);
	const trialBarriers = clusterRows(() => true).filter(
		(r) => r.cluster.parent_subtheme === 'trial_barriers' && r.segments.length >= 2
	);
	const nonBarriers = trialBarriers
		.filter((r) => r.positive >= r.negative)
		.sort((a, b) => b.segments.length - a.segments.length)
		.slice(0, TOP_K);

	// Quote sampling: prefer quote_bank entries whose segment_ids intersect
	// the finding's segments; fall back to raw segment text. Sentiment-direction
	// filter so quotes match the finding's tone.
	function sampleQuotes(rows, tone, k = 6) {
		const segIds = new Set(rows.flatMap((r) => r.segments.map((s) => s.segment_id)));
		const pool = quotesData.quotes.filter((q) =>
			(q.segment_ids ?? []).some((sid) => segIds.has(sid))
		);
		const directed =
			tone === 'positive'
				? pool.filter((q) => q.sentiment > 0)
				: tone === 'negative'
					? pool.filter((q) => q.sentiment < 0)
					: pool;
		const picks = (directed.length ? directed : pool)
			.sort((a, b) => (b.quote_score?.overall ?? 0) - (a.quote_score?.overall ?? 0))
			.slice(0, k);
		// Fallback to raw segments if quote_bank doesn't cover the finding.
		if (picks.length < 2) {
			const segPool = [...segIds]
				.map((sid) => {
					const a = annBySeg.get(sid);
					const s = segById.get(sid);
					if (!a || !s) return null;
					return { interview_id: a.interview_id, text: s.text, sentiment: a.sentiment };
				})
				.filter(Boolean);
			const directedSeg =
				tone === 'positive'
					? segPool.filter((q) => q.sentiment > 0)
					: tone === 'negative'
						? segPool.filter((q) => q.sentiment < 0)
						: segPool;
			return (directedSeg.length ? directedSeg : segPool).slice(0, k).map((s) => ({
				text: s.text,
				interview_id: s.interview_id,
				sentiment: s.sentiment
			}));
		}
		return picks.map((q) => ({
			text: q.text,
			interview_id: q.interview_id,
			sentiment: q.sentiment
		}));
	}

	function describeFinding(id, eyebrow, tone, rows) {
		const positive = rows.reduce((acc, r) => {
			for (const s of r.segments) if (s.sentiment > 0) acc.add(s.segment_id);
			return acc;
		}, new Set()).size;
		const negative = rows.reduce((acc, r) => {
			for (const s of r.segments) if (s.sentiment < 0) acc.add(s.segment_id);
			return acc;
		}, new Set()).size;
		const neutral = rows.reduce((acc, r) => {
			for (const s of r.segments) if (s.sentiment === 0) acc.add(s.segment_id);
			return acc;
		}, new Set()).size;
		return {
			id,
			eyebrow,
			tone,
			distribution: { positive, neutral, negative },
			clusters: rows.map((r) => ({
				label: r.cluster.label,
				count: r.segments.length,
				positive: r.positive,
				neutral: r.neutral,
				negative: r.negative
			})),
			sample_quotes: sampleQuotes(rows, tone, 6)
		};
	}

	const findings = [
		describeFinding('negative-trial', 'Drivers of negative trial sentiment', 'negative', negTrial),
		describeFinding('negative-treatment', 'Drivers of negative treatment sentiment', 'negative', negTx),
		describeFinding('positive-treatment', 'Drivers of positive treatment sentiment', 'positive', posTx),
		describeFinding('trial-non-barriers', 'Non-issues for trial participation', 'neutral', nonBarriers)
	].filter((f) => f.clusters.length > 0);

	const linkable_targets = {
		themes: codebook.themes.map((t) => ({ id: t.id, label: t.label })),
		subthemes: codebook.themes.flatMap((t) =>
			(t.subthemes ?? []).map((s) => ({ id: s.id, label: s.label, parent_theme: t.id }))
		),
		findings: findings.map((f) => ({ id: f.id, label: f.eyebrow })),
		interviews: [...interviews].sort()
	};

	return {
		indication_label: 'GLP-1 obesity treatment',
		corpus_kind: 'real',
		overview_stats: overviewStats,
		linkable_targets,
		findings
	};
}

// --- MS input (real corpus, fragment-based) --------------------------------
// Derives from the ms_reddit_2026q1 corpus (167 posts + 3,115 comments).
// Subthemes from segment_tags annotations stand in for keyword clusters —
// MS doesn't have a cluster→fragment match index yet, but the codebook
// taxonomy is study-agnostic so subtheme ids are the natural cluster axis.

function buildMultipleSclerosisInput() {
	const annPost = JSON.parse(
		readFileSync(resolve(ROOT, MS_CORPUS, 'annotations/social_post.json'), 'utf8')
	).annotations;
	const annComment = JSON.parse(
		readFileSync(resolve(ROOT, MS_CORPUS, 'annotations/social_comment.json'), 'utf8')
	).annotations;
	const fragsPost = JSON.parse(
		readFileSync(resolve(ROOT, MS_CORPUS, 'fragments/social_post.json'), 'utf8')
	).fragments;
	const fragsComment = JSON.parse(
		readFileSync(resolve(ROOT, MS_CORPUS, 'fragments/social_comment.json'), 'utf8')
	).fragments;
	const codebook = JSON.parse(readFileSync(resolve(ROOT, CODEBOOK_FILE), 'utf8'));

	const allAnn = { ...annPost, ...annComment };
	const fragById = new Map();
	for (const f of fragsPost) fragById.set(f.id, f);
	for (const f of fragsComment) fragById.set(f.id, f);

	// Restrict to fragments that have themed sentiment annotations (the unit
	// the obesity build counts over — keeps the comparison apples-to-apples).
	const themed = [];
	for (const [fragId, dims] of Object.entries(allAnn)) {
		const seg = dims.segment_tags;
		if (!seg) continue;
		const themes = seg.themes ?? [];
		const subthemes = seg.subthemes ?? [];
		const sentiment = seg.sentiment_score;
		if (sentiment === null || sentiment === undefined) continue;
		if (!themes.length) continue;
		const frag = fragById.get(fragId);
		if (!frag) continue;
		themed.push({ fragId, sentiment, themes, subthemes, frag });
	}

	const authors = new Set(themed.map((t) => t.frag.source_ref?.author_handle_hash).filter(Boolean));
	const posts = themed.filter((t) => t.frag.content_source === 'social_post').length;
	const comments = themed.filter((t) => t.frag.content_source === 'social_comment').length;
	const themesSet = new Set(themed.flatMap((t) => t.themes));
	const pos = themed.filter((t) => t.sentiment > 0).length;
	const neg = themed.filter((t) => t.sentiment < 0).length;
	const neu = themed.length - pos - neg;
	const pct = (n) => (themed.length ? Math.round((n / themed.length) * 100) : 0);

	const overviewStats = {
		annotated_fragments: themed.length,
		posts,
		comments,
		distinct_authors: authors.size,
		themes: themesSet.size,
		posPct: pct(pos),
		negPct: pct(neg),
		neutralPct: pct(neu),
		lean: pos > neg * 1.2 ? 'positive' : neg > pos * 1.2 ? 'negative' : 'mixed'
	};

	// Subtheme label lookup from codebook (study-agnostic taxonomy).
	const subLabel = new Map();
	const subParent = new Map();
	for (const t of codebook.themes ?? []) {
		for (const s of t.subthemes ?? []) {
			subLabel.set(s.id, s.label);
			subParent.set(s.id, t.id);
		}
	}

	// Per-subtheme row scoped by a fragment predicate. Same shape as the
	// obesity buildObesityInput().clusterRows so describeFinding works as-is.
	function subthemeRows(pred) {
		const bySub = new Map();
		for (const t of themed) {
			if (!pred(t)) continue;
			for (const sub of t.subthemes) {
				const list = bySub.get(sub) ?? [];
				list.push({
					segment_id: t.fragId,
					sentiment: t.sentiment,
					interview_id: t.frag.source_ref?.post_id ?? null,
					text: t.frag.text
				});
				bySub.set(sub, list);
			}
		}
		const rows = [];
		for (const [subId, segs] of bySub.entries()) {
			rows.push({
				cluster: {
					id: subId,
					label: subLabel.get(subId) ?? subId,
					parent_subtheme: subId,
					parent_theme: subParent.get(subId) ?? null
				},
				segments: segs,
				positive: segs.filter((s) => s.sentiment > 0).length,
				negative: segs.filter((s) => s.sentiment < 0).length,
				neutral: segs.filter((s) => s.sentiment === 0).length
			});
		}
		return rows;
	}

	const negRank = (a, b) =>
		b.negative - a.negative ||
		b.negative / b.segments.length - a.negative / a.segments.length ||
		b.segments.length - a.segments.length;
	const posRank = (a, b) =>
		b.positive - a.positive ||
		b.positive / b.segments.length - a.positive / a.segments.length ||
		b.segments.length - a.segments.length;

	const trialRows = subthemeRows((t) => t.themes.includes('clinical_trials'));
	const tx = subthemeRows((t) => t.themes.includes('treatment'));

	const negTrial = trialRows
		.filter((r) => r.negative >= 2 && r.segments.length >= MIN_CLUSTER_N)
		.sort(negRank)
		.slice(0, TOP_K);
	const negTx = tx
		.filter((r) => r.negative >= 2 && r.segments.length >= MIN_CLUSTER_N)
		.sort(negRank)
		.slice(0, TOP_K);
	const posTx = tx
		.filter((r) => r.positive >= 3 && r.segments.length >= MIN_CLUSTER_N)
		.sort(posRank)
		.slice(0, TOP_K);
	// "Non-barriers" for MS: trial-themed subthemes (excluding the literal
	// trial_barriers / trial_negative_experiences subthemes, which would be
	// tautological) that did NOT skew negative when they came up.
	const TRIAL_NEGATIVE_SUBS = new Set(['trial_barriers', 'trial_negative_experiences']);
	const nonBarriers = trialRows
		.filter(
			(r) =>
				!TRIAL_NEGATIVE_SUBS.has(r.cluster.id) &&
				r.positive >= r.negative &&
				r.segments.length >= MIN_CLUSTER_N
		)
		.sort((a, b) => b.segments.length - a.segments.length)
		.slice(0, TOP_K);

	// Sample quotes: prefer strong-sentiment fragments in the requested tone,
	// take their raw text directly (no quote_bank for MS).
	function sampleQuotes(rows, tone, k = 6) {
		const seen = new Set();
		const pool = [];
		for (const r of rows) {
			for (const s of r.segments) {
				if (seen.has(s.segment_id)) continue;
				seen.add(s.segment_id);
				pool.push(s);
			}
		}
		const directed =
			tone === 'positive'
				? pool.filter((p) => p.sentiment > 0)
				: tone === 'negative'
					? pool.filter((p) => p.sentiment < 0)
					: pool;
		return (directed.length ? directed : pool)
			.sort((a, b) => Math.abs(b.sentiment) - Math.abs(a.sentiment))
			.slice(0, k)
			.map((s) => ({
				text: s.text,
				interview_id: s.interview_id,
				sentiment: s.sentiment
			}));
	}

	function describeFinding(id, eyebrow, tone, rows) {
		const dist = { positive: 0, neutral: 0, negative: 0 };
		const seen = new Set();
		for (const r of rows) {
			for (const s of r.segments) {
				if (seen.has(s.segment_id)) continue;
				seen.add(s.segment_id);
				if (s.sentiment > 0) dist.positive++;
				else if (s.sentiment < 0) dist.negative++;
				else dist.neutral++;
			}
		}
		return {
			id,
			eyebrow,
			tone,
			distribution: dist,
			clusters: rows.map((r) => ({
				label: r.cluster.label,
				count: r.segments.length,
				positive: r.positive,
				neutral: r.neutral,
				negative: r.negative
			})),
			sample_quotes: sampleQuotes(rows, tone, 6)
		};
	}

	const findings = [
		describeFinding('negative-trial', 'Drivers of negative trial sentiment', 'negative', negTrial),
		describeFinding('negative-treatment', 'Drivers of negative treatment sentiment', 'negative', negTx),
		describeFinding('positive-treatment', 'Drivers of positive treatment sentiment', 'positive', posTx),
		describeFinding('trial-non-barriers', 'Non-issues for trial participation', 'neutral', nonBarriers)
	].filter((f) => f.clusters.length > 0);

	const linkable_targets = {
		themes: (codebook.themes ?? []).map((t) => ({ id: t.id, label: t.label })),
		subthemes: (codebook.themes ?? []).flatMap((t) =>
			(t.subthemes ?? []).map((s) => ({ id: s.id, label: s.label, parent_theme: t.id }))
		),
		findings: findings.map((f) => ({ id: f.id, label: f.eyebrow })),
		// Reddit threads aren't interviews; drop interview-kind refs entirely.
		interviews: []
	};

	return {
		indication_label: 'multiple sclerosis',
		corpus_kind: 'real',
		// Steers the model away from "interviews" / "participants" wording
		// without touching the cached system prompt. Lands in the user message
		// via the JSON.stringify of payload.
		voice_guidance:
			'This corpus is Reddit MS community discussion (forum posts and comments), not interviews. Refer to it as community posts, comments, threads, or authors — not interviews, participants, or patients-who-sat-for-interviews. Authors are MS patients and caregivers writing on a public forum.',
		overview_stats: overviewStats,
		linkable_targets,
		findings
	};
}

// --- LN input (placeholder mocks) ------------------------------------------
// KEEP IN SYNC with LN_* blocks in src/routes/patientlyiq/+page.svelte.
// No real transcripts — Haiku gets counts + cluster names only and is told
// these numbers are illustrative.

function buildLupusNephritisInput() {
	// Mirror of LN_THEMES in +page.svelte — keep ids in sync. Subthemes are
	// id-derived (label.toLowerCase().replace(/[^a-z0-9]+/g, '_')) to match.
	const lnThemes = [
		{ id: 'disease_activity', label: 'Disease activity & flares', subs: ['Flares', 'Symptom load', 'Disease progression'] },
		{ id: 'treatment', label: 'Treatment & medication', subs: ['Steroids', 'Immunosuppressants', 'Adherence'] },
		{ id: 'side_effects', label: 'Side effects', subs: ['Fatigue', 'Infection risk', 'Weight changes'] },
		{ id: 'renal_function', label: 'Renal function', subs: ['Lab results', 'Protein in urine', 'Kidney decline'] },
		{ id: 'quality_of_life', label: 'Quality of life', subs: ['Energy', 'Work / school', 'Relationships'] },
		{ id: 'clinical_trials', label: 'Clinical trials', subs: ['Awareness', 'Hesitation', 'Logistics'] },
		{ id: 'monitoring', label: 'Disease monitoring', subs: ['Lab visits', 'Self-tracking', 'Appointment burden'] },
		{ id: 'mental_health', label: 'Mental health & stress', subs: ['Anxiety', 'Depression', 'Coping'] },
		{ id: 'social_life', label: 'Social & lifestyle impact', subs: ['Family', 'Diet', 'Activity'] },
		{ id: 'support', label: 'Healthcare support', subs: ['Provider trust', 'Communication', 'Access'] },
		{ id: 'future_outlook', label: 'Future outlook', subs: ['Hope', 'Treatment expectations', 'Long-term concerns'] }
	];
	const subIdOf = (themeId, label) =>
		`${themeId}__${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

	return {
		indication_label: 'lupus nephritis',
		corpus_kind: 'placeholder',
		overview_stats: {
			interviews: 24,
			segments: 187,
			themes: 11,
			posPct: 41,
			negPct: 38,
			neutralPct: 21,
			lean: 'mixed'
		},
		linkable_targets: {
			themes: lnThemes.map(({ id, label }) => ({ id, label })),
			subthemes: lnThemes.flatMap((t) =>
				t.subs.map((label) => ({ id: subIdOf(t.id, label), label, parent_theme: t.id }))
			),
			findings: [
				{ id: 'negative-treatment', label: 'Drivers of negative treatment sentiment' },
				{ id: 'negative-trial', label: 'Drivers of negative trial sentiment' },
				{ id: 'positive-treatment', label: 'Drivers of positive treatment sentiment' },
				{ id: 'trial-non-barriers', label: 'Non-issues for trial participation' }
			],
			interviews: Array.from({ length: 24 }, (_, i) => `LN${String(i + 1).padStart(2, '0')}`)
		},
		findings: [
			{
				id: 'negative-treatment',
				eyebrow: 'Drivers of negative treatment sentiment',
				tone: 'negative',
				distribution: { positive: 16, neutral: 17, negative: 28 },
				clusters: [
					{ label: 'Side effects (immunosuppressive)', count: 21, positive: 3, neutral: 6, negative: 12 },
					{ label: 'Steroid dependency', count: 18, positive: 2, neutral: 5, negative: 11 },
					{ label: 'Infection risk', count: 15, positive: 4, neutral: 4, negative: 7 },
					{ label: 'Fatigue & energy loss', count: 19, positive: 5, neutral: 6, negative: 8 }
				],
				sample_quotes: []
			},
			{
				id: 'negative-trial',
				eyebrow: 'Drivers of negative trial sentiment',
				tone: 'negative',
				distribution: { positive: 11, neutral: 12, negative: 19 },
				clusters: [
					{ label: 'Washout / flare risk', count: 14, positive: 2, neutral: 4, negative: 8 },
					{ label: 'Visit frequency & burden', count: 16, positive: 4, neutral: 5, negative: 7 },
					{ label: 'Travel distance', count: 12, positive: 3, neutral: 5, negative: 4 }
				],
				sample_quotes: []
			},
			{
				id: 'positive-treatment',
				eyebrow: 'Drivers of positive treatment sentiment',
				tone: 'positive',
				distribution: { positive: 32, neutral: 21, negative: 14 },
				clusters: [
					{ label: 'Remission & disease control', count: 22, positive: 14, neutral: 5, negative: 3 },
					{ label: 'Renal function preservation', count: 18, positive: 11, neutral: 5, negative: 2 },
					{ label: 'Reduced flare frequency', count: 16, positive: 9, neutral: 5, negative: 2 }
				],
				sample_quotes: []
			},
			{
				id: 'trial-non-barriers',
				eyebrow: 'Non-issues for trial participation',
				tone: 'neutral',
				distribution: { positive: 28, neutral: 10, negative: 14 },
				clusters: [
					{ label: 'Genetic / biomarker testing', count: 14, positive: 8, neutral: 3, negative: 3 },
					{ label: 'Imaging visits', count: 12, positive: 7, neutral: 4, negative: 1 },
					{ label: 'Questionnaire burden', count: 11, positive: 6, neutral: 4, negative: 1 },
					{ label: 'Blood / urine samples', count: 10, positive: 5, neutral: 4, negative: 1 }
				],
				sample_quotes: []
			}
		]
	};
}

// --- Prompt + call ---------------------------------------------------------
const SYSTEM_PROMPT = `You are a senior qualitative-research analyst writing the right-pane copy for a patient-insights dashboard. The reader is a clinical-trial designer or therapeutic-area strategist — sharp, time-pressed, allergic to consultant voice.

You produce three kinds of output:

1. OVERVIEW (one per indication): 80–120 words. First sentence states the corpus size and sentiment lean using the supplied numbers exactly. Then 2–3 sentences naming what the negative pull is about and what the positive pull is about, grounded in the specific topics. The overview ENDS on a strong observational sentence — a claim, not a framing. Do NOT pre-announce that a tension exists ("the core tension is…", "the central tension is…", "this reveals a tension between…"). If you have a sharp tension claim, just state it directly: "Patients embrace the treatment but fear losing access to it mid-trajectory." If a claim is sharp enough to feel like an "underline this" moment, it belongs in a finding's considerations, not in the overview.

2. PER-FINDING LEDE: one sentence, 14–24 words. Says what the finding actually means about patient experience. Active verbs. No template framing.

3. PER-FINDING ANALYSIS: 2–3 sentences, 45–80 words. Reads across the clusters: what they share, where they diverge, which one is doing the heavy lifting, what it implies for trial design or counselling. If sample_quotes are supplied, paraphrase a sharp phrase from one when it carries weight.

4. PER-FINDING CONSIDERATIONS (1–3 per finding): short standalone callouts — the sentences a reader would underline. Each has:
   - kind: one of "insight" (what the data reveals), "tension" (a paradox or trade-off), "implication" (concrete what-to-do for trial design, recruitment, or clinical counselling).
   - text: one sentence, 12–28 words. Must stand alone outside the analysis paragraph.
   Do not repeat sentences verbatim between analysis and considerations — extract the underline-worthy claim, distinct from the connective prose.

LANGUAGE BANS — these patterns are forbidden anywhere in the output:
- The "X is not Y — it's Z" pivot. ("The anxiety is not about using the drug — it's about access.") Replace with a direct statement.
- Tension-framing intros: "the core tension is", "the central tension is", "the tension worth watching", "the tension between X and Y", "this reveals/exposes a tension", "the load-bearing tension". State the tension directly without announcing it.
- "Load-bearing", "doing the heavy lifting", "anchors", "drives the lifting" as analyst metaphors. Pick a more specific verb.
- Flagging phrases: "what's striking is", "notably,", "the key insight here", "this suggests that", "it's worth noting", "interestingly", "this paradoxically", "indicating that".
- Em-dash-as-pivot in general. Em-dashes for parentheticals are fine; em-dashes to set up a rhetorical reveal are not.
- "Patients reported", "this finding shows", "the data suggests/indicates/reveal/reveals", "highlights the importance of".
- Em-dashes used to splice two sentence-like clauses. If two ideas don't fit one sentence, write two sentences.
- Triadic lists when two items would do ("convenient, potent, and sustainable").
- Adverbial intensifiers: "particularly", "notably", "especially", "fundamentally", "ultimately".

VOICE RULES:
- Specific over general. "Steroid dependency", not "side effects". "Washout flare risk", not "trial concerns".
- Cite at most one number in the lede; analysis and considerations can cite a couple more between them. Never invent numbers, ids, or quotes.
- One claim per sentence. If you find yourself wanting to add ", and X also Y", start a new sentence.
- Placeholder corpora: write in the same voice but stay a notch more abstract — describe what the pattern would mean, not what specific individuals said.

INLINE LINKS — selectively mark domain phrases as links to their related dashboard target:
- Syntax: write [surface text](ref:KIND:ID) inline in overview, lede, analysis, and consideration.text.
- KIND must be one of: "theme", "subtheme", "finding", "interview".
- ID must come from the linkable_targets block in the input. Bad ids will be stripped to plain text.
- Link domain noun phrases that name a cluster, theme, subtheme, finding, or interview the reader could drill into — e.g. [washout flare risk](ref:subtheme:washout), [trial visit burden](ref:finding:negative-trial). Don't link generic words or every cluster mention. Aim for 1–3 links per paragraph.
- Don't break syntax across lines, don't nest links, don't link the same surface text twice in the same paragraph.

Output JSON only. The 'findings' array must contain exactly one entry for each id in the input, in the input's order.`;

const client = new Anthropic();

function buildSchema(findingIds) {
	const considerationItem = {
		type: 'object',
		additionalProperties: false,
		properties: {
			kind: { type: 'string', enum: ['insight', 'tension', 'implication'] },
			text: { type: 'string' }
		},
		required: ['kind', 'text']
	};
	const findingItem = {
		type: 'object',
		additionalProperties: false,
		properties: {
			id: { type: 'string', enum: findingIds },
			lede: { type: 'string' },
			analysis: { type: 'string' },
			considerations: { type: 'array', items: considerationItem }
		},
		required: ['id', 'lede', 'analysis', 'considerations']
	};
	return {
		type: 'object',
		additionalProperties: false,
		properties: {
			overview: { type: 'string' },
			findings: { type: 'array', items: findingItem }
		},
		required: ['overview', 'findings']
	};
}

async function generateFor(indicationId, payload) {
	const findingIds = payload.findings.map((f) => f.id);
	const schema = buildSchema(findingIds);

	const stream = client.messages.stream({
		model: MODEL,
		max_tokens: 3000,
		output_config: { format: { type: 'json_schema', schema } },
		system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
		messages: [
			{
				role: 'user',
				content:
					`Indication: ${payload.indication_label}\n` +
					`Corpus kind: ${payload.corpus_kind}\n\n` +
					`Input:\n${JSON.stringify(payload, null, 2)}`
			}
		]
	});

	const msg = await stream.finalMessage();
	const u = msg.usage;
	console.log(
		`  usage: in=${u.input_tokens} cache_write=${u.cache_creation_input_tokens ?? 0} ` +
			`cache_read=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens}`
	);
	if (msg.stop_reason === 'max_tokens') {
		throw new Error(`${indicationId}: response hit max_tokens — output truncated.`);
	}
	if (msg.stop_reason === 'refusal') {
		throw new Error(`${indicationId}: model refused.`);
	}
	const textBlock = msg.content.find((b) => b.type === 'text');
	if (!textBlock) throw new Error(`${indicationId}: no text block in response.`);

	let parsed;
	try {
		parsed = JSON.parse(textBlock.text);
	} catch (e) {
		throw new Error(`${indicationId}: response was not valid JSON — ${e.message}`);
	}
	if (typeof parsed.overview !== 'string' || !parsed.overview.trim()) {
		throw new Error(`${indicationId}: missing or empty overview.`);
	}
	if (!Array.isArray(parsed.findings) || !parsed.findings.length) {
		throw new Error(`${indicationId}: missing findings array.`);
	}
	// Dedupe by first occurrence per id — Haiku occasionally emits extra
	// rows; the schema enum prevents bad ids, so any extra is a duplicate.
	const byId = new Map();
	for (const f of parsed.findings) {
		if (!findingIds.includes(f.id)) continue;
		if (byId.has(f.id)) continue;
		if (typeof f.lede !== 'string' || !f.lede.trim()) continue;
		if (typeof f.analysis !== 'string' || !f.analysis.trim()) continue;
		const considerations = Array.isArray(f.considerations)
			? f.considerations
				.filter(
					(c) =>
						c &&
						typeof c.text === 'string' &&
						c.text.trim() &&
						['insight', 'tension', 'implication'].includes(c.kind)
				)
				.map((c) => ({ kind: c.kind, text: c.text.trim() }))
			: [];
		byId.set(f.id, { id: f.id, lede: f.lede, analysis: f.analysis, considerations });
	}
	const missing = findingIds.filter((id) => !byId.has(id));
	if (missing.length) {
		throw new Error(`${indicationId}: missing blurb for finding ids: ${missing.join(', ')}.`);
	}
	if (parsed.findings.length !== findingIds.length) {
		console.log(
			`  note: model emitted ${parsed.findings.length} findings, deduped to ${byId.size}.`
		);
	}
	return {
		overview: parsed.overview,
		findings: findingIds.map((id) => byId.get(id))
	};
}

// --- Main ------------------------------------------------------------------
let existing = { schema_version: '1.0', indications: {} };
if (existsSync(resolve(ROOT, OUTPUT_FILE))) {
	existing = JSON.parse(readFileSync(resolve(ROOT, OUTPUT_FILE), 'utf8'));
}
const indications = { ...(existing.indications ?? {}) };

const targets = argIndications.length
	? argIndications
	: KNOWN_INDICATIONS.filter((id) => force || !indications[id]);

if (!targets.length) {
	console.log('Nothing to generate — every indication already has blurbs.');
	console.log('Pass an indication id, or add --force, to re-generate.');
	process.exit(0);
}

console.log(`Model: ${MODEL}`);
console.log(`Generating dashboard blurbs for: ${targets.join(', ')}\n`);

for (const id of targets) {
	console.log(`${id}...`);
	const input =
		id === 'obesity'
			? buildObesityInput()
			: id === 'multiple_sclerosis'
				? buildMultipleSclerosisInput()
				: buildLupusNephritisInput();
	console.log(`  input: ${input.findings.length} findings, overview_stats=${JSON.stringify(input.overview_stats)}`);
	for (const f of input.findings) {
		console.log(`    ${f.id}: ${f.clusters.length} clusters, dist=${JSON.stringify(f.distribution)}`);
	}
	const blurbs = await generateFor(id, input);
	indications[id] = {
		generated_at: new Date().toISOString(),
		model: MODEL,
		corpus_kind: input.corpus_kind,
		overview: blurbs.overview,
		findings: Object.fromEntries(
			blurbs.findings.map((f) => [
			f.id,
			{ lede: f.lede, analysis: f.analysis, considerations: f.considerations ?? [] }
		])
		)
	};
	console.log(`  ${id}: overview + ${blurbs.findings.length} findings OK.\n`);
}

const output = {
	schema_version: '1.0',
	generator: 'scripts/propose-dashboard-blurbs.mjs',
	model: MODEL,
	notes: [
		'Analyst-voice copy for the executive-summary dashboard.',
		'Layered over the runtime template strings in executive-summary.ts and the LN mocks in +page.svelte — UI prefers these when present, falls back when missing.',
		'Re-generate one indication with: node scripts/propose-dashboard-blurbs.mjs <indication> --force'
	],
	indications: Object.fromEntries(
		KNOWN_INDICATIONS.filter((id) => indications[id]).map((id) => [id, indications[id]])
	)
};

writeFileSync(resolve(ROOT, OUTPUT_FILE), JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`Wrote ${OUTPUT_FILE}`);
console.log(`  indications covered: ${Object.keys(output.indications).join(', ')}`);
