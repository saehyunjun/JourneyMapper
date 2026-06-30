/**
 * Corpus persistence shim — dev reads/writes the local source tree, prod
 * reads/writes Redis. Mirrors the wctglpdemo-side kv-store.ts so the upload
 * action + autotag pipeline can write fragments + annotations in staging.
 *
 * Seeds for a fresh prod boot come from `import.meta.glob` over the source
 * tree at module load — that way a new corpus added to git is visible to the
 * function without requiring a Redis migration step. KV writes shadow the
 * seed; reads prefer KV, then fall back to seed.
 *
 * Keys:
 *   corpus:<id>:manifest
 *   corpus:<id>:fragments:<content_source>
 *   corpus:<id>:annotations:<content_source>
 *   corpus:<id>:keyword_tags:<content_source>
 *
 * Whole-document upserts (JSON-encoded). Concurrent writes to the same
 * partition can lose data; layer optimistic concurrency on top later if it
 * becomes a concern (the upload action is the only concurrent writer today).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { dev } from '$app/environment';
import { createClient, type RedisClientType } from 'redis';
import { env } from '$env/dynamic/private';
import type {
	AnnotationFile,
	CorpusManifest,
	Fragment,
	FragmentAnnotation,
	JourneySchema,
	SpeakerAttrs
} from '$lib/content/corpora/types';
import type { JourneyMap } from '$lib/content/journeys/types';

const CORPORA_DIR = 'src/lib/content/corpora';
const JOURNEYS_DIR = 'src/lib/content/journeys';
const PARTICIPANT_PROFILES_PATH = 'src/lib/content/wctglpdemo-data/participant_profiles.json';

/** Per-corpus author-attribute overrides authored by analysts via the
 *  FragmentTagDrawer. Analyst values WIN over per-fragment values. */
export type AuthorAttrsFile = {
	meta?: { schema_version?: string; updated_at?: string };
	authors: Record<string, SpeakerAttrs>;
};

/** Full corpus bundle — manifest + flat fragment list across content_sources +
 *  merged annotations. Mirrors the historical shape returned by corpora.ts so
 *  callers can swap without restructuring. Author-attrs overrides are overlaid
 *  onto each fragment's speaker_attrs before return. */
export type CorpusBundle = {
	manifest: CorpusManifest;
	fragments: Fragment[];
	annotations: Record<string, FragmentAnnotation>;
};

export type { FragmentAnnotation };

// === Bundled seeds ==========================================================
// Lazy glob — these modules are split into their own chunks so a prod cold
// start only parses what the first request actually touches. New corpus = new
// folder in git; rebuild ships it as a seed. Each seed is memoized after first
// load so repeat reads within the same warm instance are zero-cost.
//
// Why lazy: eager globs forced every corpus's fragments + annotations to be
// parsed at module-init for any route that imported corpus-store — a 308 KB
// chunk on the critical path of the patientlyiq layout loader. Lazy keeps the
// keys (path → loader) available for listing/discovery without parsing the
// payloads.

type SeedLoader<T> = () => Promise<T>;

function memoizeLoader<T>(loader: SeedLoader<T>): SeedLoader<T> {
	let cached: Promise<T> | null = null;
	return () => (cached ??= loader());
}

/** Build a key→memoized-loader map from a Vite lazy-glob result. The key is
 *  derived from the file path; loaders are memoized so the same seed is parsed
 *  at most once per warm instance. */
function buildSeedLoaders<T>(
	glob: Record<string, SeedLoader<T>>,
	keyFromPath: (path: string) => string | null
): Map<string, SeedLoader<T>> {
	const out = new Map<string, SeedLoader<T>>();
	for (const [path, loader] of Object.entries(glob)) {
		const key = keyFromPath(path);
		if (key) out.set(key, memoizeLoader(loader));
	}
	return out;
}

const manifestSeedLoaders = buildSeedLoaders<CorpusManifest>(
	import.meta.glob<CorpusManifest>('/src/lib/content/corpora/*/manifest.json', {
		import: 'default'
	}),
	(p) => p.match(/corpora\/([^/]+)\/manifest\.json$/)?.[1] ?? null
);

const fragmentSeedLoaders = buildSeedLoaders<{
	meta: Record<string, unknown>;
	fragments: Fragment[];
}>(
	import.meta.glob<{ meta: Record<string, unknown>; fragments: Fragment[] }>(
		'/src/lib/content/corpora/*/fragments/*.json',
		{ import: 'default' }
	),
	(p) => {
		const m = p.match(/corpora\/([^/]+)\/fragments\/([^/]+)\.json$/);
		return m ? `${m[1]}:${m[2]}` : null;
	}
);

const annotationSeedLoaders = buildSeedLoaders<AnnotationFile>(
	import.meta.glob<AnnotationFile>('/src/lib/content/corpora/*/annotations/*.json', {
		import: 'default'
	}),
	(p) => {
		const m = p.match(/corpora\/([^/]+)\/annotations\/([^/]+)\.json$/);
		return m ? `${m[1]}:${m[2]}` : null;
	}
);

const journeySchemaSeedLoaders = buildSeedLoaders<JourneySchema>(
	import.meta.glob<JourneySchema>('/src/lib/content/journeys/*.json', { import: 'default' }),
	(p) => p.match(/journeys\/([^/]+)\.json$/)?.[1] ?? null
);

const ingestConfigSeedLoaders = buildSeedLoaders<unknown>(
	import.meta.glob<unknown>('/src/lib/content/corpora/*/ingest.config.json', {
		import: 'default'
	}),
	(p) => p.match(/corpora\/([^/]+)\/ingest\.config\.json$/)?.[1] ?? null
);

const authorAttrsSeedLoaders = buildSeedLoaders<AuthorAttrsFile>(
	import.meta.glob<AuthorAttrsFile>('/src/lib/content/corpora/*/author_attrs.json', {
		import: 'default'
	}),
	(p) => p.match(/corpora\/([^/]+)\/author_attrs\.json$/)?.[1] ?? null
);

/** All per-corpus artifacts under corpora/<id>/artifacts/<name>.json. Read-only
 *  in prod; analysts regenerate via scripts and commit. Keyed by
 *  `<corpusId>:<artifactName>`. */
const artifactSeedLoaders = buildSeedLoaders<unknown>(
	import.meta.glob<unknown>('/src/lib/content/corpora/*/artifacts/*.json', {
		import: 'default'
	}),
	(p) => {
		const m = p.match(/corpora\/([^/]+)\/artifacts\/([^/]+)\.json$/);
		return m ? `${m[1]}:${m[2]}` : null;
	}
);

/** Journey maps keyed by `meta.indication`. Only realized when listJourneys()
 *  is actually called, since the indication key has to be read out of each
 *  file's body. Memoized after first build. */
const journeyMapSeedFiles = import.meta.glob<JourneyMap>('/src/lib/content/journeys/*.json', {
	import: 'default'
});
let journeyMapsByIndication: Promise<Record<string, JourneyMap>> | null = null;
function getJourneyMapsByIndication(): Promise<Record<string, JourneyMap>> {
	return (journeyMapsByIndication ??= (async () => {
		const out: Record<string, JourneyMap> = {};
		for (const loader of Object.values(journeyMapSeedFiles)) {
			const doc = await loader();
			if (doc?.meta?.indication) out[doc.meta.indication] = doc;
		}
		return out;
	})());
}

/** Participant profiles — only the wct_glp1_2025q4 corpus has them today. The
 *  file lives under wctglpdemo-data/, not under corpora/, so it's seeded
 *  separately. Lazy + memoized; only realized when loadProfilesForCorpus is
 *  called for the wct corpus. */
const participantProfilesFiles = import.meta.glob<{ profiles?: Record<string, unknown> }>(
	'/src/lib/content/wctglpdemo-data/participant_profiles.json',
	{ import: 'default' }
);
let participantProfilesPromise: Promise<Record<string, unknown>> | null = null;
function getParticipantProfilesSeed(): Promise<Record<string, unknown>> {
	return (participantProfilesPromise ??= (async () => {
		for (const loader of Object.values(participantProfilesFiles)) {
			const doc = await loader();
			return doc.profiles ?? {};
		}
		return {};
	})());
}

async function loadSeed<T>(
	loaders: Map<string, SeedLoader<T>>,
	key: string
): Promise<T | null> {
	const loader = loaders.get(key);
	return loader ? await loader() : null;
}

// === Redis client (lazy, reused per warm instance) ==========================

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

async function redis(): Promise<RedisClientType | null> {
	const url = env.REDIS_URL;
	if (!url) return null;
	if (client?.isOpen) return client;
	if (connecting) return connecting;

	const c = createClient({ url }) as RedisClientType;
	c.on('error', (err) => console.error('[corpus-store:redis] client error:', err));
	connecting = c
		.connect()
		.then(() => {
			client = c;
			return c;
		})
		.catch((err) => {
			connecting = null;
			console.error('[corpus-store:redis] connect failed:', err);
			throw err;
		});
	return connecting;
}

const mKey = (id: string) => `corpus:${id}:manifest`;
const fKey = (id: string, src: string) => `corpus:${id}:fragments:${src}`;
const aKey = (id: string, src: string) => `corpus:${id}:annotations:${src}`;
const kKey = (id: string, src: string) => `corpus:${id}:keyword_tags:${src}`;

// === Generic read/write =====================================================

async function kvGet<T>(key: string): Promise<T | null> {
	let r: RedisClientType | null;
	try {
		r = await redis();
	} catch {
		return null;
	}
	if (!r) return null;
	try {
		const raw = await r.get(key);
		return raw == null ? null : (JSON.parse(raw) as T);
	} catch (e) {
		console.error(`[corpus-store] Redis read failed for "${key}":`, e);
		return null;
	}
}

async function kvSet<T>(key: string, doc: T): Promise<void> {
	const r = await redis();
	if (!r) {
		throw new Error('Redis is not configured — set REDIS_URL.');
	}
	await r.set(key, JSON.stringify(doc));
}

// === Public API =============================================================

/** All known corpus ids — disk in dev, KV index + bundled seeds in prod. */
export async function listCorpusIds(): Promise<string[]> {
	if (dev) {
		const root = resolve(CORPORA_DIR);
		if (!existsSync(root)) return [];
		return readdirSync(root)
			.filter((entry) => existsSync(resolve(root, entry, 'manifest.json')))
			.sort();
	}
	// Prod: union of seeded corpora and any KV-written manifests under an
	// index key. We maintain the index lazily — addToCorpus updates it on
	// each write. Seeds alone are enough for the read-only browse case.
	const fromSeeds = [...manifestSeedLoaders.keys()];
	const fromIndex = await kvGet<string[]>('corpus:index');
	const merged = new Set([...fromSeeds, ...(fromIndex ?? [])]);
	return [...merged].sort();
}

/** One corpus manifest. Prefers KV in prod; falls back to bundled seed. */
export async function loadCorpusManifest(corpusId: string): Promise<CorpusManifest | null> {
	if (dev) {
		const path = resolve(CORPORA_DIR, corpusId, 'manifest.json');
		if (!existsSync(path)) return null;
		try {
			return JSON.parse(readFileSync(path, 'utf8')) as CorpusManifest;
		} catch {
			return null;
		}
	}
	const fromKv = await kvGet<CorpusManifest>(mKey(corpusId));
	if (fromKv) return fromKv;
	return await loadSeed(manifestSeedLoaders, corpusId);
}

export async function saveCorpusManifest(corpusId: string, manifest: CorpusManifest): Promise<void> {
	if (dev) {
		const path = resolve(CORPORA_DIR, corpusId, 'manifest.json');
		mkdirSync(resolve(CORPORA_DIR, corpusId), { recursive: true });
		writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
		return;
	}
	await kvSet(mKey(corpusId), manifest);
	// Keep the index current so listCorpusIds sees freshly-created corpora.
	try {
		const idx = (await kvGet<string[]>('corpus:index')) ?? [];
		if (!idx.includes(corpusId)) {
			idx.push(corpusId);
			await kvSet('corpus:index', idx);
		}
	} catch (e) {
		console.error('[corpus-store] failed to update corpus:index:', e);
	}
}

type FragmentsFile = { meta: Record<string, unknown>; fragments: Fragment[] };

export async function loadCorpusFragments(
	corpusId: string,
	contentSource: string
): Promise<FragmentsFile | null> {
	if (dev) {
		const path = resolve(CORPORA_DIR, corpusId, 'fragments', `${contentSource}.json`);
		if (!existsSync(path)) return null;
		try {
			return JSON.parse(readFileSync(path, 'utf8')) as FragmentsFile;
		} catch {
			return null;
		}
	}
	const fromKv = await kvGet<FragmentsFile>(fKey(corpusId, contentSource));
	if (fromKv) return fromKv;
	return await loadSeed(fragmentSeedLoaders, `${corpusId}:${contentSource}`);
}

export async function saveCorpusFragments(
	corpusId: string,
	contentSource: string,
	doc: FragmentsFile
): Promise<void> {
	if (dev) {
		const dir = resolve(CORPORA_DIR, corpusId, 'fragments');
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			resolve(dir, `${contentSource}.json`),
			JSON.stringify(doc, null, 2) + '\n',
			'utf8'
		);
		return;
	}
	await kvSet(fKey(corpusId, contentSource), doc);
}

export async function loadCorpusAnnotations(
	corpusId: string,
	contentSource: string
): Promise<AnnotationFile | null> {
	if (dev) {
		const path = resolve(CORPORA_DIR, corpusId, 'annotations', `${contentSource}.json`);
		if (!existsSync(path)) return null;
		try {
			return JSON.parse(readFileSync(path, 'utf8')) as AnnotationFile;
		} catch {
			return null;
		}
	}
	const fromKv = await kvGet<AnnotationFile>(aKey(corpusId, contentSource));
	if (fromKv) return fromKv;
	return await loadSeed(annotationSeedLoaders, `${corpusId}:${contentSource}`);
}

export async function saveCorpusAnnotations(
	corpusId: string,
	contentSource: string,
	doc: AnnotationFile
): Promise<void> {
	if (dev) {
		const dir = resolve(CORPORA_DIR, corpusId, 'annotations');
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			resolve(dir, `${contentSource}.json`),
			JSON.stringify(doc, null, 2) + '\n',
			'utf8'
		);
		return;
	}
	await kvSet(aKey(corpusId, contentSource), doc);
}

/** Per-indication journey schema. Read-only; bundled at build time. */
export async function loadJourneySchema(indication: string): Promise<JourneySchema | null> {
	if (dev) {
		const path = resolve(JOURNEYS_DIR, `${indication}.json`);
		if (!existsSync(path)) return null;
		try {
			return JSON.parse(readFileSync(path, 'utf8')) as JourneySchema;
		} catch {
			return null;
		}
	}
	return await loadSeed(journeySchemaSeedLoaders, indication);
}

/** Convenience: a corpus's full manifest + partition data. Used by the upload
 *  page's load() and by readCorpus in the action. Returns null if the
 *  manifest is unreadable. */
export async function loadFullCorpus(corpusId: string): Promise<{
	manifest: CorpusManifest;
	fragments: Fragment[];
	annotations: Record<string, import('$lib/content/corpora/types').FragmentAnnotation>;
} | null> {
	const manifest = await loadCorpusManifest(corpusId);
	if (!manifest) return null;
	const fragments: Fragment[] = [];
	const annotations: Record<string, import('$lib/content/corpora/types').FragmentAnnotation> = {};
	for (const partition of manifest.partitions) {
		const fdoc = await loadCorpusFragments(corpusId, partition.content_source);
		if (fdoc) fragments.push(...(fdoc.fragments ?? []));
		const adoc = await loadCorpusAnnotations(corpusId, partition.content_source);
		if (adoc) {
			for (const [id, ann] of Object.entries(adoc.annotations ?? {})) {
				annotations[id] = ann;
			}
		}
	}
	return { manifest, fragments, annotations };
}

/** The per-corpus forum ingest config — bundled at build time so prod can
 *  read it without a disk lookup. Read-only; the analyst edits it in git, not
 *  the UI. */
export async function loadCorpusIngestConfig<T = unknown>(
	corpusId: string
): Promise<T | null> {
	if (dev) {
		const path = resolve(CORPORA_DIR, corpusId, 'ingest.config.json');
		if (!existsSync(path)) return null;
		try {
			return JSON.parse(readFileSync(path, 'utf8')) as T;
		} catch {
			return null;
		}
	}
	return ((await loadSeed(ingestConfigSeedLoaders, corpusId)) as T) ?? null;
}

/** Per-partition keyword tags. The upload page uses these to highlight
 *  spans; addToCorpus doesn't write them, but the load() does read them. */
export async function loadCorpusKeywordTags(
	corpusId: string,
	contentSource: string
): Promise<unknown | null> {
	if (dev) {
		const path = resolve(CORPORA_DIR, corpusId, 'keyword_tags', `${contentSource}.json`);
		if (!existsSync(path)) return null;
		try {
			return JSON.parse(readFileSync(path, 'utf8'));
		} catch {
			return null;
		}
	}
	return kvGet<unknown>(kKey(corpusId, contentSource));
}

const aaKey = (id: string) => `corpus:${id}:author_attrs`;

/** Per-corpus author-attribute overrides. KV-shadowed in prod; falls back to
 *  the bundled seed when no overrides have been written. */
export async function loadAuthorAttrs(corpusId: string): Promise<AuthorAttrsFile> {
	if (dev) {
		const path = resolve(CORPORA_DIR, corpusId, 'author_attrs.json');
		if (!existsSync(path)) return { meta: {}, authors: {} };
		try {
			const doc = JSON.parse(readFileSync(path, 'utf8')) as AuthorAttrsFile;
			return { meta: doc.meta ?? {}, authors: doc.authors ?? {} };
		} catch {
			return { meta: {}, authors: {} };
		}
	}
	const fromKv = await kvGet<AuthorAttrsFile>(aaKey(corpusId));
	if (fromKv) return { meta: fromKv.meta ?? {}, authors: fromKv.authors ?? {} };
	const seed = await loadSeed(authorAttrsSeedLoaders, corpusId);
	return seed ? { meta: seed.meta ?? {}, authors: seed.authors ?? {} } : { meta: {}, authors: {} };
}

export async function saveAuthorAttrs(corpusId: string, doc: AuthorAttrsFile): Promise<void> {
	if (dev) {
		const dir = resolve(CORPORA_DIR, corpusId);
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			resolve(dir, 'author_attrs.json'),
			JSON.stringify(doc, null, 2) + '\n',
			'utf8'
		);
		return;
	}
	await kvSet(aaKey(corpusId), doc);
}

/** Read one named artifact under corpora/<id>/artifacts/<name>.json. Artifacts
 *  are generated by offline scripts and committed; in prod they come from the
 *  bundled seed (no Redis hop) since the UI doesn't write them. */
export async function loadCorpusArtifact<T = unknown>(
	corpusId: string,
	artifactName: string
): Promise<T | null> {
	if (dev) {
		const path = resolve(CORPORA_DIR, corpusId, 'artifacts', `${artifactName}.json`);
		if (!existsSync(path)) return null;
		try {
			return JSON.parse(readFileSync(path, 'utf8')) as T;
		} catch {
			return null;
		}
	}
	return ((await loadSeed(artifactSeedLoaders, `${corpusId}:${artifactName}`)) as T) ?? null;
}

/** List all artifact names (without `.json`) for a corpus. Used by the
 *  journey-map landing redirect to discover which (corpus, persona) pairs have
 *  a generated journey-map. */
export async function listCorpusArtifacts(corpusId: string): Promise<string[]> {
	if (dev) {
		const dir = resolve(CORPORA_DIR, corpusId, 'artifacts');
		if (!existsSync(dir)) return [];
		return readdirSync(dir)
			.filter((f) => f.endsWith('.json'))
			.map((f) => f.replace(/\.json$/, ''))
			.sort();
	}
	const prefix = `${corpusId}:`;
	return [...artifactSeedLoaders.keys()]
		.filter((k) => k.startsWith(prefix))
		.map((k) => k.slice(prefix.length))
		.sort();
}

/** All journey maps keyed by `meta.indication`. Read-only — analysts edit
 *  these in git. */
export async function listJourneys(): Promise<Record<string, JourneyMap>> {
	if (dev) {
		const out: Record<string, JourneyMap> = {};
		if (!existsSync(JOURNEYS_DIR)) return out;
		for (const f of readdirSync(JOURNEYS_DIR)) {
			if (!f.endsWith('.json')) continue;
			try {
				const doc = JSON.parse(readFileSync(resolve(JOURNEYS_DIR, f), 'utf8')) as JourneyMap;
				if (doc?.meta?.indication) out[doc.meta.indication] = doc;
			} catch {
				// skip unreadable files
			}
		}
		return out;
	}
	return await getJourneyMapsByIndication();
}

/** Best-effort participant profile loader. Today only the wct_glp1_2025q4
 *  corpus has profiles; new corpora author their own sidecars once the
 *  convention generalizes. */
export async function loadProfilesForCorpus(
	corpusId: string
): Promise<Record<string, unknown>> {
	if (corpusId !== 'wct_glp1_2025q4') return {};
	if (dev) {
		const p = resolve(PARTICIPANT_PROFILES_PATH);
		if (!existsSync(p)) return {};
		try {
			const doc = JSON.parse(readFileSync(p, 'utf8')) as {
				profiles?: Record<string, unknown>;
			};
			return doc.profiles ?? {};
		} catch {
			return {};
		}
	}
	return await getParticipantProfilesSeed();
}

/** A single corpus, manifest + flat fragment list across content_sources +
 *  merged annotations, with author-attrs overrides overlaid onto each
 *  fragment's speaker_attrs. Mirrors corpora.ts#listCorpora's per-corpus shape
 *  so callers can swap without restructuring. */
export async function loadCorpusBundle(corpusId: string): Promise<CorpusBundle | null> {
	const base = await loadFullCorpus(corpusId);
	if (!base) return null;
	const attrs = await loadAuthorAttrs(corpusId);
	const overrides = attrs.authors ?? {};
	if (Object.keys(overrides).length === 0) {
		return { manifest: base.manifest, fragments: base.fragments, annotations: base.annotations };
	}
	const fragments = base.fragments.map((f) => {
		const h = (f.source_ref as { author_handle_hash?: string }).author_handle_hash;
		if (!h) return f;
		const override = overrides[h];
		if (!override) return f;
		return { ...f, speaker_attrs: { ...(f.speaker_attrs ?? {}), ...override } };
	});
	return { manifest: base.manifest, fragments, annotations: base.annotations };
}

/** All corpora as bundles, sorted by id. Drop-in replacement for the legacy
 *  corpora.ts#listCorpora — async now because the prod path reads Redis. */
export async function listCorpusBundles(): Promise<CorpusBundle[]> {
	const ids = await listCorpusIds();
	const out: CorpusBundle[] = [];
	for (const id of ids) {
		const bundle = await loadCorpusBundle(id);
		if (bundle) out.push(bundle);
	}
	out.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
	return out;
}
