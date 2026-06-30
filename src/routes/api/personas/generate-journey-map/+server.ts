/**
 * POST /api/personas/generate-journey-map
 *
 * Spawn scripts/synthesize-journey-map.mjs for a (corpus_id, persona_id) pair
 * to write the journey-map artifact JSON the table + sidebar views render.
 * Sibling of /api/personas/generate-narrative — same spawn-and-wait pattern,
 * same env-key handling — but takes a corpus_id because the artifact is
 * keyed by (corpus, persona), not by persona alone.
 *
 * Long-running: one Claude call per stage, ~5–15 minutes for a 7-stage
 * persona on Opus. The client should display a long-duration toast and
 * tolerate the user closing the tab (the spawned child finishes either way).
 *
 * Body: { persona_id: string, corpus_id: string, force?: boolean }
 * Response (success): { ok: true, persona_id, corpus_id, path, stdout_tail }
 * Response (error):   { error, message, stderr_tail?, stdout_tail? }
 *
 * Analyst-workbench dev flow only — writes into the source tree.
 */
import { json, error } from '@sveltejs/kit';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RequestHandler } from './$types';

const ID_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const SCRIPT_REL = 'scripts/synthesize-journey-map.mjs';
const PERSONAS_DIR_REL = 'src/lib/content/personas';
const CORPORA_DIR_REL = 'src/lib/content/corpora';
const TAIL_CHARS = 1200;

function tail(s: string, n: number): string {
	return s.length <= n ? s : '…' + s.slice(-n);
}

export const POST: RequestHandler = async ({ request }) => {
	let body: { persona_id?: string; corpus_id?: string; force?: boolean };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Body must be JSON.');
	}

	const personaId = body.persona_id?.trim();
	const corpusId = body.corpus_id?.trim();
	if (!personaId || !ID_RE.test(personaId)) {
		throw error(400, 'persona_id must match /^[a-z0-9][a-z0-9_-]{1,63}$/.');
	}
	if (!corpusId || !ID_RE.test(corpusId)) {
		throw error(400, 'corpus_id must match /^[a-z0-9][a-z0-9_-]{1,63}$/.');
	}

	const cwd = process.cwd();
	const personaPath = resolve(cwd, PERSONAS_DIR_REL, `${personaId}.json`);
	if (!existsSync(personaPath)) {
		throw error(404, `No saved persona with id "${personaId}".`);
	}
	const corpusDir = resolve(cwd, CORPORA_DIR_REL, corpusId);
	if (!existsSync(corpusDir)) {
		throw error(404, `No corpus directory at ${CORPORA_DIR_REL}/${corpusId}.`);
	}

	const scriptPath = resolve(cwd, SCRIPT_REL);
	if (!existsSync(scriptPath)) {
		throw error(500, `Generator script missing at ${SCRIPT_REL}.`);
	}

	const args = [scriptPath, corpusId, personaId];
	if (body.force) args.push('--force');

	// Same env override as generate-narrative — the script reads
	// ANTHROPIC_API_KEY from .env, and a stale shell key would shadow it
	// (see scripts-env-override gotcha in repo memory).
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
			`Journey-map generator exited with code ${exitCode}. ${tail(stderr || stdout, 300)}`
		);
	}

	const artifactPath = resolve(
		corpusDir,
		'artifacts',
		`journey-map-${personaId}.json`
	);
	if (!existsSync(artifactPath)) {
		throw error(
			500,
			`Script exited 0 but no artifact at ${CORPORA_DIR_REL}/${corpusId}/artifacts/journey-map-${personaId}.json. stdout: ${tail(stdout, 300)}`
		);
	}

	try {
		JSON.parse(readFileSync(artifactPath, 'utf8'));
	} catch (e) {
		throw error(500, `Artifact is not valid JSON: ${(e as Error).message}`);
	}

	return json({
		ok: true,
		persona_id: personaId,
		corpus_id: corpusId,
		path: `${CORPORA_DIR_REL}/${corpusId}/artifacts/journey-map-${personaId}.json`,
		stdout_tail: tail(stdout, TAIL_CHARS)
	});
};
