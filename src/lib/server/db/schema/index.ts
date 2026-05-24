/**
 * Drizzle schema barrel.
 *
 * Re-exports every table so drizzle-kit can introspect the full schema from
 * a single entry point. Runtime code can also import from here:
 *
 *   import { db } from '$lib/server/db/client';
 *   import { drugs, indications } from '$lib/server/db/schema';
 *
 * Adding a new schema file? Re-export it here.
 */

export * from './indications';
export * from './burdens';
export * from './drugs';
export * from './content_sources';
export * from './content_items';
export * from './segments';
