/**
 * Disease-insights dataset payload loader.
 *
 * Eagerly globs every JSON file under each indication folder (except the
 * manifests themselves, which are loaded by `./index.ts`). Consumers resolve
 * a payload via `getDatasetPayload(slug, datasetPath)` where `datasetPath`
 * is the manifest entry's `path` (relative to the indication folder).
 *
 * `clinical_trials/raw_studies.json` is intentionally NOT bundled — those
 * envelopes can be multi-megabyte and aren't useful to ship to the client.
 * Callers that need raw studies should read them server-side from disk.
 */

const payloadModules = import.meta.glob<unknown>(
	[
		'./*/lexicon/*.json',
		'./*/search/*.json',
		'./*/communities/*.json',
		'./*/clinical_trials/*.json',
		'!./*/clinical_trials/raw_studies.json'
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
