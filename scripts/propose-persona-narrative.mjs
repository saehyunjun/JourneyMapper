/**
 * propose-persona-narrative.mjs
 *
 * Turn a saved PersonaFilter into a Commonwealth-Fund-style narrative
 * archetype. Reads src/lib/content/personas/<id>.json, finds the corpus
 * that matches its applicable_indications, runs the filter, picks a
 * representative evidence set, and asks Claude to synthesize:
 *
 *   - tagline:    ~10 words, archetype subtitle
 *   - paragraph:  200–300 word first-person voice synthesis
 *   - patient_concerns:  4 bullets — clinical / system facing (cost,
 *                        coverage, eligibility, side effects, logistics)
 *   - person_concerns:   4 bullets — lived-experience facing (identity,
 *                        family, fear, hope, isolation)
 *   - hero_quote_fragment_id: id of the most representative matched
 *                        fragment (must be in the evidence set we passed in)
 *
 * Output:
 *   src/lib/content/personas/<id>.narrative.json
 *
 * Run:
 *   node scripts/propose-persona-narrative.mjs <persona_id>
 *   node scripts/propose-persona-narrative.mjs <persona_id> --force
 *   node scripts/propose-persona-narrative.mjs --all       # every persona
 *
 * Requires ANTHROPIC_API_KEY in JourneyMapper/.env.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { matchesFilter } from '../src/lib/content/personas/derive.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const PERSONAS_DIR = 'src/lib/content/personas';
const CORPORA_DIR = 'src/lib/content/corpora';
const CODEBOOK_FILE = 'src/lib/content/wctglpdemo-data/codebook.json';

const MODEL = 'claude-opus-4-7';
const SCRIPT_VERSION = 'propose-persona-narrative@0.1';
const SCHEMA_VERSION = '1.0';
const EVIDENCE_FRAGMENTS_MAX = 20;
const EVIDENCE_TEXT_CHARS = 1200;

// === Env ====================================================================

if (existsSync(resolve(ROOT, '.env'))) process.loadEnvFile(resolve(ROOT, '.env'));
if (!process.env.ANTHROPIC_API_KEY) {
	console.error('x ANTHROPIC_API_KEY is not set.');
	console.error('  Add it to JourneyMapper/.env (ANTHROPIC_API_KEY=sk-ant-...) or export it.');
	process.exit(1);
}

// === CLI ====================================================================

const args = process.argv.slice(2);
const force = args.includes('--force');
const all = args.includes('--all');
const positional = args.filter((a) => !a.startsWith('-'));

if (!all && positional.length === 0) {
	console.error('x Usage: node scripts/propose-persona-narrative.mjs <persona_id> [--force]');
	console.error('       node scripts/propose-persona-narrative.mjs --all [--force]');
	process.exit(1);
}

// === Load taxonomy + persona files =========================================

const codebook = JSON.parse(readFileSync(resolve(ROOT, CODEBOOK_FILE), 'utf8'));

function loadPersona(id) {
	const path = resolve(ROOT, PERSONAS_DIR, `${id}.json`);
	if (!existsSync(path)) {
		console.error(`x Persona not found: ${path}`);
		process.exit(1);
	}
	return JSON.parse(readFileSync(path, 'utf8'));
}

function listPersonaIds() {
	return readdirSync(resolve(ROOT, PERSONAS_DIR))
		.filter((f) => f.endsWith('.json') && !f.endsWith('.narrative.json'))
		.map((f) => f.replace(/\.json$/, ''));
}

// === Find a matching corpus =================================================

function findCorpus(persona) {
	const corporaRoot = resolve(ROOT, CORPORA_DIR);
	if (!existsSync(corporaRoot)) return null;
	for (const name of readdirSync(corporaRoot)) {
		const manifestPath = resolve(corporaRoot, name, 'manifest.json');
		if (!existsSync(manifestPath)) continue;
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
		const overlap = manifest.indications.some((i) => persona.applicable_indications.includes(i));
		if (!overlap) continue;

		// Load fragments + annotations for this corpus.
		const fragments = [];
		const fragmentsDir = resolve(corporaRoot, name, 'fragments');
		if (existsSync(fragmentsDir)) {
			for (const f of readdirSync(fragmentsDir).filter((f) => f.endsWith('.json'))) {
				const doc = JSON.parse(readFileSync(resolve(fragmentsDir, f), 'utf8'));
				for (const fr of doc.fragments ?? []) fragments.push(fr);
			}
		}
		const annotations = {};
		const annotationsDir = resolve(corporaRoot, name, 'annotations');
		if (existsSync(annotationsDir)) {
			for (const f of readdirSync(annotationsDir).filter((f) => f.endsWith('.json'))) {
				const doc = JSON.parse(readFileSync(resolve(annotationsDir, f), 'utf8'));
				if (doc.annotations) Object.assign(annotations, doc.annotations);
			}
		}
		return { manifest, fragments, annotations };
	}
	return null;
}

// === Evidence selection =====================================================

function pickEvidence(fragments, annotations, filter) {
	const matched = fragments.filter((f) => matchesFilter(f, filter, annotations));
	if (matched.length === 0) return [];

	const scored = matched.map((f) => {
		const ann = annotations[f.id];
		const tagDensity =
			(ann?.segment_tags?.subthemes?.length ?? 0) +
			(ann?.segment_tags?.emotions?.length ?? 0) +
			(ann?.stages?.values?.length ?? 0);
		const len = (f.text ?? '').length;
		const score = Math.log(1 + tagDensity) * Math.min(1, len / 200) + len / 5000;
		return { fragment: f, ann, score };
	});
	scored.sort((a, b) => b.score - a.score);

	// One per author to avoid one chatty voice dominating.
	const seenAuthors = new Set();
	const out = [];
	for (const s of scored) {
		const author = s.fragment.source_ref?.author_handle_hash ?? null;
		if (author && seenAuthors.has(author)) continue;
		if (author) seenAuthors.add(author);
		out.push(s);
		if (out.length >= EVIDENCE_FRAGMENTS_MAX) break;
	}
	return out;
}

// === Filter prose ===========================================================

function titleCase(s) {
	return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function filterProse(filter) {
	const parts = [];
	if (filter.indications?.length) {
		parts.push(`in ${filter.indications.map(titleCase).join(' / ')}`);
	}
	if (filter.content_source?.length) {
		parts.push(`from ${filter.content_source.map(titleCase).join(' or ')}`);
	}
	if (filter.annotations?.has_stage?.length) {
		parts.push(`at the ${filter.annotations.has_stage.map(titleCase).join(' / ')} stage`);
	}
	if (filter.annotations?.has_subtheme?.length) {
		parts.push(`touching ${filter.annotations.has_subtheme.map(titleCase).join(', ')}`);
	}
	if (filter.annotations?.has_emotion?.length) {
		parts.push(`carrying ${filter.annotations.has_emotion.map(titleCase).join(' / ')}`);
	}
	if (filter.annotations?.sentiment) {
		const { min, max } = filter.annotations.sentiment;
		parts.push(`sentiment band [${min ?? '-2'}, ${max ?? '2'}]`);
	}
	if (filter.speaker_attrs) {
		for (const [k, v] of Object.entries(filter.speaker_attrs)) {
			if (v?.in?.length) parts.push(`${titleCase(k)} ∈ {${v.in.join(', ')}}`);
		}
	}
	return parts.length ? `Fragments ${parts.join(', ')}.` : 'Unfiltered persona.';
}

// === Schema (filled in per call so hero_quote enum is the evidence ids) ====

const subthemeIds = codebook.themes.flatMap((t) => (t.subthemes ?? []).map((s) => s.id));
const subthemeLabelById = new Map();
for (const t of codebook.themes) {
	for (const s of t.subthemes ?? []) {
		subthemeLabelById.set(s.id, s.label ?? s.id);
	}
}

function buildSchema(evidenceIds) {
	return {
		type: 'object',
		additionalProperties: false,
		properties: {
			tagline: { type: 'string' },
			paragraph: { type: 'string' },
			patient_concerns: { type: 'array', items: { type: 'string' } },
			person_concerns: { type: 'array', items: { type: 'string' } },
			hero_quote_fragment_id: { type: 'string', enum: evidenceIds }
		},
		required: ['tagline', 'paragraph', 'patient_concerns', 'person_concerns', 'hero_quote_fragment_id']
	};
}

// === System prompt — cached prefix =========================================

const SYSTEM_PROMPT = `You are a qualitative-research analyst writing a Commonwealth-Fund-style persona archetype. The reference style is the "Frail Elderly Personas" series — each archetype has a memorable name, a short tagline, two columns of concerns split by lens (Patient vs Person), a 200–300 word first-person narrative paragraph that synthesizes the cluster's voice, and a single hero pull-quote.

You will receive:
  - Persona metadata: id, label, description, and a one-sentence filter prose describing the predicates that define this persona.
  - Top dominant tags (themes, subthemes, stages, steps, emotions) with their shares.
  - An evidence set: up to 20 representative fragments matching the filter, one per author. Each fragment has its id, the speaker's anonymized handle, the text, and any subtheme / emotion / sentiment tags.

Return ONE narrative object. Constraints:

1. tagline — a single line, 6–14 words, declarative or aphoristic. NOT a restatement of the label. Should evoke the archetype's distinctive emotional posture. Example forms: "Optimistic but cost-bruised." / "Researching the trial they may never enter." / "Carrying the family's medical literacy."

2. paragraph — 200–300 words, first person ("I"), grounded in the evidence fragments' actual phrasing and details (specific drug names, dollar amounts, family members, places, treatments mentioned). Do NOT invent specifics that aren't in the evidence. The paragraph should feel like a composite monologue from the cluster's median voice — neither one literal speaker nor an analyst's summary. Capture the dominant emotional register from the sentiment + emotion tags. Mention concrete situations from the fragments (e.g. "my doctor said semaglutide", "$1,200 a month", "drove three hours to Mass General") rather than abstractions ("medication cost", "long distances"). Avoid clinical jargon the patients themselves wouldn't use.

3. patient_concerns — exactly 4 bullets. Each bullet is one sentence, 8–18 words, written from the patient's own perspective in plain English. These cover the CLINICAL / SYSTEM facing concerns: cost, coverage, insurance, eligibility, treatment access, side effects, doctor/clinic communication, medication logistics, trial mechanics. Examples: "Worry the trial cost will exceed what insurance covers." / "Confused about which doctor manages which medication."

4. person_concerns — exactly 4 bullets. Each bullet is one sentence, 8–18 words, written from the patient's own perspective. These cover the LIVED EXPERIENCE / PERSON facing concerns: identity, family roles, hope/fear, isolation, body image, plans for the future, what feels lost, what feels possible, social stigma. Examples: "Miss the version of myself that didn't have to plan around medications." / "Worry my kids see me as fragile, not as their mom."

5. hero_quote_fragment_id — pick ONE evidence fragment id whose verbatim text best captures the cluster's distinctive emotional center. Prefer a fragment with strong voice, a memorable phrase, or a small concrete detail that crystallizes the persona. Avoid fragments that are too short (under ~25 words) or too long (over ~80 words) to be a quote.

Avoid:
  - Generic phrases ("seeks support", "lacks information", "faces barriers"). Replace with specific specifics from the evidence.
  - Restating the filter predicates ("This persona discusses trial barriers"). The reader can see the filter; the narrative should be IN VOICE.
  - Mixing patient and person concerns into the same column. Keep clinical/system in patient_concerns, lived/identity in person_concerns. Cost goes in patient. Loss of independence goes in person.
  - Generic optimism or pessimism not grounded in the evidence.

Codebook subtheme ids and labels (for context — you don't need to cite these):
${JSON.stringify(
	codebook.themes.map((t) => ({
		theme: t.id,
		subthemes: (t.subthemes ?? []).map((s) => ({ id: s.id, label: s.label }))
	})),
	null,
	2
)}`;

// === Per-persona call =======================================================

const client = new Anthropic();

async function proposeNarrative(persona, corpus, evidence) {
	const filter = persona.filter;
	const payload = {
		persona: {
			id: persona.id,
			label: persona.label,
			description: persona.description,
			filter_prose: filterProse(filter)
		},
		evidence: evidence.map(({ fragment, ann }) => {
			const text = fragment.text ?? '';
			return {
				id: fragment.id,
				author_handle: fragment.source_ref?.author_handle_hash ?? null,
				text: text.length > EVIDENCE_TEXT_CHARS ? text.slice(0, EVIDENCE_TEXT_CHARS) + '…' : text,
				subthemes: (ann?.segment_tags?.subthemes ?? []).map((id) => ({
					id,
					label: subthemeLabelById.get(id) ?? id
				})),
				emotions: ann?.segment_tags?.emotions ?? [],
				sentiment_score: ann?.segment_tags?.sentiment_score ?? null,
				stages: (ann?.stages?.values ?? []).map((s) => ({
					stage_id: s.stage_id,
					step_id: s.step_id
				}))
			};
		})
	};
	const evidenceIds = evidence.map(({ fragment }) => fragment.id);
	const schema = buildSchema(evidenceIds);

	const stream = client.messages.stream({
		model: MODEL,
		max_tokens: 8000,
		thinking: { type: 'adaptive' },
		output_config: { effort: 'high', format: { type: 'json_schema', schema } },
		system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
		messages: [
			{
				role: 'user',
				content:
					`Persona "${persona.id}" ("${persona.label}"). Write the archetype narrative.\n\n` +
					JSON.stringify(payload, null, 2)
			}
		]
	});

	const msg = await stream.finalMessage();
	const u = msg.usage;
	console.log(
		`  usage: in=${u.input_tokens} cache_write=${u.cache_creation_input_tokens} ` +
			`cache_read=${u.cache_read_input_tokens} out=${u.output_tokens}`
	);

	if (msg.stop_reason === 'max_tokens') {
		throw new Error(`${persona.id}: response hit max_tokens — output truncated.`);
	}
	if (msg.stop_reason === 'refusal') {
		throw new Error(`${persona.id}: model refused.`);
	}
	const textBlock = msg.content.find((b) => b.type === 'text');
	if (!textBlock) throw new Error(`${persona.id}: no text block in response.`);

	let parsed;
	try {
		parsed = JSON.parse(textBlock.text);
	} catch (e) {
		throw new Error(`${persona.id}: response was not valid JSON — ${e.message}`);
	}

	// Trim to expected counts; warn if too few.
	for (const kind of ['patient_concerns', 'person_concerns']) {
		if (!Array.isArray(parsed[kind])) {
			throw new Error(`${persona.id}: ${kind} missing from response.`);
		}
		if (parsed[kind].length < 4) {
			console.warn(`  ! ${persona.id}: ${kind} has only ${parsed[kind].length} (expected 4).`);
		}
		if (parsed[kind].length > 4) {
			console.log(`  trimmed ${kind} from ${parsed[kind].length} to 4.`);
			parsed[kind] = parsed[kind].slice(0, 4);
		}
	}

	const words = parsed.paragraph.trim().split(/\s+/).length;
	if (words < 150 || words > 350) {
		console.warn(`  ! ${persona.id}: paragraph is ${words} words (target 200–300).`);
	}

	if (!evidenceIds.includes(parsed.hero_quote_fragment_id)) {
		throw new Error(`${persona.id}: hero_quote_fragment_id "${parsed.hero_quote_fragment_id}" not in evidence set.`);
	}

	return parsed;
}

// === Filter hash (for cache invalidation when filter changes) ==============

function hashFilter(filter) {
	const canonical = JSON.stringify(filter, Object.keys(filter).sort());
	return createHash('sha256').update(canonical).digest('hex').slice(0, 12);
}

// === Main ===================================================================

const personaIds = all ? listPersonaIds() : positional;
if (personaIds.length === 0) {
	console.error('x No personas to process.');
	process.exit(1);
}

console.log(`Model: ${MODEL}`);
console.log(`Personas: ${personaIds.join(', ')}\n`);

let written = 0;
let skipped = 0;
for (const id of personaIds) {
	const outputPath = resolve(ROOT, PERSONAS_DIR, `${id}.narrative.json`);
	if (existsSync(outputPath) && !force) {
		console.log(`${id}: narrative already exists; re-run with --force to regenerate. Skipping.`);
		skipped += 1;
		continue;
	}

	const persona = loadPersona(id);
	const corpus = findCorpus(persona);
	if (!corpus) {
		console.error(
			`x ${id}: no corpus matches indications ${JSON.stringify(persona.applicable_indications)}.`
		);
		continue;
	}

	const evidence = pickEvidence(corpus.fragments, corpus.annotations, persona.filter);
	if (evidence.length < 3) {
		console.error(
			`x ${id}: only ${evidence.length} fragment(s) match the filter — too few to synthesize a narrative.`
		);
		continue;
	}
	console.log(`${id}: ${evidence.length} evidence fragments from "${corpus.manifest.label}".`);

	const narrative = await proposeNarrative(persona, corpus, evidence);
	const output = {
		meta: {
			schema_version: SCHEMA_VERSION,
			persona_id: id,
			corpus_id: corpus.manifest.id,
			filter_hash: hashFilter(persona.filter),
			evidence_fragment_ids: evidence.map(({ fragment }) => fragment.id),
			generator: SCRIPT_VERSION,
			model: MODEL,
			generated_at: new Date().toISOString()
		},
		...narrative
	};
	writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
	written += 1;
	console.log(`  OK ${id}.narrative.json — hero quote ${narrative.hero_quote_fragment_id}\n`);
}

console.log(`Wrote ${written}. Skipped ${skipped}.`);
