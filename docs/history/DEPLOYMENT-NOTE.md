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
