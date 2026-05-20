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

/** Read one document. Falls back to the seed if the store is empty/unavailable. */
export async function loadDoc<T>(key: string, localPath: string, seed: T): Promise<T> {
	if (dev) {
		const path = resolve(localPath);
		if (!existsSync(path)) return seed;
		try {
			return JSON.parse(readFileSync(path, 'utf8')) as T;
		} catch {
			return seed;
		}
	}
	let r: RedisClientType | null;
	try {
		r = await redis();
	} catch {
		return seed;
	}
	if (!r) {
		console.warn(
			`[kv-store] REDIS_URL not set. Falling back to bundled seed for key "${key}".`
		);
		return seed;
	}
	try {
		const raw = await r.get(key);
		if (raw == null) return seed;
		return JSON.parse(raw) as T;
	} catch (e) {
		// Surface the failure in logs but still serve the page from the seed —
		// better degraded reads than a 500 on every request.
		console.error(`[kv-store] Redis read failed for "${key}":`, e);
		return seed;
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
