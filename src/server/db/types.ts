import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from './schema';

/**
 * The admin/observability API is written against this driver-agnostic type and
 * never imports a concrete database driver directly.
 * That keeps those modules safe to bundle for either runtime:
 *  - Node / local dev  -> db/node.ts constructs a LibSQLDatabase (SQLite file)
 *  - Cloudflare Worker  -> db/d1.ts constructs a DrizzleD1Database (env.DB binding)
 *
 * Both `LibSQLDatabase<TSchema>` and `DrizzleD1Database<TSchema>` extend
 * `BaseSQLiteDatabase<'async', TResult, TSchema>` (they only differ in the driver
 * result-row type) — using that shared base here (with the result type erased to
 * `any`) is what lets query builder calls like `.select()` and `.query.x.findMany()`
 * type-check correctly. A plain union of the two concrete types instead confuses
 * TypeScript's overload resolution for those generic, overloaded methods.
 *
 * Only server.ts (Node entrypoint) and worker.ts (Cloudflare entrypoint) are
 * allowed to import the concrete db/node.ts or db/d1.ts modules — everything
 * else receives an already-constructed `AppDb` via Hono's context variables.
 */
export type AppDb = BaseSQLiteDatabase<'async', any, typeof schema>;
