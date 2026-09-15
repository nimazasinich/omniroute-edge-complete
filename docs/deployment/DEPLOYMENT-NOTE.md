# OmniRoute Edge deployment candidate

This package is the dedicated Cloudflare edge/control/observability deployment candidate.

Key contract:
- Worker name: `omniroute-edge`
- `/v1/*` is proxied to `OMNIROUTE_ORIGIN`
- OmniRoute is the sole routing authority
- no edge-side provider/model/account fallback or retry
- public gateway credential is separate from the optional origin credential
- D1 is a secondary control/read-model store, not final routing truth
- deployment fails closed while `OMNIROUTE_ORIGIN` is empty

The one-click deployer runs typecheck/tests/build and D1 migrations before deploy.
It creates a dedicated `omniroute-edge-db` if one does not already exist.
It never modifies the existing `cf-control-mcp` Worker or `DM_DB`.

## Production deployment

1. Configure `OMNIROUTE_ORIGIN` in `wrangler.toml` with the verified durable HTTPS endpoint for the real OmniRoute runtime. Localhost, temporary tunnel URLs, embedded credentials, and the Edge Worker URL itself are rejected.
2. Supply smoke-test credentials through `PRODUCTION_SMOKE_ADMIN_TOKEN` and `PRODUCTION_SMOKE_GATEWAY_TOKEN`. The script can also use the existing local `.env` names `DEV_ADMIN_TOKEN` and `GATEWAY_AUTH_TOKEN`; values are never printed.
3. Run `npm run deploy:production` from this project root.

The command validates configuration and origin reachability, runs release tests, checks every local migration against remote D1, builds, performs a Wrangler dry-run, deploys the existing `omniroute-edge` Worker, and verifies the live UI, assets, auth boundaries, authenticated v2/D1 reads, and `/v1/models`. It stops on the first failure.

Remote D1 currently contains the historical record `0004_routing_decision_index.sql` as well as the canonical `0005_routing_decision_index.sql`. Preserve that history. The deployment command accepts this one documented extra record but fails on missing current migrations or any other unexpected migration record.
