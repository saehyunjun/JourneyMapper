/**
 * POST /api/personas/save
 *
 * Persists a Persona JSON file under src/lib/content/personas/. Validates the
 * id is a safe filename slug and that required fields are present. By default
 * refuses to overwrite an existing file; pass `{ force: true }` to overwrite.
 *
 * Body: { persona: Persona, force?: boolean }
 *
 * Response: { ok: true, path: string }
 *
 * NOTE: this writes to the source tree. Intended for the analyst-workbench
 * dev flow, not for production traffic — there's no auth here. If we ever
 * deploy this app multi-tenant, gate the route behind an analyst-only check
 * (or move persona storage off the filesystem entirely).
 */
import { json, error } from '@sveltejs/kit';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Persona } from '$lib/content/personas/types';
import type { RequestHandler } from './$types';

const PERSONAS_DIR = resolve(process.cwd(), 'src/lib/content/personas');
const ID_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;

function validatePersona(p: unknown): asserts p is Persona {
	if (!p || typeof p !== 'object') throw error(400, 'persona must be an object.');
	const o = p as Record<string, unknown>;
	if (typeof o.id !== 'string' || !ID_RE.test(o.id)) {
		throw error(400, 'persona.id must match /^[a-z0-9][a-z0-9_-]{1,63}$/.');
	}
	if (typeof o.label !== 'string' || o.label.trim().length === 0) {
		throw error(400, 'persona.label is required.');
	}
	if (typeof o.description !== 'string' || o.description.trim().length === 0) {
		throw error(400, 'persona.description is required.');
	}
	if (!Array.isArray(o.applicable_indications) || o.applicable_indications.length === 0) {
		throw error(400, 'persona.applicable_indications must be a non-empty array.');
	}
	if (!o.filter || typeof o.filter !== 'object') {
		throw error(400, 'persona.filter is required.');
	}
	if (!o.weighting || typeof o.weighting !== 'object') {
		throw error(400, 'persona.weighting is required.');
	}
}

export const POST: RequestHandler = async ({ request }) => {
	let body: { persona?: unknown; force?: boolean };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Body must be JSON.');
	}

	validatePersona(body.persona);
	const persona = body.persona;
	const force = body.force === true;

	const filePath = resolve(PERSONAS_DIR, `${persona.id}.json`);
	if (existsSync(filePath) && !force) {
		throw error(409, `persona "${persona.id}" already exists. Pass force:true to overwrite.`);
	}
	if (!existsSync(PERSONAS_DIR)) mkdirSync(PERSONAS_DIR, { recursive: true });

	writeFileSync(filePath, JSON.stringify(persona, null, 2) + '\n');

	return json({ ok: true, path: `src/lib/content/personas/${persona.id}.json` });
};
