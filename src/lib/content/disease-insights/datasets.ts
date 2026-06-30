/**
 * Disease-insights dataset payload loader.
 *
 * Eagerly globs every JSON file under each indication folder (except the
 * manifests themselves, which are loaded by `./index.ts`). Consumers resolve
 * a payload via `getDatasetPayload(slug, datasetPath)` where `datasetPath`
 * is the manifest entry's `path` (relative to the indication folder).
 *
 * Two clinical-trials artifacts are NOT bundled:
 *   - `raw_studies.json` — the multi-megabyte CT.gov envelope.
 *   - `studies_normalized.json` — the per-indication normalized file (up to
 *     ~11 MB for MS). Inlining these into the Vite module graph pinned dev's
 *     `fetchModule` RPC at minute-long timeouts.
 * Server callers that need either should use `readDatasetFromDisk(slug, path)`.
 */

import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const payloadModules = import.meta.glob<unknown>(
	[
		'./*/lexicon/*.json',
		'./*/search/*.json',
		'./*/communities/*.json',
		'./*/clinical_trials/*.json',
		'!./*/clinical_trials/raw_studies.json',
		'!./*/clinical_trials/studies_normalized.json'
	],
	{ eager: true, import: 'default' }
);

/** Map of `<slug>/<dataset-path>` → parsed JSON payload. */
const payloads = new Map<string, unknown>();
for (const [globPath, payload] of Object.entries(payloadModules)) {
	// './lupus-nephritis/search/treatment_searches_us.json' -> 'lupus-nephritis/search/treatment_searches_us.json'
	const key = globPath.replace(/^\.\//, '');
	payloads.set(key, payload);
}

export function getDatasetPayload(slug: string, datasetPath: string): unknown | undefined {
	return payloads.get(`${slug}/${datasetPath}`);
}

const CONTENT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)));

type CacheEntry = { mtimeMs: number; payload: unknown };
const diskCache = new Map<string, CacheEntry>();

/**
 * Read and parse a dataset JSON straight from disk. Use for artifacts excluded
 * from the eager bundle (e.g. `clinical_trials/studies_normalized.json`).
 * Server-side only.
 *
 * Results are cached per absolute path and invalidated by the file's mtime,
 * so re-running a normalize script picks up automatically without a server
 * restart.
 */
export async function readDatasetFromDisk(
	slug: string,
	datasetPath: string
): Promise<unknown | undefined> {
	const abs = resolve(CONTENT_ROOT, slug, datasetPath);
	let mtimeMs: number;
	try {
		mtimeMs = (await stat(abs)).mtimeMs;
	} catch {
		return undefined;
	}
	const hit = diskCache.get(abs);
	if (hit && hit.mtimeMs === mtimeMs) return hit.payload;
	try {
		const payload = JSON.parse(await readFile(abs, 'utf8'));
		diskCache.set(abs, { mtimeMs, payload });
		return payload;
	} catch {
		return undefined;
	}
}
