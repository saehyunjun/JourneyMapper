/**
 * server/personas.ts
 *
 * Server-only loader for persona JSON files. Discovers every *.json in
 * src/lib/content/personas/ at request time so adding a new persona is a
 * single-file edit. No restart required in dev.
 *
 * Dev reads disk; prod uses bundled seeds (`import.meta.glob`) so the
 * functions don't depend on the source tree being deployed alongside the
 * bundle. Persona writes (api/personas/save, etc.) still hit disk in dev;
 * a prod write path would shadow the seeds with a KV layer like
 * corpus-store.ts does.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dev } from '$app/environment';
import type { Persona } from '$lib/content/personas/types';

const PERSONAS_DIR = resolve(process.cwd(), 'src/lib/content/personas');

type PersonaSeedMap = Record<string, Persona>;
type NarrativeSeedMap = Record<string, unknown>;

const { personaSeeds, narrativeSeeds } = (() => {
	const mods = import.meta.glob<unknown>('/src/lib/content/personas/*.json', {
		eager: true,
		import: 'default'
	});
	const personas: PersonaSeedMap = {};
	const narratives: NarrativeSeedMap = {};
	for (const [path, doc] of Object.entries(mods)) {
		const m = path.match(/personas\/(.+)\.json$/);
		if (!m) continue;
		if (m[1].endsWith('.narrative')) {
			narratives[m[1].replace(/\.narrative$/, '')] = doc;
		} else {
			personas[m[1]] = doc as Persona;
		}
	}
	return { personaSeeds: personas, narrativeSeeds: narratives };
})();

export function listPersonas(): Persona[] {
	if (dev) {
		return readdirSync(PERSONAS_DIR)
			.filter((f) => f.endsWith('.json') && !f.endsWith('.narrative.json'))
			.map((f) => JSON.parse(readFileSync(resolve(PERSONAS_DIR, f), 'utf8')) as Persona)
			.sort((a, b) => a.id.localeCompare(b.id));
	}
	return Object.values(personaSeeds).sort((a, b) => a.id.localeCompare(b.id));
}

/** True iff a `<persona_id>.narrative.json` sidecar exists. Used by the
 *  workbench to choose "Create narrative chart" vs. "View narrative". */
export function hasPersonaNarrative(personaId: string): boolean {
	if (dev) {
		return existsSync(resolve(PERSONAS_DIR, `${personaId}.narrative.json`));
	}
	return personaId in narrativeSeeds;
}

/** The narrative sidecar payload, or null when none exists. Read-only — the
 *  generate-narrative route writes to disk in dev only today. */
export function loadPersonaNarrative<T = unknown>(personaId: string): T | null {
	if (dev) {
		const path = resolve(PERSONAS_DIR, `${personaId}.narrative.json`);
		if (!existsSync(path)) return null;
		try {
			return JSON.parse(readFileSync(path, 'utf8')) as T;
		} catch {
			return null;
		}
	}
	return (narrativeSeeds[personaId] as T) ?? null;
}
