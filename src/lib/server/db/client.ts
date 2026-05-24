/**
 * Drizzle / libSQL client — lazy singleton.
 *
 * Dev: connects to a local SQLite file at ./data/dev.db (gitignored).
 *
 * Prod: connects to Turso (libsql://...) when DATABASE_URL points to a remote
 *       database. DATABASE_AUTH_TOKEN is required for remote URLs.
 *
 * IMPORTANT: this module DOES NOT open a connection at import time. The
 * createClient() + drizzle() calls are deferred to `getDb()`, which memoizes
 * on first call. This keeps imports cheap and tolerates build-time
 * environments (Vercel during `vite build` / SvelteKit analyse) where no
 * SQLite file exists and DATABASE_URL isn't set — query helpers catch the
 * thrown connection error and fall back to the bundled JSON registries.
 *
 * Phase 2 status: queries use this client behind a JSON-fallback wrapper;
 * the bundled JSON registries remain the live source of truth until a
 * Turso instance is provisioned and DATABASE_URL/AUTH_TOKEN are set.
 */
import { drizzle } from 'drizzle-orm/libsql';
import { createClient, type Client as LibsqlClient } from '@libsql/client';
import * as schema from './schema';

const DEFAULT_URL = 'file:./data/dev.db';

let _client: LibsqlClient | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getClient(): LibsqlClient {
	if (_client) return _client;
	const url = process.env.DATABASE_URL ?? DEFAULT_URL;
	const authToken = process.env.DATABASE_AUTH_TOKEN;
	_client = createClient({ url, ...(authToken ? { authToken } : {}) });
	return _client;
}

/** Lazily open the Drizzle instance. Memoized across calls. Throws if the
 *  underlying libSQL client can't open (e.g. no DATABASE_URL set on a host
 *  with no local SQLite file). Callers should catch and fall back. */
export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
	if (_db) return _db;
	_db = drizzle(getClient(), { schema });
	return _db;
}

export { schema };
