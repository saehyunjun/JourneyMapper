/**
 * propose-persona-pillars.mjs
 *
 * Tag fragments with persona-pillar signals — which of the four pillars
 * (medical_self_efficacy / provider_trust / logistical_capacity /
 * emotional_valence) the fragment speaks to, and a directional signal
 * (high / low / mixed) for each. Sibling to propose-theme-tags.mjs but
 * with a fixed 4-pillar vocabulary instead of the 27-theme codebook.
 *
 * Why Groq + Llama 3.3 70B by default: persona-pillar discernment is a
 * structured-classification task that doesn't need Opus-tier reasoning.
 * Groq's Llama 3.3 70B costs roughly $0.60/$0.80 per M tokens (in/out),
 * which puts a full multi-corpus run in the dimes-to-quarters range vs.
 * dollars on Anthropic. Override with --model to test other providers.
 *
 * Currently supports OpenAI-compatible providers (Groq, OpenRouter,
 * Together, Fireworks) via direct fetch — no new SDK dependency. Pick
 * your provider with --base-url (default Groq). API key from $GROQ_API_KEY
 * (or override with --key-env <NAME>).
 *
 * Output: `<corpus>/persona_pillars/<source>.json` — sibling to
 * theme_tags/, so the two systems coexist during analyst review.
 *
 * Run:
 *   node scripts/propose-persona-pillars.mjs <corpus_id>
 *   node scripts/propose-persona-pillars.mjs <corpus_id> --source social_post
 *   node scripts/propose-persona-pillars.mjs <corpus_id> --sample 40
 *   node scripts/propose-persona-pillars.mjs <corpus_id> --model llama-3.1-8b-instant
 *   node scripts/propose-persona-pillars.mjs <corpus_id> \
 *       --base-url https://openrouter.ai/api/v1 --key-env OPENROUTER_API_KEY \
 *       --model meta-llama/llama-3.3-70b-instruct
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_KEY_ENV = 'GROQ_API_KEY';
const SCRIPT_VERSION = 'propose-persona-pillars@0.1';

if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));

// === CLI ====================================================================

const args = process.argv.slice(2);
const flagNames = new Set(['--source', '--sample', '--model', '--base-url', '--key-env']);
const corpusId = (() => {
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a.startsWith('--')) {
			if (flagNames.has(a)) i++;
			continue;
		}
		return a;
	}
	return null;
})();
if (!corpusId) {
	console.error('x Usage: node scripts/propose-persona-pillars.mjs <corpus_id> [--source <name>] [--sample N] [--force] [--model <id>] [--base-url <url>] [--key-env <NAME>]');
	console.error(`  Defaults: model=${DEFAULT_MODEL}, base-url=${DEFAULT_BASE_URL}, key-env=${DEFAULT_KEY_ENV}`);
	console.error('  Other providers: --base-url https://openrouter.ai/api/v1 --key-env OPENROUTER_API_KEY');
	process.exit(1);
}
const force = args.includes('--force');
const sourceFilter = (() => {
	const idx = args.indexOf('--source');
	return idx >= 0 ? args[idx + 1] : null;
})();
const sampleSize = (() => {
	const idx = args.indexOf('--sample');
	if (idx < 0) return null;
	const n = parseInt(args[idx + 1] ?? '', 10);
	if (!Number.isFinite(n) || n <= 0) {
		console.error('x --sample must be a positive integer');
		process.exit(1);
	}
	return n;
})();
const MODEL = (() => {
	const idx = args.indexOf('--model');
	return idx >= 0 ? args[idx + 1] : DEFAULT_MODEL;
})();
const BASE_URL = (() => {
	const idx = args.indexOf('--base-url');
	return idx >= 0 ? args[idx + 1] : DEFAULT_BASE_URL;
})();
const KEY_ENV = (() => {
	const idx = args.indexOf('--key-env');
	return idx >= 0 ? args[idx + 1] : DEFAULT_KEY_ENV;
})();

const apiKey = process.env[KEY_ENV];
if (!apiKey) {
	console.error(`x ${KEY_ENV} is not set.`);
	console.error(`  Add to .env or export. For Groq, sign up at https://groq.com and create an API key.`);
	process.exit(1);
}

console.log(`Provider: ${BASE_URL}`);
console.log(`Model: ${MODEL}`);

// === Pillars ================================================================

const PILLARS = [
	{
		id: 'medical_self_efficacy',
		label: 'Medical self-efficacy',
		captures: 'How much the patient feels able to understand, navigate, and manage their own clinical care — reading studies, advocating for tests, understanding lab values, pushing back on doctors.',
		signals: {
			high: 'researches own care, advocates effectively, understands lab values and trial mechanisms, asks pointed clinical questions',
			low: 'defers entirely to providers, confused by terminology, accepts plans without questioning, doesn\'t track own labs'
		}
	},
	{
		id: 'provider_trust',
		label: 'Provider trust',
		captures: 'How much the patient trusts their care team — physician, specialists, trial coordinators. Includes feeling heard, respected, kept informed.',
		signals: {
			high: 'speaks warmly of providers, follows their guidance, feels heard',
			low: 'dismissed, gaslit, feels providers don\'t listen, gets information from Reddit not their doctor'
		}
	},
	{
		id: 'logistical_capacity',
		label: 'Logistical capacity',
		captures: 'Practical ability to manage the logistics of care — transportation, time off work, childcare, money for copays, distance to specialists.',
		signals: {
			high: 'partner-supported, lives near a center of excellence, flexible job, financial cushion',
			low: 'no caregiver for post-procedure rides, single parent, hourly job with no PTO, far from any specialty center'
		}
	},
	{
		id: 'emotional_valence',
		label: 'Emotional valence',
		captures: 'The patient\'s current emotional state and trajectory — hope, grief, exhaustion, fear, faith, anger, resignation.',
		signals: {
			high: 'hopeful, engaged, finds meaning in journey, faith intact',
			low: 'exhausted, hopeless, grieving lost identity, afraid, angry, resigned'
		}
	}
];
const VALID_PILLAR_IDS = new Set(PILLARS.map((p) => p.id));
const VALID_SIGNALS = new Set(['high', 'low', 'mixed']);

// === Load corpus ============================================================

const CORPUS_DIR = `src/lib/content/corpora/${corpusId}`;
const MANIFEST_FILE = `${CORPUS_DIR}/manifest.json`;
if (!existsSync(resolve(ROOT, MANIFEST_FILE))) {
	console.error(`x Corpus manifest not found: ${MANIFEST_FILE}`);
	process.exit(1);
}
const manifest = JSON.parse(readFileSync(resolve(ROOT, MANIFEST_FILE), 'utf8'));
console.log(`Corpus: ${corpusId} (indications: ${(manifest.indications ?? []).join(', ') || '(none in manifest)'})`);

const FRAGMENTS_DIR = `${CORPUS_DIR}/fragments`;
const partitions = [];
for (const f of readdirSync(resolve(ROOT, FRAGMENTS_DIR)).filter((f) => f.endsWith('.json'))) {
	const doc = JSON.parse(readFileSync(resolve(ROOT, FRAGMENTS_DIR, f), 'utf8'));
	const contentSource = doc.meta?.content_source ?? f.replace(/\.json$/, '');
	if (sourceFilter && contentSource !== sourceFilter) continue;
	partitions.push({
		content_source: contentSource,
		fragments: (doc.fragments ?? []).filter((f) => f.text && typeof f.text === 'string')
	});
}
if (partitions.length === 0) {
	console.error(`x No partitions to tag${sourceFilter ? ` (filtered to --source ${sourceFilter})` : ''}.`);
	process.exit(1);
}

// === Prompt =================================================================

const SYSTEM_PROMPT = `You are a qualitative-research analyst tagging fragments of patient/caregiver text with persona-pillar signals.

THE FOUR PILLARS — score each fragment on the pillar(s) it substantively touches:

${PILLARS.map((p) => `  ${p.id} (${p.label}):
    captures: ${p.captures}
    HIGH:  ${p.signals.high}
    LOW:   ${p.signals.low}`).join('\n\n')}

YOUR JOB: For each fragment, return a "pillars" array of zero or more tags. Each tag has:
  - pillar: one of medical_self_efficacy, provider_trust, logistical_capacity, emotional_valence (exact id)
  - signal: "high" | "low" | "mixed"
  - text: short verbatim span from the fragment showing the signal (≤120 chars)
  - confidence: 0.0–1.0
  - rationale: short reason

GUIDANCE:
- Tag substantively. "Hope you feel better!" doesn't get emotional_valence:low for the speaker.
- A fragment can touch multiple pillars. Common: "I drove 4 hours and the doctor still dismissed me" → logistical_capacity:low + provider_trust:low + emotional_valence:low.
- "mixed" only when the speaker is genuinely ambivalent or both signals are present in one span.
- If nothing applies, return an empty pillars array — don't force a tag.
- Use ONLY the four pillar ids. Do not invent.
- Return ONLY a valid JSON object matching the schema. No prose.

OUTPUT SCHEMA (return exactly this shape):
{
  "annotations": [
    {
      "fragment_id": "string",
      "pillars": [
        { "pillar": "string", "signal": "string", "text": "string", "confidence": number, "rationale": "string" }
      ]
    }
  ]
}`;

// === API call helper ========================================================

async function callLLM(payload) {
	const body = {
		model: MODEL,
		messages: [
			{ role: 'system', content: SYSTEM_PROMPT },
			{
				role: 'user',
				content:
					`Tag every fragment below with the relevant persona-pillar signals. ` +
					`Return one annotation per fragment, using the same fragment_id. ` +
					`Fragments:\n\n${JSON.stringify(payload, null, 2)}`
			}
		],
		// JSON mode is supported by Groq + OpenAI + most providers; ensures
		// the response is parseable JSON without prose wrapping.
		response_format: { type: 'json_object' },
		temperature: 0.2,
		max_tokens: 8000
	};
	const res = await fetch(`${BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify(body)
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`HTTP ${res.status}: ${text}`);
	}
	const data = await res.json();
	const text = data.choices?.[0]?.message?.content;
	if (!text) throw new Error('No message content in response');
	const usage = data.usage ?? {};
	return { text, usage };
}

// === Run ====================================================================

const BATCH_SIZE = 40;

for (const { content_source, fragments } of partitions) {
	const OUT_FILE = `${CORPUS_DIR}/persona_pillars/${content_source}.json`;
	console.log(`\n=== ${corpusId} / ${content_source} (${fragments.length} fragments) ===`);
	console.log(`  → ${OUT_FILE}`);

	const scanFragments = sampleSize && sampleSize < fragments.length
		? fragments.slice(0, sampleSize)
		: fragments;
	if (sampleSize) console.log(`  Scanning first ${scanFragments.length} fragments (--sample ${sampleSize}).`);

	let existing = { meta: {}, persona_pillars: {} };
	if (existsSync(resolve(ROOT, OUT_FILE))) {
		existing = JSON.parse(readFileSync(resolve(ROOT, OUT_FILE), 'utf8'));
	}
	const todo = scanFragments.filter((f) => force || !(f.id in (existing.persona_pillars ?? {})));
	if (todo.length === 0) {
		console.log('  Nothing to tag — every fragment already has persona_pillars. Use --force to re-tag.');
		continue;
	}

	const batches = [];
	for (let i = 0; i < todo.length; i += BATCH_SIZE) {
		batches.push(todo.slice(i, i + BATCH_SIZE));
	}
	console.log(`  ${todo.length} fragments to tag, ${batches.length} batch(es).`);

	const personaPillars = { ...(existing.persona_pillars ?? {}) };
	const usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
	const counts = { tagged: 0, empty: 0, span_misses: 0, invalid_pillar: 0, invalid_signal: 0 };

	function writeOutput() {
		const nowIso = new Date().toISOString();
		const doc = {
			meta: {
				schema_version: 'persona-pillars-0.1',
				generator: SCRIPT_VERSION,
				model: MODEL,
				base_url: BASE_URL,
				corpus_id: corpusId,
				content_source,
				updated_at: nowIso,
				pillar_count: PILLARS.length,
				tagged_fragment_count: Object.keys(personaPillars).length,
				total_tag_count: Object.values(personaPillars).reduce((s, t) => s + t.length, 0),
				usage_total: usage
			},
			persona_pillars: Object.fromEntries(
				Object.keys(personaPillars).sort().map((k) => [k, personaPillars[k]])
			)
		};
		const outPath = resolve(ROOT, OUT_FILE);
		mkdirSync(dirname(outPath), { recursive: true });
		writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
	}

	for (let bi = 0; bi < batches.length; bi++) {
		const batch = batches[bi];
		console.log(`  Batch ${bi + 1}/${batches.length} (${batch.length} fragments)...`);

		const payload = batch.map((f) => ({
			fragment_id: f.id,
			text: f.text.length > 1500 ? f.text.slice(0, 1500) + '…' : f.text
		}));

		let response;
		try {
			response = await callLLM(payload);
		} catch (e) {
			console.error(`x batch ${bi + 1}: API call failed — ${e.message ?? e}`);
			if (Object.keys(personaPillars).length > existing.persona_pillars
				? Object.keys(existing.persona_pillars).length : 0) {
				writeOutput();
				console.error(`  Checkpoint written: ${OUT_FILE}`);
			}
			process.exit(1);
		}
		const { text: textResponse, usage: u } = response;
		usage.prompt_tokens += u.prompt_tokens ?? 0;
		usage.completion_tokens += u.completion_tokens ?? 0;
		usage.total_tokens += u.total_tokens ?? 0;
		console.log(`    usage: prompt=${u.prompt_tokens} completion=${u.completion_tokens}`);

		let parsed;
		try {
			parsed = JSON.parse(textResponse);
		} catch (e) {
			console.error(`x batch ${bi + 1}: response was not valid JSON — ${e.message}`);
			console.error(`  First 200 chars: ${textResponse.slice(0, 200)}`);
			writeOutput();
			process.exit(1);
		}
		if (!Array.isArray(parsed.annotations)) {
			console.error(`x batch ${bi + 1}: no "annotations" array in response. Keys: ${Object.keys(parsed)}`);
			writeOutput();
			process.exit(1);
		}

		const fragsById = new Map(batch.map((f) => [f.id, f]));
		const nowIso = new Date().toISOString();

		for (const ann of parsed.annotations) {
			const frag = fragsById.get(ann.fragment_id);
			if (!frag) {
				console.warn(`    ! unknown fragment_id in response: ${ann.fragment_id}`);
				continue;
			}
			const text = frag.text;
			const tags = [];
			for (const t of ann.pillars ?? []) {
				if (!VALID_PILLAR_IDS.has(t.pillar)) {
					counts.invalid_pillar += 1;
					continue;
				}
				if (!VALID_SIGNALS.has(t.signal)) {
					counts.invalid_signal += 1;
					continue;
				}
				const start = text.indexOf(t.text);
				if (start < 0) {
					counts.span_misses += 1;
					continue;
				}
				tags.push({
					pillar: t.pillar,
					signal: t.signal,
					span: { start, end: start + t.text.length, text: t.text },
					confidence: Math.max(0, Math.min(1, Number(t.confidence) || 0)),
					rationale: t.rationale ?? '',
					tagger: 'llm-proposed',
					created_at: nowIso
				});
			}
			personaPillars[ann.fragment_id] = tags;
			if (tags.length > 0) counts.tagged += 1;
			else counts.empty += 1;
		}

		writeOutput();
	}

	writeOutput();
	console.log(`  Done. tagged=${counts.tagged} empty=${counts.empty} span_misses=${counts.span_misses} invalid_pillar=${counts.invalid_pillar} invalid_signal=${counts.invalid_signal}`);
	console.log(`  Usage: prompt=${usage.prompt_tokens} completion=${usage.completion_tokens} total=${usage.total_tokens}`);
}

console.log('\n=== All partitions complete ===');
