/**
 * POST /api/workbench/ask
 *
 * Tool-use loop over the workbench corpus. The model can only answer by
 * composing the tools in $lib/server/workbench-tools — it never sees raw
 * fragment text except via get_fragments, which only returns text for IDs it
 * already named. Counts and rankings come from tool results, not free
 * generation, so the answer is structurally grounded in the corpus.
 *
 * Citations: the model is told to cite quotable fragments inline as
 * `[frag:<id>]`. After the loop, validateCitations() resolves every cited id
 * against the corpus and returns the structured citation list separately.
 * Any unresolved id is replaced with `[citation missing]` and `valid: false`
 * is set on the response so the UI can warn the user.
 *
 * Request:   { question: string, indication?: string, additional_indications?: string[] }
 * Response:  { answer, citations, missing_citations, valid, indications, trace }
 *
 * When `additional_indications` is provided, fragments + personas from those
 * indications are merged into the same workbench pool so the model can
 * compare/contrast across them. Citations carry an `indication` tag so the
 * client can attribute each quote to its source indication.
 */

import Anthropic from '@anthropic-ai/sdk';
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	createSession,
	executeTool,
	loadWorkbenchContext,
	TOOL_DEFS,
	validateCitations
} from '$lib/server/workbench-tools';
import type { RequestHandler } from './$types';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;
const MAX_TOOL_ROUNDS = 16;

const SYSTEM_PROMPT = `You are the answer surface of PatientlyIQ, a research tool that explores patient and caregiver voices across indications. The reader is a researcher, brand strategist, or clinical-team member preparing a strategy doc — write for them.

Voice and word choice — MANDATORY:
- Never use the words "fragment", "corpus", "annotation", "dataset", "pool", "slice", "the data", "the taxonomy", "tagged with". These are internal terms.
- Use plain-language equivalents instead: "quote", "patient", "caregiver", "voice", "post", "comment", "what patients said about X".
- Never narrate what you (the AI) are doing. Forbidden openers include "Excellent", "Great question", "Let me", "I now have", "I'll compile", "Here is", "Here's", "Based on the data". Start with the answer itself.
- Never describe how many quotes you pulled in this kind of phrasing: "drawn from 71 LN fragments tagged with trial_barriers." Instead write naturally about people: "Across 71 Lupus Nephritis quotes and 24 MS quotes about clinical trials, ..."
- Refer to people by what they are (patients, caregivers, partners, providers), never by their internal speaker_id or role string.

Answer structure — MANDATORY:
1. Open with a 1–2 sentence high-level summary that answers the question directly, before any breakdown. The summary should be a takeaway a strategy doc could quote verbatim. No bullets, no citations, no caveats in the summary — just the headline finding.
2. Then a short supporting body. Use **bold** sparingly to anchor the 3–6 most important sub-points. Cite quotes inline as [frag:<id>] adjacent to the claim they support. Keep total length under 240 words unless the question asks for depth.
3. End with "Try next:" + 2–3 concrete follow-up questions, one per line. Skip this if the user explicitly asks a yes/no question.

Grounding rules:
- You answer ONLY by composing the provided tools. You never invent quote ids, theme ids, subtheme ids, stage ids, topic ids, or counts. Every numeric claim ("most discussed", "5 of 12 patients", "highest sentiment") must come from a tool result you just received.
- Workflow: get_taxonomy first → filter_fragments to narrow → rank_by_dimension or crosstab to compute → get_fragments before paraphrasing or quoting → write the answer. Cite at least 2 quotes when making a "most/least" claim. Cite quotes adjacent to the claim, not bunched at the end.
- The UI displays each [frag:<id>] citation with its source indication chip automatically, so never write parentheticals like "(LN)" or "(indication: ms)".

Multi-indication answers:
- When the question compares two or more indications, lead with a one-sentence summary that names the headline contrast ("Eligibility exclusions are the dominant barrier in both, but Lupus Nephritis voices skew far more toward comorbidity-driven exclusions while MS voices focus on prior-treatment washouts."), then organize the body by theme (NOT by indication), and within each theme cite at least one quote per indication you compare.

Thin-data handling:
- When the relevant slice is small (< 15 quotes total, top bucket < 3 quotes, single-thread, or zero matches), still lead with the summary, then name what's known and what's not in plain language ("Only 6 MS patients in this set spoke about trial logistics, all in one Reddit thread"), and finish with the "Try next:" suggestions. Never close on a bare "the data is too small" caveat.
- If the question can't be answered from any available indication, say so plainly in the summary. Do not speculate.

Format: plain text. No markdown headings. **Bold** for emphasis. [frag:<id>] for citations. Numbered or bulleted sub-points are fine inside the body when comparing 3+ items. Never use single-asterisk *text* — that markdown renders as italic and is disallowed. If you want to set off an inline quote, surround it with straight double quotes "like this" and use **bold** if it needs additional emphasis.`;

type ToolUseBlock = {
	type: 'tool_use';
	id: string;
	name: string;
	input: Record<string, unknown>;
};

type TextBlock = { type: 'text'; text: string };

type MessageBlock = TextBlock | ToolUseBlock | { type: string; [k: string]: unknown };

type TraceEntry =
	| { role: 'tool_use'; name: string; input: Record<string, unknown> }
	| { role: 'tool_result'; tool_use_id: string; ok: boolean; data?: unknown; error?: string };

// Dev-mode .env-first key resolver. Aaron's shell sometimes has a stale
// ANTHROPIC_API_KEY exported (carried over from other projects) that
// silently shadows the project's .env value, producing 401s from the SDK.
// In dev we read .env directly and prefer its value; production reads
// process.env normally because the deploy environment is the source of truth.
const DEV_DOTENV_KEY: string | undefined = (() => {
	if (process.env.NODE_ENV === 'production') return undefined;
	try {
		const text = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
		for (const line of text.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eq = trimmed.indexOf('=');
			if (eq === -1) continue;
			const key = trimmed.slice(0, eq).trim();
			if (key !== 'ANTHROPIC_API_KEY') continue;
			let value = trimmed.slice(eq + 1).trim();
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			return value;
		}
	} catch {
		// .env missing or unreadable — fall through to process.env
	}
	return undefined;
})();

function getAnthropicKey(): string | undefined {
	return DEV_DOTENV_KEY ?? env.ANTHROPIC_API_KEY;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		return await handle(request);
	} catch (e) {
		if ((e as { status?: number }).status !== undefined) throw e;
		const message = e instanceof Error ? e.message : String(e);
		console.error('[workbench/ask] failure:', message, e instanceof Error ? e.stack : '');
		throw error(500, `workbench/ask failed: ${message}`);
	}
};

async function handle(request: Request): Promise<Response> {
	const body = (await request.json().catch(() => ({}))) as {
		question?: string;
		indication?: string;
		additional_indications?: unknown;
	};
	const question = body.question?.trim();
	if (!question) throw error(400, '`question` is required');
	const indication = body.indication?.trim() || 'obesity';
	const additional = Array.isArray(body.additional_indications)
		? body.additional_indications
				.map((x) => (typeof x === 'string' ? x.trim() : ''))
				.filter((x): x is string => x.length > 0 && x !== indication)
		: [];

	const ctx = await loadWorkbenchContext(indication, additional);
	if (ctx.fragments.length === 0) {
		throw error(404, `no fragments loaded for indication "${indication}"`);
	}
	const session = createSession(ctx);

	const apiKey = getAnthropicKey();
	if (!apiKey) {
		throw error(
			500,
			'ANTHROPIC_API_KEY is not set. Add it to .env or the deploy environment.'
		);
	}
	const client = new Anthropic({ apiKey });
	const messages: Anthropic.MessageParam[] = [
		{ role: 'user', content: question }
	];

	const trace: TraceEntry[] = [];
	let finalText = '';
	let stop_reason: string | null = null;

	for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
		const isFinalRound = round === MAX_TOOL_ROUNDS - 1;
		const response = await client.messages.create({
			model: MODEL,
			max_tokens: MAX_TOKENS,
			system: [
				{
					type: 'text',
					text: SYSTEM_PROMPT,
					cache_control: { type: 'ephemeral' }
				}
			],
			tools: TOOL_DEFS as unknown as Anthropic.Tool[],
			// On the final round, forbid tool use entirely so the model MUST
			// emit a text answer instead of looping.
			...(isFinalRound ? { tool_choice: { type: 'none' as const } } : {}),
			messages
		});
		stop_reason = response.stop_reason ?? null;

		// Push the assistant turn into history so the next round sees it.
		messages.push({ role: 'assistant', content: response.content });

		if (response.stop_reason !== 'tool_use') {
			finalText = (response.content as MessageBlock[])
				.filter((b): b is TextBlock => b.type === 'text')
				.map((b) => b.text)
				.join('\n')
				.trim();
			break;
		}

		// Execute every tool_use block in this turn; collect tool_result blocks.
		const toolUses = (response.content as MessageBlock[]).filter(
			(b): b is ToolUseBlock => b.type === 'tool_use'
		);
		const toolResults: Anthropic.ToolResultBlockParam[] = [];
		for (const tu of toolUses) {
			trace.push({ role: 'tool_use', name: tu.name, input: tu.input });
			const result = await executeTool(tu.name, tu.input, session);
			if (result.ok) {
				trace.push({ role: 'tool_result', tool_use_id: tu.id, ok: true, data: result.data });
				toolResults.push({
					type: 'tool_result',
					tool_use_id: tu.id,
					content: JSON.stringify(result.data)
				});
			} else {
				trace.push({ role: 'tool_result', tool_use_id: tu.id, ok: false, error: result.error });
				toolResults.push({
					type: 'tool_result',
					tool_use_id: tu.id,
					content: result.error,
					is_error: true
				});
			}
		}
		messages.push({ role: 'user', content: toolResults });
	}

	if (!finalText) {
		return json(
			{
				question,
				indication,
				error: `workbench did not produce a final answer (stop_reason=${stop_reason ?? 'unknown'} after ${MAX_TOOL_ROUNDS} rounds)`,
				trace
			},
			{ status: 502 }
		);
	}

	const validated = validateCitations(finalText, ctx);
	return json({
		question,
		indication,
		additional_indications: additional,
		...validated,
		trace
	});
};
