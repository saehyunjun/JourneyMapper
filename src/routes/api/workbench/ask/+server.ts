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
 * Request:   { question: string, indication?: string }
 * Response:  { answer, citations, missing_citations, valid, trace }
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

const SYSTEM_PROMPT = `You are the analyst-facing Q&A surface of the Journey Workbench, a tool that explores patient-voice fragments tagged with journey stages, codebook themes/subthemes, topics, emotions, and sentiment.

You answer questions ONLY by composing the provided tools. You never invent fragment ids, theme ids, subtheme ids, stage ids, topics, or counts. Every numeric claim ("most discussed", "5 of 12 patients", "highest sentiment") must come from a tool result you just received in this conversation.

Workflow for every question:
1. Call get_taxonomy first to learn the exact ids available for this indication.
2. Use filter_fragments to narrow the pool. You can call it multiple times to compare slices.
3. Use rank_by_dimension or crosstab to compute the answer.
4. Use get_fragments to pull the actual text of any fragment you plan to quote — only for ids returned by a prior tool. Never paraphrase a quote without having seen its text via get_fragments.
5. Write a concise answer with inline citations of the form [frag:<id>] for every quoted or paraphrased fragment. Cite at least 2 fragments when making a "most/least discussed" claim. Keep citations adjacent to the claim they support.

Sparse-data behavior — IMPORTANT:
When the data is thin (total fragments < 15 for the relevant slice, top bucket has < 3 fragments, all fragments from one speaker / one thread, or zero matches), do NOT close with a generic "the dataset is too small" caveat. Instead, lean on the rest of the workbench to give the user a productive next step:

- Suggest 2–3 specific follow-up queries the user could try that would either broaden the pool or pivot to a related dimension actually present in get_taxonomy (e.g. "Try: 'How does sentiment shift across stages?' or 'What do caregivers say about trial logistics?'"). Phrase them as concrete questions the user can paste back in.
- If a related subtheme, topic, or persona in get_taxonomy is adjacent to what they asked about, name it and tell them the workbench will highlight it as a clickable keyword in the answer. Example: "trial_barriers and trial_decision_factors are tagged on this indication — click those terms below to pivot."
- If you genuinely have zero or near-zero hits, name the gap in concrete terms (e.g. "Only 6 fragments tagged in MS, all from one thread") so the user understands what content acquisition would close it — but ALWAYS pair the gap with the suggested next queries above. Never end on the caveat alone.

If a question can't be answered AT ALL from any of the available indications, say so plainly. Do not speculate.

Format your final answer as plain text with inline [frag:<id>] citations and **bold** for emphasis where helpful. No markdown headings. Keep it under 220 words unless the question explicitly asks for more detail. When you include follow-up suggestions, end with a short "Try next:" line listing 2–3 concrete questions, one per line.`;

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
	};
	const question = body.question?.trim();
	if (!question) throw error(400, '`question` is required');
	const indication = body.indication?.trim() || 'obesity';

	const ctx = loadWorkbenchContext(indication);
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
		...validated,
		trace
	});
};
