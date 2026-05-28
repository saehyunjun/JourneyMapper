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
	JourneySchema
} from '$lib/content/corpora/types';

const CORPORA_DIR = 'src/lib/content/corpora';
const JOURNEYS_DIR = 'src/lib/content/journeys';

// === Bundled seeds ==========================================================
// Eager glob — these modules are inlined into the bundle so prod functions
// have a usable starting state even when Redis is empty. New corpus = new
// folder in git; rebuild ships it as a seed.

type ManifestSeedMap = Record<string, CorpusManifest>;
type FragmentsSeedMap = Record<string, { meta: Record<string, unknown>; fragments: Fragment[] }>;
type AnnotationsSeedMap = Record<string, AnnotationFile>;
type JourneySeedMap = Record<string, JourneySchema>;

const manifestSeeds: ManifestSeedMap = (() => {
	const mods = import.meta.glob<CorpusManifest>('/src/lib/content/corpora/*/manifest.json', {
		eager: true,
		import: 'default'
	});
	const out: ManifestSeedMap = {};
	for (const [path, m] of Object.entries(mods)) {
		const corpusId = path.match(/corpora\/([^/]+)\/manifest\.json$/)?.[1];
		if (corpusId) out[corpusId] = m;
	}
	return out;
})();

const fragmentSeeds: FragmentsSeedMap = (() => {
	const mods = import.meta.glob<{ meta: Record<string, unknown>; fragments: Fragment[] }>(
		'/src/lib/content/corpora/*/fragments/*.json',
		{ eager: true, import: 'default' }
	);
	const out: FragmentsSeedMap = {};
	for (const [path, doc] of Object.entries(mods)) {
		const m = path.match(/corpora\/([^/]+)\/fragments\/([^/]+)\.json$/);
		if (m) out[`${m[1]}:${m[2]}`] = doc;
	}
	return out;
})();

const annotationSeeds: AnnotationsSeedMap = (() => {
	const mods = import.meta.glob<AnnotationFile>(
		'/src/lib/content/corpora/*/annotations/*.json',
		{ eager: true, import: 'default' }
	);
	const out: AnnotationsSeedMap = {};
	for (const [path, doc] of Object.entries(mods)) {
		const m = path.match(/corpora\/([^/]+)\/annotations\/([^/]+)\.json$/);
		if (m) out[`${m[1]}:${m[2]}`] = doc;
	}
	return out;
})();

const journeySeeds: JourneySeedMap = (() => {
	const mods = import.meta.glob<JourneySchema>('/src/lib/content/journeys/*.json', {
		eager: true,
		import: 'default'
	});
	const out: JourneySeedMap = {};
	for (const [path, doc] of Object.entries(mods)) {
		const indication = path.match(/journeys\/([^/]+)\.json$/)?.[1];
		if (indication) out[indication] = doc;
	}
	return out;
})();

type IngestConfigSeedMap = Record<string, unknown>;
const ingestConfigSeeds: IngestConfigSeedMap = (() => {
	const mods = import.meta.glob<unknown>(
		'/src/lib/content/corpora/*/ingest.config.json',
		{ eager: true, import: 'default' }
	);
	const out: IngestConfigSeedMap = {};
	for (const [path, doc] of Object.entries(mods)) {
		const id = path.match(/corpora\/([^/]+)\/ingest\.config\.json$/)?.[1];
		if (id) out[id] = doc;
	}
	return out;
})();

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
	const fromSeeds = Object.keys(manifestSeeds);
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
	return manifestSeeds[corpusId] ?? null;
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
	return fragmentSeeds[`${corpusId}:${contentSource}`] ?? null;
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
	return annotationSeeds[`${corpusId}:${contentSource}`] ?? null;
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
	return journeySeeds[indication] ?? null;
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
	return (ingestConfigSeeds[corpusId] as T) ?? null;
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
