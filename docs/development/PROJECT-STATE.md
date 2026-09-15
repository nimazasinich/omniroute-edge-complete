# OmniRoute Edge — Canonical V3.2 Project State

## Canonical source

This tree is **Canonical V3.2** (`package.json` version `3.2.0`). It is the replacement source reconciled from the earlier `bun` baseline, `_env` work, and V3.1 UI pass.

The approved visual reference is `docs/reference/target-dashboard.png`. The reference controls layout and hierarchy only. Its example operational values are **not** runtime data and are not hard-coded into the application.

The package intentionally excludes `node_modules`, `.env`, runtime databases, raw provider/key exports, scratch dumps, stale `dist`, `.wrangler`, and embedded-source deployment payloads.

## Runtime authority

- `src/worker.ts` is the only production `/v1/*` gateway path.
- **OmniRoute is the only provider/model selection and fallback authority.**
- The edge authenticates, rate-limits, validates the origin, attaches request/correlation IDs, records edge-observed D1 telemetry, and preserves upstream streaming.
- The edge does not select providers, score candidates, retry providers, or fabricate fallback decisions.
- D1 is an observability/admin read model; it is not routing truth.
- Provider/model/routing mutations remain disabled until a real authoritative OmniRoute management API is connected.

## Truth-source policy

| Surface | Authoritative source | Missing-data behavior |
|---|---|---|
| Gateway request outcome/status/latency/path | Worker edge telemetry → D1 | Unknown / no rows |
| Requested model | Bounded parse of the real JSON request | `Unknown` |
| Selected provider/model | OmniRoute attribution only, if later integrated | `Unknown` |
| Token usage / cost | Nullable observed fields only | `—` |
| Provider/model inventory | Explicitly labelled legacy D1 snapshot | Snapshot label, never live-health claim |
| Provider health | OmniRoute is authority; not currently integrated | `Unknown` |
| OmniRoute connectivity/model surface | Real bounded `/v1/models` probe to configured origin | Not configured / unreachable / unknown |
| Security events | Stored D1 security events | No rows; no firewall coverage inferred |
| Alerts | Real gateway request outcomes | API unavailable is distinct from empty |
| Node runtime memory | Real Node process metrics only | Unavailable on Worker |
| Geographic edge traffic | Not available | Map is explicitly illustrative |

## V3.2 UI completion

Active UI now includes:

- reference-aligned global header, sidebar, six KPI cards and dense 1368×753 dashboard layout;
- truthful Global AI Traffic Topology with implemented edge capability badges only;
- provider inventory with search/filter, snapshot-source labels and observed traffic attribution;
- model inventory with search/filter plus real OmniRoute `/v1/models` probe results;
- routing-status view that displays edge outcomes instead of reconstructing provider scores;
- security enforcement inventory and security-event explorer without claiming a local prompt firewall;
- request logs with nullable observed tokens/cost and no legacy-zero substitution;
- edge request traces with path/correlation/status/latency evidence and no candidate-scoring fiction;
- analytics, alerts, audit log, API-key management and settings/capability matrix;
- explicit empty/unavailable/unknown states instead of screenshot sample values.

## V3.2 operational additions

- `GET /api/system/capabilities` explicitly states supported and unsupported control-plane capabilities.
- `GET /api/omniroute/status` performs a bounded real `/v1/models` connectivity/model-surface probe against the configured origin.
- gateway telemetry records the requested model when safely observable from a bounded cloned JSON body.
- nullable D1 fields `observed_tokens_input`, `observed_tokens_output`, and `observed_cost` prevent legacy zero values from masquerading as observed usage.
- migration `drizzle/0003_observed_metrics.sql` and local DB upgrade logic carry those fields forward.
- `scripts/verify-deploy-config.mjs` fails closed on the placeholder D1 ID, empty/non-HTTPS OmniRoute origin, wrong environment, or changed routing authority.
- `VERIFY-AND-BUILD.cmd` provides the Windows replacement verification/build workflow.

## Fresh verification in this environment

PASS:

- dependency-free Node contract suite: **40/40 PASS, 0 failed, 0 skipped**;
- TypeScript/TSX syntax parse: **44 files, 0 syntax diagnostics** (global TypeScript parser; syntax only);
- static safety/import verifier: **PASS**;
- deploy-config verifier behavior: source placeholder configuration fails closed, verified-shaped temporary configuration passes;
- secret/runtime-artifact scans: no packaged `.env`, DB, raw credential dump, `node_modules`, stale `dist`, or known token-prefix match.

BLOCKED — **not PASS**:

- `npm ci` online: timed out in this packaging environment;
- `npm ci --offline`: `ENOTCACHED` because `yocto-queue-1.2.2.tgz` is not present in the npm cache;
- therefore dependency-backed `tsc --noEmit`, Vitest, and Vite production build were not legitimately runnable here;
- no fresh React runtime screenshot is claimed from this source;
- Cloudflare deployment, Access, real D1 binding, Tunnel/VPS, live OmniRoute response, and production telemetry remain deployment-environment verification items.

## Production configuration required before deploy

1. Create or inspect the dedicated D1 database and replace the zero UUID placeholder in `wrangler.toml` with the verified ID.
2. Configure `OMNIROUTE_ORIGIN` with the verified HTTPS/Tunnel origin.
3. Set gateway/origin/bootstrap credentials through Cloudflare secret mechanisms; do not put them in source.
4. Configure Cloudflare Access for the admin/dashboard surface as required by the target architecture.
5. Apply D1 migrations through `0003_observed_metrics.sql`.
6. Run `npm run verify:deploy-config` and the full dependency-backed verification on the exact replacement tree.
7. Deploy only after those gates pass and record the exact deployed Worker version.

## Required replacement verification

```bash
npm ci
npm run lint
npm test
npm run build
npm run test:node
npm run verify:safety
npm run verify:deploy-config
npm run manifest
```

On Windows, `VERIFY-AND-BUILD.cmd` runs the dependency/build verification sequence up through manifest generation. `verify:deploy-config` is intentionally separate because source replacement ships with fail-closed deployment placeholders.

`BLOCKED`, `SKIP`, and `UNVERIFIED` are never PASS.
## 2026-09-14 merged superset checkpoint

The delivered merged tree additionally includes the CP10 normalized `/api/v2` architecture (system, catalog, Combo, routing, operations, observability), the observation-only routing decision index, and DreamWorker-branded application chrome/connecting UI. Source-1 browser session, OAuth, CSRF, Worker environment bindings, and fail-closed routing-authority rules remain authoritative. The CP10 routing migration was renumbered to `0005_routing_decision_index.sql` to coexist with `0004_browser_auth.sql`.

