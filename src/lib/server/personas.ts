/**
 * server/personas.ts
 *
 * Server-only loader for persona JSON files. Discovers every *.json in
 * src/lib/content/personas/ at request time so adding a new persona is a
 * single-file edit. No restart required in dev.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Persona } from '$lib/content/personas/types';

const PERSONAS_DIR = resolve(process.cwd(), 'src/lib/content/personas');

export function listPersonas(): Persona[] {
	return readdirSync(PERSONAS_DIR)
		.filter((f) => f.endsWith('.json') && !f.endsWith('.narrative.json'))
		.map((f) => JSON.parse(readFileSync(resolve(PERSONAS_DIR, f), 'utf8')) as Persona)
		.sort((a, b) => a.id.localeCompare(b.id));
}
