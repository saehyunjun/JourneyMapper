/**
 * propose-exec-summary.mjs
 *
 * Analyst-voice copy for the new bento-shape patientlyiq executive summary
 * (graduated from bento-spike on 2026-05-29). Generates per-indication:
 *   - overview (80–120 words, sits below the page title)
 *   - sentiment_lean.{headline, caption} — replaces the generic
 *     "CAR T-cell therapy vs Other." with an analyst-voice take
 *   - anchor_subtheme.{headline, caption} — replaces "The anchors of the
 *     corpus." with something specific to the chosen sub-theme
 *   - bridge_narrative.{eyebrow, headline, caption, body, points, tone} —
 *     throughline card opposite the hero
 *   - lead_finding.{eyebrow, headline, lede, analysis} — copy overlay for
 *     the full-width lead-chart waffle cell
 *   - second_finding.{eyebrow, headline, lede, analysis} — copy overlay for
 *     the 1/3 finding-b stat cell
 *
 * Sister to propose-dashboard-blurbs.mjs. For obesity, dashboard_blurbs.json
 * still owns per-finding ledes (this script doesn't write finding copy for
 * obesity, only for fragment-corpus indications whose findings are derived
 * at runtime in exec-summary-data.ts).
 *
 * Inputs:
 *   - src/lib/content/exec-summary-config.json  (anchor + sentiment_axes per indication)
 *   - Obesity: wctglpdemo segments + segment_tags + quote_bank
 *   - LN / MS: corpora/<id>/{fragments,annotations}/*.json
 *   - keyword_lexicon.json (for axis-keyword regex match)
 *   - codebook.json (for sub-theme labels)
 *
 * Output: src/lib/content/exec-summary-blurbs.json
 *
 * Run:
 *   node scripts/propose-exec-summary.mjs                # missing only
 *   node scripts/propose-exec-summary.mjs lupus_nephritis multiple_sclerosis
 *   node scripts/propose-exec-summary.mjs --force        # all, regenerate
 *
 * Requires ANTHROPIC_API_KEY in JourneyMapper/.env (or env). If you get 401,
 * run with `env -u ANTHROPIC_API_KEY` — the shell-exported key shadows .env.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CONFIG_FILE = 'src/lib/content/exec-summary-config.json';
const OUTPUT_FILE = 'src/lib/content/exec-summary-blurbs.json';
const LEXICON_FILE = 'src/lib/content/wctglpdemo-data/keyword_lexicon.json';
const CODEBOOK_FILE = 'src/lib/content/wctglpdemo-data/codebook.json';
const DRUGS_FILE = 'src/lib/content/registries/drugs.json';
const CORPORA_DIR = 'src/lib/content/corpora';

const WCT_SEGMENTS = 'src/lib/content/wctglpdemo-data/segments.json';
const WCT_TAGS = 'src/lib/content/wctglpdemo-data/segment_tags.json';
const WCT_QUOTES = 'src/lib/content/wctglpdemo-data/quote_bank.json';

const MODEL = 'claude-haiku-4-5';

if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));
if (!process.env.ANTHROPIC_API_KEY) {
	console.error('x ANTHROPIC_API_KEY is not set. Add it to JourneyMapper/.env or export it.');
	process.exit(1);
}

// --- Args ------------------------------------------------------------------
const args = process.argv.slice(2);
const force = args.includes('--force');
const argIndications = args.filter((a) => !a.startsWith('-'));

// --- Load shared fixtures --------------------------------------------------
const cfg = JSON.parse(readFileSync(resolve(ROOT, CONFIG_FILE), 'utf8'));
const lexicon = JSON.parse(readFileSync(resolve(ROOT, LEXICON_FILE), 'utf8'));
const codebook = JSON.parse(readFileSync(resolve(ROOT, CODEBOOK_FILE), 'utf8'));
const drugs = JSON.parse(readFileSync(resolve(ROOT, DRUGS_FILE), 'utf8'));

const KNOWN_INDICATIONS = Object.keys(cfg.indications ?? {});
for (const id of argIndications) {
	if (!KNOWN_INDICATIONS.includes(id)) {
		console.error(`x Unknown indication "${id}". Known: ${KNOWN_INDICATIONS.join(', ')}`);
		process.exit(1);
	}
}

const subthemeLabel = new Map();
const subthemeParent = new Map();
for (const t of codebook.themes ?? []) {
	for (const s of t.subthemes ?? []) {
		subthemeLabel.set(s.id, s.label ?? s.id);
		subthemeParent.set(s.id, t.id);
	}
}

// --- Keyword matcher (port of keywords.ts buildKeywordMatcher) -------------
const drugById = new Map((drugs.items ?? []).map((d) => [d.id, d]));
const normalize = (s) => s.replace(/[‘’]/g, "'");
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function clusterRegex(cluster) {
	const seen = new Set();
	const sources = [];
	const push = (raw) => {
		if (!raw) return;
		const n = normalize(raw);
		const key = n.toLowerCase().trim();
		if (!key || seen.has(key)) return;
		seen.add(key);
		sources.push(n);
	};
	for (const v of cluster.variants ?? []) push(v);
	if (cluster.drug_id) {
		const drug = drugById.get(cluster.drug_id);
		if (drug) {
			push(drug.generic_name);
			for (const b of drug.brand_names ?? []) push(b);
		}
	}
	const alts = sources
		.sort((a, b) => b.length - a.length)
		.map((v) => escapeRegex(v).replace(/[\s-]+/g, '[\\s-]+'));
	if (!alts.length) return null;
	return new RegExp(`(?<![A-Za-z0-9])(?:${alts.join('|')})(?![A-Za-z0-9])`, 'gi');
}

const clusterRegexById = new Map();
for (const c of lexicon.clusters ?? []) {
	const re = clusterRegex(c);
	if (re) clusterRegexById.set(c.id, re);
}

function textMatchesCluster(text, clusterId) {
	const re = clusterRegexById.get(clusterId);
	if (!re) return false;
	re.lastIndex = 0;
	return re.test(normalize(text));
}

// --- Corpus loader ---------------------------------------------------------

function listCorporaForIndication(indicationId) {
	const dir = resolve(ROOT, CORPORA_DIR);
	if (!existsSync(dir)) return [];
	const out = [];
	for (const name of readdirSync(dir)) {
		const d = resolve(dir, name);
		if (!statSync(d).isDirectory()) continue;
		const manifestPath = resolve(d, 'manifest.json');
		if (!existsSync(manifestPath)) continue;
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
		if (!(manifest.indications ?? []).includes(indicationId)) continue;
		const fragments = [];
		const fragmentsDir = resolve(d, 'fragments');
		if (existsSync(fragmentsDir)) {
			for (const f of readdirSync(fragmentsDir)) {
				if (!f.endsWith('.json')) continue;
				const doc = JSON.parse(readFileSync(resolve(fragmentsDir, f), 'utf8'));
				if (Array.isArray(doc.fragments)) fragments.push(...doc.fragments);
			}
		}
		const annotations = {};
		const annotationsDir = resolve(d, 'annotations');
		if (existsSync(annotationsDir)) {
			for (const f of readdirSync(annotationsDir)) {
				if (!f.endsWith('.json')) continue;
				const doc = JSON.parse(readFileSync(resolve(annotationsDir, f), 'utf8'));
				if (doc.annotations) Object.assign(annotations, doc.annotations);
			}
		}
		out.push({ id: manifest.id, fragments, annotations });
	}
	return out;
}

// --- Datapoint extraction (mirrors exec-summary-data.ts) -------------------

function speakerIdOf(f) {
	const r = f.source_ref;
	if (r.kind === 'interview') return r.interview_id;
	if (r.kind === 'youtube_transcript' || r.kind === 'podcast_transcript') return r.media_id;
	if (r.kind === 'search_query') return r.source_dataset;
	return r.author_handle_hash ?? '(unknown)';
}

function leanFromCounts(pos, neg) {
	if (pos > neg * 1.2) return 'positive';
	if (neg > pos * 1.2) return 'negative';
	return 'mixed';
}

function breakdownFromPoints(label, points) {
	const pos = points.filter((p) => p.sentiment > 0).length;
	const neg = points.filter((p) => p.sentiment < 0).length;
	const neu = points.length - pos - neg;
	const total = points.length;
	const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
	return {
		label,
		total,
		positive: pos,
		negative: neg,
		neutral: neu,
		posPct: pct(pos),
		negPct: pct(neg),
		neuPct: pct(neu),
		lean: leanFromCounts(pos, neg)
	};
}

function evaluateAxes(axesSpec, points, annotationFor) {
	if (!axesSpec.length) return [];
	const matched = new Set();
	const out = [];
	for (const spec of axesSpec) {
		if (spec.kind === 'complement') {
			const residual = points.filter((p) => !matched.has(p.id));
			out.push(breakdownFromPoints(spec.label, residual));
			continue;
		}
		const filtered = points.filter((p) => {
			if (spec.kind === 'keyword') return textMatchesCluster(p.text, spec.id);
			const ann = annotationFor(p.id);
			if (!ann) return false;
			if (spec.kind === 'theme') return (ann.themes ?? []).includes(spec.id);
			return (ann.subthemes ?? []).includes(spec.id);
		});
		for (const p of filtered) matched.add(p.id);
		out.push(breakdownFromPoints(spec.label, filtered));
	}
	return out;
}

function lengthScore(text) {
	const n = text.length;
	if (n < 25) return n / 25;
	if (n > 280) return Math.max(0, 1 - (n - 280) / 400);
	return 1;
}

function pickAnchorQuotes(candidates, k) {
	return [...candidates]
		.sort(
			(a, b) =>
				Math.abs(b.sentiment) * 0.6 + lengthScore(b.text) * 0.4 -
				(Math.abs(a.sentiment) * 0.6 + lengthScore(a.text) * 0.4)
		)
		.slice(0, k);
}

// --- Corpus findings (mirrors exec-summary-data.ts buildCorpusFindings) ----
// Kept in lockstep with the runtime builder so the LLM sees the same cluster
// rows the page will render.

const SELF_DRIVER_TAUTOLOGIES = {
	clinical_trials: ['clinical trial', 'clinical trials'],
	treatment: ['treatment'],
	condition_specific: ['condition specific', 'condition-specific']
};
const STANCE_ONLY_DRIVER_IDS = new Set(['concern', 'harm', 'better', 'guinea_pig', 'lawsuits']);
const FINDING_MIN_CLUSTER_N = 2;
const FINDING_TOP_K = 5;

function buildClusterRows(points) {
	const rows = [];
	for (const c of lexicon.clusters ?? []) {
		const seen = new Set();
		const row = {
			clusterId: c.id,
			clusterLabel: c.label,
			positive: 0,
			negative: 0,
			neutral: 0,
			fragments: []
		};
		for (const p of points) {
			if (seen.has(p.id)) continue;
			if (!textMatchesCluster(p.text, c.id)) continue;
			seen.add(p.id);
			row.fragments.push({ id: p.id, text: p.text, sentiment: p.sentiment });
			if (p.sentiment > 0) row.positive += 1;
			else if (p.sentiment < 0) row.negative += 1;
			else row.neutral += 1;
		}
		if (row.fragments.length) rows.push(row);
	}
	return rows;
}

function dropSelfDriverRows(rows, scopeTheme) {
	const anchors = new Set(SELF_DRIVER_TAUTOLOGIES[scopeTheme] ?? []);
	return rows.filter((r) => {
		if (STANCE_ONLY_DRIVER_IDS.has(r.clusterId)) return false;
		if (anchors.size && anchors.has(r.clusterLabel.toLowerCase().trim())) return false;
		return true;
	});
}

function aggregateRows(rows) {
	const seen = new Set();
	let positive = 0;
	let neutral = 0;
	let negative = 0;
	for (const r of rows) {
		for (const f of r.fragments) {
			if (seen.has(f.id)) continue;
			seen.add(f.id);
			if (f.sentiment > 0) positive += 1;
			else if (f.sentiment < 0) negative += 1;
			else neutral += 1;
		}
	}
	return { positive, neutral, negative, total: positive + neutral + negative };
}

const FINDING_SPECS_PROPOSER = [
	{
		id: 'negative-treatment',
		scopeTheme: 'treatment',
		tone: 'negative',
		prefer: 'negative',
		defaultEyebrow: 'Drivers of negative treatment sentiment'
	},
	{
		id: 'negative-trial',
		scopeTheme: 'clinical_trials',
		tone: 'negative',
		prefer: 'negative',
		defaultEyebrow: 'Drivers of negative trial sentiment'
	},
	{
		id: 'positive-treatment',
		scopeTheme: 'treatment',
		tone: 'positive',
		prefer: 'positive',
		defaultEyebrow: 'Drivers of positive treatment sentiment'
	}
];

function buildOneFinding(spec, points, annotationFor) {
	const scoped = points.filter((p) => {
		const themes = annotationFor(p.id)?.themes ?? [];
		return themes.includes(spec.scopeTheme);
	});
	if (!scoped.length) return null;

	const rows = dropSelfDriverRows(buildClusterRows(scoped), spec.scopeTheme)
		.filter((r) =>
			spec.prefer === 'negative'
				? r.negative >= 2 && r.fragments.length >= FINDING_MIN_CLUSTER_N
				: r.positive >= 2 && r.fragments.length >= FINDING_MIN_CLUSTER_N
		)
		.sort((a, b) => {
			if (spec.prefer === 'negative') {
				return b.negative - a.negative || b.fragments.length - a.fragments.length;
			}
			return b.positive - a.positive || b.fragments.length - a.fragments.length;
		})
		.slice(0, FINDING_TOP_K);
	if (!rows.length) return null;

	const dist = aggregateRows(rows);
	// Pull two sample fragments per cluster (one matching the prefer tone, one
	// other) — enough to give the LLM voice without flooding the prompt.
	const exemplars = rows.map((r) => {
		const matching = r.fragments
			.filter((f) =>
				spec.prefer === 'positive' ? f.sentiment > 0 : f.sentiment < 0
			)
			.sort((a, b) => Math.abs(b.sentiment) - Math.abs(a.sentiment))[0];
		const other = r.fragments
			.filter((f) => f !== matching)
			.sort((a, b) => b.text.length - a.text.length)[0];
		return {
			cluster_label: r.clusterLabel,
			count: r.fragments.length,
			positive: r.positive,
			negative: r.negative,
			neutral: r.neutral,
			examples: [matching?.text, other?.text].filter(Boolean).slice(0, 2)
		};
	});

	return {
		id: spec.id,
		scope_theme: spec.scopeTheme,
		tone: spec.tone,
		default_eyebrow: spec.defaultEyebrow,
		distribution: dist,
		clusters: exemplars
	};
}

function buildCorpusFindings(points, annotationFor) {
	const all = FINDING_SPECS_PROPOSER.map((s) => buildOneFinding(s, points, annotationFor)).filter(
		Boolean
	);
	if (!all.length) return { lead: null, second: null };
	const ranked = [...all].sort((a, b) => {
		const aSig = a.tone === 'positive' ? a.distribution.positive : a.distribution.negative;
		const bSig = b.tone === 'positive' ? b.distribution.positive : b.distribution.negative;
		return bSig - aSig;
	});
	const lead = ranked[0];
	const second = ranked.find((f) => f.id !== lead.id) ?? null;
	return { lead, second };
}

// --- Per-indication input builders -----------------------------------------

function buildObesityInput(indicationCfg) {
	const segments = JSON.parse(readFileSync(resolve(ROOT, WCT_SEGMENTS), 'utf8')).segments;
	const tags = JSON.parse(readFileSync(resolve(ROOT, WCT_TAGS), 'utf8')).annotations;
	const quoteBank = JSON.parse(readFileSync(resolve(ROOT, WCT_QUOTES), 'utf8')).quotes;

	const annBySeg = new Map(tags.map((a) => [a.segment_id, a]));
	const segById = new Map(segments.map((s) => [s.segment_id, s]));

	const themed = tags.filter((a) => (a.themes ?? []).length > 0);
	const points = themed
		.map((a) => {
			const s = segById.get(a.segment_id);
			if (!s) return null;
			return { id: a.segment_id, sentiment: a.sentiment, text: s.text };
		})
		.filter(Boolean);

	const overall = breakdownFromPoints('Overall', points);
	const axes = evaluateAxes(indicationCfg.sentiment_axes ?? [], points, (id) => {
		const a = annBySeg.get(id);
		return a ? { themes: a.themes, subthemes: a.subthemes ?? [] } : null;
	});

	// Anchor: subtheme-scoped, prefer quote_bank intersection, else fall back.
	const anchorId = indicationCfg.anchor_subtheme?.id;
	const anchorLabel = indicationCfg.anchor_subtheme?.label ?? anchorId;
	let anchorQuotes = [];
	if (anchorId) {
		const matchingSegs = new Set(
			tags.filter((a) => (a.subthemes ?? []).includes(anchorId)).map((a) => a.segment_id)
		);
		const bankHits = quoteBank
			.filter((q) => (q.segment_ids ?? []).some((sid) => matchingSegs.has(sid)))
			.sort((a, b) => (b.quote_score?.overall ?? 0) - (a.quote_score?.overall ?? 0))
			.slice(0, 3)
			.map((q) => ({ text: q.text, sentiment: q.sentiment, speaker: q.interview_id }));
		if (bankHits.length >= 3) {
			anchorQuotes = bankHits;
		} else {
			const fallback = [...matchingSegs]
				.map((sid) => {
					const a = annBySeg.get(sid);
					const s = segById.get(sid);
					if (!a || !s) return null;
					return { text: s.text, sentiment: a.sentiment, speaker: a.interview_id };
				})
				.filter(Boolean);
			anchorQuotes = pickAnchorQuotes(fallback, 3);
		}
	}

	const annotationFor = (id) => {
		const a = annBySeg.get(id);
		return a ? { themes: a.themes, subthemes: a.subthemes ?? [] } : null;
	};
	const { lead, second } = buildCorpusFindings(points, annotationFor);

	return {
		indication_label: 'GLP-1 obesity treatment',
		corpus_kind: 'real_interviews',
		overall_lean: overall,
		sentiment_axes: axes,
		anchor_subtheme: { id: anchorId, label: anchorLabel },
		anchor_quotes: anchorQuotes,
		lead_finding: lead,
		second_finding: second
	};
}

function buildCorpusInput(indicationId, indicationCfg) {
	const bundles = listCorporaForIndication(indicationId);
	const fragments = bundles.flatMap((b) => b.fragments);
	const annotations = Object.assign({}, ...bundles.map((b) => b.annotations));

	const points = [];
	const matchingFragmentByPointId = new Map();
	for (const f of fragments) {
		const ann = annotations[f.id]?.segment_tags;
		if (!ann) continue;
		if (!(ann.themes ?? []).length) continue;
		if (typeof ann.sentiment_score !== 'number') continue;
		points.push({ id: f.id, sentiment: ann.sentiment_score, text: f.text });
		matchingFragmentByPointId.set(f.id, f);
	}

	const overall = breakdownFromPoints('Overall', points);
	const axes = evaluateAxes(indicationCfg.sentiment_axes ?? [], points, (id) => {
		const ann = annotations[id]?.segment_tags;
		return ann ? { themes: ann.themes ?? [], subthemes: ann.subthemes ?? [] } : null;
	});

	const anchorId = indicationCfg.anchor_subtheme?.id;
	const anchorLabel = indicationCfg.anchor_subtheme?.label ?? anchorId;
	let anchorQuotes = [];
	if (anchorId) {
		const candidates = points
			.filter((p) => (annotations[p.id]?.segment_tags?.subthemes ?? []).includes(anchorId))
			.map((p) => {
				const frag = matchingFragmentByPointId.get(p.id);
				return {
					text: p.text,
					sentiment: p.sentiment,
					speaker: frag ? speakerIdOf(frag) : '(unknown)'
				};
			});
		anchorQuotes = pickAnchorQuotes(candidates, 3);
	}

	const indicationLabels = {
		lupus_nephritis: 'lupus nephritis (LN reddit community)',
		multiple_sclerosis: 'multiple sclerosis (MS reddit community)'
	};

	const annotationFor = (id) => {
		const ann = annotations[id]?.segment_tags;
		return ann ? { themes: ann.themes ?? [], subthemes: ann.subthemes ?? [] } : null;
	};
	const { lead, second } = buildCorpusFindings(points, annotationFor);

	return {
		indication_label: indicationLabels[indicationId] ?? indicationId,
		corpus_kind: 'real_reddit',
		voice_guidance:
			'This corpus is Reddit community discussion (forum posts and comments), not interviews. Refer to it as community posts, comments, threads, or authors — not interviews, participants, or patients-who-sat-for-interviews.',
		overall_lean: overall,
		sentiment_axes: axes,
		anchor_subtheme: { id: anchorId, label: anchorLabel },
		anchor_quotes: anchorQuotes,
		lead_finding: lead,
		second_finding: second
	};
}

// --- Prompt ----------------------------------------------------------------
const SYSTEM_PROMPT = `You are a senior qualitative-research analyst writing the right-pane copy for a patient-insights dashboard. The reader is a clinical-trial designer or therapeutic-area strategist — sharp, time-pressed, allergic to consultant voice.

You produce six outputs per indication:

1. OVERVIEW: 80–120 words. First sentence states the corpus size and overall sentiment lean using the supplied numbers exactly. Then 2–3 sentences naming what the sentiment lean is about — what drives positive, what drives negative — grounded in the actual sub-themes / axes provided. End on a strong observational claim, not a framing announcement.

2. SENTIMENT_LEAN: a one-line headline (4–10 words, ends with a period) and a one-sentence caption (16–28 words). When sentiment_axes are non-empty, the headline characterises the comparison ACROSS axes — e.g. "CAR T runs hotter than the rest." not "CAR T-cell therapy vs Other." When sentiment_axes is empty, the headline reads the overall lean. The caption gives the analyst's read in one sentence.

3. ANCHOR_SUBTHEME: a one-line headline (4–10 words, ends with a period) and a one-sentence caption (16–28 words). The headline names what the anchor sub-theme is ABOUT — e.g. "Where the cost calculus tips." not "The anchors of the corpus." The caption tells the reader why these three quotes are the load-bearing voice of the sub-theme.

4. BRIDGE_NARRATIVE: the page's throughline card — a short editorial frame that names the through-line of the corpus.
   - eyebrow: 1–3 words (e.g. "The throughline").
   - headline: a single complete sentence (8–14 words) that names the core observation across the corpus — sharp, falsifiable, no consultant abstraction. Ends with a period.
   - caption: one sentence (16–24 words) that pivots the headline into a "so what."
   - body: 2 sentences (40–70 words total). First sentence elaborates what the corpus shows; second sentence sharpens it into a clinical or strategic claim.
   - points: 2–3 short label/value pairs that anchor the throughline to a specific cluster or count from the supplied data. Each value should be either a count (e.g. "15") or a short noun phrase (e.g. "Cyclo tox"). Labels are 1–2 words. Never invent counts.
   - tone: "positive" | "negative" | "neutral" — pick from the dominant lean.

5. LEAD_FINDING: copy overlay for the full-width waffle cell. Drives the visual lead.
   - eyebrow: short kicker that names what the finding is ABOUT (e.g. "What drove negative treatment sentiment"). Replaces the default_eyebrow.
   - headline: one sentence (8–16 words) that names the top 1–2 clusters by their actual cluster_label, then says what they drove. Ends with a period.
   - lede: a single sentence (18–28 words) — the analyst's read of the finding.
   - analysis: 2 sentences (50–80 words). First names the underlying pattern; second sharpens it into a specific clinical or trial-design implication.

6. SECOND_FINDING: copy overlay for the 1/3 stat cell. Same fields as lead_finding but tighter.
   - eyebrow: short kicker.
   - headline: one sentence (8–14 words).
   - lede: one sentence (16–24 words).
   - analysis: 1–2 sentences (30–60 words).

If a finding input is null (no qualifying clusters), still return a finding object — populate eyebrow/headline/lede/analysis with one short sentence each acknowledging the indication's finding profile, but DO NOT INVENT cluster names or counts.

LANGUAGE BANS — these patterns are forbidden anywhere in the output:
- The "X is not Y — it's Z" pivot.
- Tension-framing intros ("the core tension is", "this reveals a tension between", "the load-bearing tension").
- "Load-bearing", "doing the heavy lifting", "anchors" (as analyst metaphor — the literal word "anchor" naming the sub-theme is fine), "drives the lifting".
- Flagging phrases: "what's striking is", "notably,", "the key insight here", "this suggests that", "it's worth noting", "interestingly", "this paradoxically", "indicating that".
- Em-dash-as-pivot.
- "Patients reported", "this finding shows", "the data suggests/indicates/reveal/reveals", "highlights the importance of".
- Triadic lists when two items would do.
- Adverbial intensifiers: "particularly", "notably", "especially", "fundamentally", "ultimately".
- A cluster cannot be named as a driver of the theme it IS. If the finding's scope_theme is "treatment", do not say "treatment drove the negative reactions to treatment." Use the actual cluster_labels instead.

VOICE RULES:
- Specific over general. Name the axis or sub-theme by what it IS, not by its label string verbatim.
- Cite at most one number per output (excluding the overview). Never invent numbers, ids, or quotes.
- One claim per sentence.
- Match the corpus_kind voice — interviews vs reddit community discussion. The voice_guidance field overrides defaults when present.

Output JSON only.`;

const client = new Anthropic();

const FINDING_COPY_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: {
		eyebrow: { type: 'string' },
		headline: { type: 'string' },
		lede: { type: 'string' },
		analysis: { type: 'string' }
	},
	required: ['eyebrow', 'headline', 'lede', 'analysis']
};

const SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: {
		overview: { type: 'string' },
		sentiment_lean: {
			type: 'object',
			additionalProperties: false,
			properties: { headline: { type: 'string' }, caption: { type: 'string' } },
			required: ['headline', 'caption']
		},
		anchor_subtheme: {
			type: 'object',
			additionalProperties: false,
			properties: { headline: { type: 'string' }, caption: { type: 'string' } },
			required: ['headline', 'caption']
		},
		bridge_narrative: {
			type: 'object',
			additionalProperties: false,
			properties: {
				eyebrow: { type: 'string' },
				headline: { type: 'string' },
				caption: { type: 'string' },
				body: { type: 'string' },
				points: {
					type: 'array',
					items: {
						type: 'object',
						additionalProperties: false,
						properties: {
							value: { type: 'string' },
							label: { type: 'string' }
						},
						required: ['value', 'label']
					}
				},
				tone: { type: 'string', enum: ['positive', 'negative', 'neutral'] }
			},
			required: ['eyebrow', 'headline', 'caption', 'body', 'points', 'tone']
		},
		lead_finding: FINDING_COPY_SCHEMA,
		second_finding: FINDING_COPY_SCHEMA
	},
	required: [
		'overview',
		'sentiment_lean',
		'anchor_subtheme',
		'bridge_narrative',
		'lead_finding',
		'second_finding'
	]
};

async function generateFor(indicationId, payload) {
	const stream = client.messages.stream({
		model: MODEL,
		max_tokens: 1500,
		output_config: { format: { type: 'json_schema', schema: SCHEMA } },
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
		`  usage: in=${u.input_tokens} cache_write=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens}`
	);
	if (msg.stop_reason === 'max_tokens') {
		throw new Error(`${indicationId}: response hit max_tokens.`);
	}
	if (msg.stop_reason === 'refusal') {
		throw new Error(`${indicationId}: model refused.`);
	}
	const block = msg.content.find((b) => b.type === 'text');
	if (!block) throw new Error(`${indicationId}: no text block in response.`);
	const parsed = JSON.parse(block.text);
	if (!parsed.overview?.trim()) throw new Error(`${indicationId}: empty overview.`);
	if (!parsed.sentiment_lean?.headline?.trim() || !parsed.sentiment_lean?.caption?.trim()) {
		throw new Error(`${indicationId}: missing sentiment_lean fields.`);
	}
	if (!parsed.anchor_subtheme?.headline?.trim() || !parsed.anchor_subtheme?.caption?.trim()) {
		throw new Error(`${indicationId}: missing anchor_subtheme fields.`);
	}
	if (
		!parsed.bridge_narrative?.headline?.trim() ||
		!parsed.bridge_narrative?.body?.trim() ||
		!Array.isArray(parsed.bridge_narrative?.points)
	) {
		throw new Error(`${indicationId}: missing bridge_narrative fields.`);
	}
	for (const k of ['lead_finding', 'second_finding']) {
		const f = parsed[k];
		if (!f?.eyebrow?.trim() || !f?.headline?.trim() || !f?.lede?.trim() || !f?.analysis?.trim()) {
			throw new Error(`${indicationId}: missing ${k} fields.`);
		}
	}
	return parsed;
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
console.log(`Generating exec-summary blurbs for: ${targets.join(', ')}\n`);

for (const id of targets) {
	console.log(`${id}...`);
	const indicationCfg = cfg.indications[id];
	if (!indicationCfg) {
		console.warn(`  skipped: no entry in exec-summary-config.json for "${id}".`);
		continue;
	}
	const input = id === 'obesity' ? buildObesityInput(indicationCfg) : buildCorpusInput(id, indicationCfg);
	console.log(
		`  input: overall=${JSON.stringify(input.overall_lean.lean)} (n=${input.overall_lean.total}), ` +
			`axes=${input.sentiment_axes.length}, anchor_quotes=${input.anchor_quotes.length}, ` +
			`lead_finding=${input.lead_finding ? input.lead_finding.id + '/' + input.lead_finding.clusters.length + 'c' : 'none'}, ` +
			`second_finding=${input.second_finding ? input.second_finding.id + '/' + input.second_finding.clusters.length + 'c' : 'none'}`
	);
	const blurbs = await generateFor(id, input);
	indications[id] = {
		generated_at: new Date().toISOString(),
		model: MODEL,
		corpus_kind: input.corpus_kind,
		anchor_subtheme_id: input.anchor_subtheme.id,
		overview: blurbs.overview,
		sentiment_lean: blurbs.sentiment_lean,
		anchor_subtheme: blurbs.anchor_subtheme,
		bridge_narrative: blurbs.bridge_narrative,
		lead_finding: blurbs.lead_finding,
		second_finding: blurbs.second_finding
	};
	console.log(`  ${id}: OK.\n`);
}

const output = {
	schema_version: '1.0',
	generator: 'scripts/propose-exec-summary.mjs',
	model: MODEL,
	notes: [
		'Analyst-voice copy for the bento-shape patientlyiq executive summary.',
		'Sister to dashboard_blurbs.json (which still owns per-finding copy for obesity).',
		'Re-generate one indication with: node scripts/propose-exec-summary.mjs <indication> --force'
	],
	indications: Object.fromEntries(
		KNOWN_INDICATIONS.filter((id) => indications[id]).map((id) => [id, indications[id]])
	)
};

writeFileSync(resolve(ROOT, OUTPUT_FILE), JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`Wrote ${OUTPUT_FILE}`);
console.log(`  indications covered: ${Object.keys(output.indications).join(', ')}`);
