/**
 * Persistence shim — dev reads/writes the local source file, prod reads/writes
 * an Upstash Redis instance (via Vercel's Marketplace Redis integration).
 *
 * The bundled JSON imported at module load time is the seed used when:
 *  - dev: the local file is missing or unparseable
 *  - prod: the KV key has not been written yet
 *
 * Each writable JSON doc maps to a single KV key (whole-document upsert). This
 * is fine for the demo's edit cadence; if concurrent edits become a concern we
 * can layer optimistic concurrency on top later.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dev } from '$app/environment';
import { Redis } from '@upstash/redis';
import { env } from '$env/dynamic/private';

// In Vercel's Marketplace Redis integration the env vars are still named
// KV_REST_API_*; if the project uses the older Upstash naming we accept that
// too. Both fall through to a no-credentials client that falls back to seeds.
let client: Redis | null = null;
function kv(): Redis | null {
	if (client) return client;
	const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
	const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token) return null;
	client = new Redis({ url, token });
	return client;
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
	const r = kv();
	if (!r) return seed;
	const value = await r.get<T>(key);
	return value ?? seed;
}

/** Persist one document. In dev writes to disk; in prod writes to KV. */
export async function saveDoc<T>(key: string, localPath: string, doc: T): Promise<void> {
	if (dev) {
		writeFileSync(resolve(localPath), JSON.stringify(doc, null, 2) + '\n', 'utf8');
		return;
	}
	const r = kv();
	if (!r) {
		throw new Error(
			'KV credentials are not configured — set KV_REST_API_URL and KV_REST_API_TOKEN.'
		);
	}
	await r.set(key, doc);
}
