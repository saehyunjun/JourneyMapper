/**
 * Drizzle / libSQL client — singleton.
 *
 * Dev: connects to a local SQLite file at ./data/dev.db (gitignored). Foreign
 *      keys are enforced via PRAGMA foreign_keys = ON on each connection.
 *
 * Prod: connects to Turso (libsql://...) when DATABASE_URL points to a remote
 *       database. DATABASE_AUTH_TOKEN is required for remote URLs.
 *
 * Phase 2 status: this client is wired up but no application code reads from
 * it yet. The JSON-bundled registries + lexicon remain the live source of
 * truth. Incremental migration of entities into the DB happens in later
 * phases (Phase 4 / Phase 5).
 */
import { drizzle } from 'drizzle-orm/libsql';
import { createClient, type Client as LibsqlClient } from '@libsql/client';
import * as schema from './schema';

const DEFAULT_URL = 'file:./data/dev.db';

let _client: LibsqlClient | null = null;

/** Lazy-init the libSQL client. Reused across requests in serverless. */
function getClient(): LibsqlClient {
	if (_client) return _client;
	const url = process.env.DATABASE_URL ?? DEFAULT_URL;
	const authToken = process.env.DATABASE_AUTH_TOKEN;
	_client = createClient({ url, ...(authToken ? { authToken } : {}) });
	return _client;
}

/** The Drizzle instance — use this for queries. Tables are typed against
 *  ./schema/index. Import as `import { db } from '$lib/server/db/client'`. */
export const db = drizzle(getClient(), { schema });

export { schema };
