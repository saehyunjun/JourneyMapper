/**
 * Drizzle configuration.
 *
 * Schemas live under src/lib/server/db/schema/*.ts; the index re-exports
 * every table so drizzle-kit can introspect them. Migrations are emitted to
 * ./drizzle/ — commit them along with schema changes.
 *
 * Dev: a local libSQL/SQLite file at ./data/dev.db (gitignored).
 * Prod: switch DATABASE_URL to a Turso libsql:// URL and set DATABASE_AUTH_TOKEN.
 *
 * This config is intentionally minimal — it powers `drizzle-kit` only. The
 * runtime client lives in src/lib/server/db/client.ts.
 */
import type { Config } from 'drizzle-kit';

export default {
	schema: './src/lib/server/db/schema/index.ts',
	out: './drizzle',
	dialect: 'turso',
	dbCredentials: {
		url: process.env.DATABASE_URL ?? 'file:./data/dev.db',
		authToken: process.env.DATABASE_AUTH_TOKEN
	},
	verbose: true,
	strict: true
} satisfies Config;
