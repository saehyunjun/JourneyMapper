/**
 * POST /api/personas/generate-narrative
 *
 * Spawn scripts/propose-persona-narrative.mjs for a saved persona to write
 * the <id>.narrative.json sidecar. Runs synchronously from the request's
 * perspective — the route resolves only when the child process exits — so
 * the client can show a single in-flight progress toast and upgrade it on
 * completion. Generation calls Claude and typically takes 30s–2min.
 *
 * Body: { persona_id: string, force?: boolean }
 * Response (success): { ok: true, persona_id: string, path: string, stdout_tail: string }
 * Response (error):   { error: string, message: string, stderr_tail?: string, stdout_tail?: string }
 *
 * Like /api/personas/save, this writes into the source tree and isn't
 * intended for production traffic — analyst-workbench dev flow only.
 */
import { json, error } from '@sveltejs/kit';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generatedPersonaAvatarUrl } from '$lib/dicebear-avatars';
import type { Persona } from '$lib/content/personas/types';
import type { RequestHandler } from './$types';

const ID_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const SCRIPT_REL = 'scripts/propose-persona-narrative.mjs';
const PERSONAS_DIR_REL = 'src/lib/content/personas';
const TAIL_CHARS = 1200;

function tail(s: string, n: number): string {
	return s.length <= n ? s : '…' + s.slice(-n);
}

export const POST: RequestHandler = async ({ request }) => {
	let body: { persona_id?: string; force?: boolean };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Body must be JSON.');
	}

	const personaId = body.persona_id?.trim();
	if (!personaId || !ID_RE.test(personaId)) {
		throw error(400, 'persona_id must match /^[a-z0-9][a-z0-9_-]{1,63}$/.');
	}

	const cwd = process.cwd();
	const personaPath = resolve(cwd, PERSONAS_DIR_REL, `${personaId}.json`);
	if (!existsSync(personaPath)) {
		throw error(404, `No saved persona with id "${personaId}".`);
	}

	const scriptPath = resolve(cwd, SCRIPT_REL);
	if (!existsSync(scriptPath)) {
		throw error(500, `Generator script missing at ${SCRIPT_REL}.`);
	}

	const args = [scriptPath, personaId];
	if (body.force) args.push('--force');

	// The propose script reads ANTHROPIC_API_KEY from .env via dotenv-style
	// loading in the script itself. We pass the current env through but also
	// blank ANTHROPIC_API_KEY if it's set in the parent shell — the saved
	// .env value is what works (see scripts-env-override gotcha).
	const env = { ...process.env };
	delete env.ANTHROPIC_API_KEY;

	let stdout = '';
	let stderr = '';
	const child = spawn('node', args, { cwd, env });
	child.stdout?.on('data', (chunk) => (stdout += chunk.toString()));
	child.stderr?.on('data', (chunk) => (stderr += chunk.toString()));

	const exitCode: number = await new Promise((resolveCode, rejectCode) => {
		child.on('error', rejectCode);
		child.on('close', (code) => resolveCode(code ?? -1));
	});

	if (exitCode !== 0) {
		throw error(
			500,
			`Narrative generator exited with code ${exitCode}. ${tail(stderr || stdout, 300)}`
		);
	}

	const narrativePath = resolve(cwd, PERSONAS_DIR_REL, `${personaId}.narrative.json`);
	if (!existsSync(narrativePath)) {
		throw error(
			500,
			`Script exited 0 but no narrative file was written at ${PERSONAS_DIR_REL}/${personaId}.narrative.json. stdout: ${tail(stdout, 300)}`
		);
	}

	// Sanity-check the produced JSON parses — the script ought to have done
	// this itself, but if a future regression slips a stray log line into the
	// output we'd rather surface that here than at next page-load.
	try {
		JSON.parse(readFileSync(narrativePath, 'utf8'));
	} catch (e) {
		throw error(500, `Narrative file is not valid JSON: ${(e as Error).message}`);
	}

	let avatarUrl = '';
	try {
		const persona = JSON.parse(readFileSync(personaPath, 'utf8')) as Persona;
		avatarUrl = generatedPersonaAvatarUrl(persona);
		if (persona.avatar_url !== avatarUrl) {
			writeFileSync(
				personaPath,
				JSON.stringify({ ...persona, avatar_url: avatarUrl }, null, 2) + '\n'
			);
		}
	} catch (e) {
		throw error(500, `Could not attach persona avatar URL: ${(e as Error).message}`);
	}

	return json({
		ok: true,
		persona_id: personaId,
		path: `${PERSONAS_DIR_REL}/${personaId}.narrative.json`,
		avatar_url: avatarUrl,
		stdout_tail: tail(stdout, TAIL_CHARS)
	});
};
