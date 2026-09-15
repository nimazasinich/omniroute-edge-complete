# CP04-FAILOVER-VERIFIED

## What changed
- `src/server/db/node.ts`
  - `PRAGMA foreign_keys = ON` now runs on every connection (was never set — FK
    constraints were silently unenforced locally before this).
  - Table-creation SQL extracted into `runMigrations(execClient, opts)`, shared by:
    - `initializeDb()` — real Node process, seeds the admin key.
    - `createTestDb()` — new, isolated `:memory:` db per test, no admin-key seed,
      no shared state between test files.
- `src/server/app.ts` (`POST /v1/chat/completions`)
  - The `requests` row is now created **first**, in a `pending` state, before the
    firewall/policy/routing/attempts logic runs.
  - `logRequest()` (an INSERT) replaced by `finalizeRequest()` (an UPDATE against
    the row created above) at every exit path: firewall block, no-eligible-provider,
    streaming completion, non-streaming completion.
  - `request_attempts` inserts (mid-flight, during the failover loop) now always
    reference an already-existing `requests.id`.
  - The policy-denial `security_events` row now stores a structured JSON audit
    trail (`policyId`, `policyName`, `action`, `matched`, `decision`, `reason` per
    policy per candidate) instead of one flattened string.
- `drizzle/meta/_journal.json`
  - `0001_request_attempts.sql` existed on disk but was **not registered** in the
    journal, so `wrangler d1 migrations apply` silently never ran it. Registered it.
- `wrangler.toml`
  - Unrelated pre-existing incompatibility with the installed wrangler version blocked
    `npm run cf:d1:migrate:local` outright (`[[triggers]]` array-of-tables syntax is
    rejected by wrangler 4.x, which wants `[triggers]`), and no `migrations_dir` was
    set so wrangler looked in `./migrations` instead of `./drizzle`. Fixed both —
    minimal, config-only, no app logic touched — because otherwise the "final
    verification" step in the spec (`wrangler d1 migrations apply --local`) could not
    be run at all, on this project, ever.
- `src/server/__tests__/testHarness.ts`, `failover.test.ts` — new.

## Actual verification commands + actual results

```
$ npx vitest run src/server/__tests__/failover.test.ts
 ✓ src/server/__tests__/failover.test.ts  (8 tests) 184ms
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

Cases covered and passing:
- creates the request row before any attempt is inserted — no FK violation
- rejects an orphan `request_attempts` row under real FK enforcement (proves the
  pragma is actually active, not just present in source)
- A 500 → B success (both attempts recorded against the same request)
- A 429 → B success
- A network/timeout error → B success
- non-retryable 4xx (401) stops immediately — provider B is never called
- all providers fail → 503, every attempt still persisted against the request
- respects `MAX_FAILOVER_ATTEMPTS = 3` even with 4 eligible candidates

```
$ npx wrangler d1 migrations apply ai-router-db --local
┌───────────────────────────┬────────┐
│ 0000_eminent_wraith.sql   │ ✅     │
│ 0001_request_attempts.sql │ ✅     │
└───────────────────────────┴────────┘

$ npx wrangler d1 execute ai-router-db --local --command "PRAGMA foreign_keys"
[{"results":[{"foreign_keys":1}],"success":true}]

$ npx wrangler d1 execute ai-router-db --local --command \
  "INSERT INTO request_attempts (id, request_id, attempt_number, provider_id, model_name, started_at, result) \
   VALUES ('orphan-test','no-such-request',1,'p','m',0,'success')"
✘ [ERROR] FOREIGN KEY constraint failed: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_FOREIGNKEY)
```

This confirms two things concretely, on the real D1 engine (not just Node/libsql):
1. D1 has `foreign_keys` on by default (`= 1`) — the app doesn't need to set it there.
2. The orphan-insert ordering bug this stage exists to fix is a **real** constraint
   violation on the actual deployment target, not a theoretical one.

## Known limitations
- Streaming-path finalize (`stream()` callback in `/v1/chat/completions`) is fixed
  the same way as the non-streaming path but is **not covered by an automated test**
  in this checkpoint — Hono's `stream()` helper is awkward to drive from a plain
  `app.fetch()` call in vitest. Manual code review only for that branch.
- `npm run lint` (`tsc --noEmit`) still fails — 2 pre-existing errors in `src/App.tsx`
  (`AppNodeProps`/`ProviderNodeProps` missing a `key` prop), unrelated to CP04, not
  touched here. This is Stage B/CP02 territory.
