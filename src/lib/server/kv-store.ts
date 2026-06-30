/**
 * Persistence shim — dev reads/writes the local source file, prod reads/writes
 * Redis (via the Vercel Marketplace Redis integration, which sets REDIS_URL).
 *
 * The bundled JSON imported at module load time is the seed used when:
 *  - dev: the local file is missing or unparseable
 *  - prod: the Redis key has not been written yet, or the store is unreachable
 *
 * Each writable JSON doc maps to a single Redis key (whole-document upsert,
 * JSON-encoded). Fine for the demo's edit cadence; layer optimistic
 * concurrency on top later if concurrent edits become a concern.
 *
 * The Redis client is created lazily at module scope and reused across
 * invocations within the same warm function instance.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dev } from '$app/environment';
import { createClient, type RedisClientType } from 'redis';
import { env } from '$env/dynamic/private';

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

async function redis(): Promise<RedisClientType | null> {
	const url = env.REDIS_URL;
	if (!url) return null;
	if (client?.isOpen) return client;
	if (connecting) return connecting;

	const c = createClient({ url }) as RedisClientType;
	c.on('error', (err) => {
		console.error('[redis] client error:', err);
	});
	connecting = c
		.connect()
		.then(() => {
			client = c;
			return c;
		})
		.catch((err) => {
			connecting = null;
			console.error('[redis] connect failed:', err);
			throw err;
		});
	return connecting;
}

/** Seed accepted by loadDoc. Either an already-loaded value (cheap to keep in
 *  memory) or a thunk that only runs when the fallback path actually fires —
 *  the right shape for heavy bundled JSONs that we'd rather not pay for in dev
 *  (where the local file path is always taken) or in warm prod instances
 *  (where Redis serves every read after the first). */
export type SeedSource<T> = T | (() => T | Promise<T>);

async function resolveSeed<T>(seed: SeedSource<T>): Promise<T> {
	return typeof seed === 'function' ? await (seed as () => T | Promise<T>)() : seed;
}

/** Wrap a dynamic JSON `import()` in a memoized thunk for use as a `loadDoc`
 *  seed. The loader runs at most once per warm instance, only on the fallback
 *  path. Usage:
 *    const seedLexicon = lazySeed(() =>
 *      import('$lib/content/.../keyword_lexicon.json')
 *        .then((m) => m.default as unknown as LexiconFile)
 *    );
 *    loadDoc(KEY, PATH, seedLexicon);
 */
export function lazySeed<T>(loader: () => Promise<T>): () => Promise<T> {
	let cached: Promise<T> | null = null;
	return () => (cached ??= loader());
}

/** Read one document. Falls back to the seed if the store is empty/unavailable.
 *  Pass a thunk for `seed` when the underlying value is a heavy JSON import you
 *  want to defer (and not bundle into hot chunks). */
export async function loadDoc<T>(
	key: string,
	localPath: string,
	seed: SeedSource<T>
): Promise<T> {
	if (dev) {
		const path = resolve(localPath);
		if (!existsSync(path)) return resolveSeed(seed);
		try {
			return JSON.parse(readFileSync(path, 'utf8')) as T;
		} catch {
			return resolveSeed(seed);
		}
	}
	let r: RedisClientType | null;
	try {
		r = await redis();
	} catch {
		return resolveSeed(seed);
	}
	if (!r) {
		console.warn(
			`[kv-store] REDIS_URL not set. Falling back to bundled seed for key "${key}".`
		);
		return resolveSeed(seed);
	}
	try {
		const raw = await r.get(key);
		if (raw == null) return resolveSeed(seed);
		return JSON.parse(raw) as T;
	} catch (e) {
		// Surface the failure in logs but still serve the page from the seed —
		// better degraded reads than a 500 on every request.
		console.error(`[kv-store] Redis read failed for "${key}":`, e);
		return resolveSeed(seed);
	}
}

/** Persist one document. In dev writes to disk; in prod writes to Redis. */
export async function saveDoc<T>(key: string, localPath: string, doc: T): Promise<void> {
	if (dev) {
		writeFileSync(resolve(localPath), JSON.stringify(doc, null, 2) + '\n', 'utf8');
		return;
	}
	const r = await redis();
	if (!r) {
		throw new Error('Redis is not configured — set REDIS_URL.');
	}
	await r.set(key, JSON.stringify(doc));
}
