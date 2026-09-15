# OmniRoute Edge Release Delivery - 2026-09-12

This package is the latest source and built asset handoff for the deployed
`omniroute-edge` Cloudflare Worker.

## Included

- React dashboard source and production `dist/` assets.
- Cloudflare Worker entrypoint with static asset serving.
- D1-backed admin/readiness/topology/provider/model APIs.
- D1 gateway-key authentication support for `/v1/*`, while preserving the
  legacy `GATEWAY_AUTH_TOKEN` secret path.
- Sanitized Light AgentKit provider snapshot imported into the live D1 database
  as disabled/offline records: 20 providers and 9 models.
- Checkpoints, reports, migrations, and one-click deployment launcher.

## Credential Handling

Raw API keys and tokens are not stored in this source package.

Runtime secrets are installed in Cloudflare Worker secrets:

- `BOOTSTRAP_SECRET`
- `GATEWAY_AUTH_TOKEN`
- `STORAGE_ENCRYPTION_KEY`

Application API keys are installed in D1 as bcrypt hashes:

- 1 active admin key
- 1 active gateway key

Provider snapshot rows were imported without provider credentials. They are
disabled/offline by design until real upstream credentials and
`OMNIROUTE_ORIGIN` are configured.

## Last Verified Deployment

- Worker: `omniroute-edge`
- URL: `https://omniroute-edge.amin-chinisaz-edu.workers.dev`
- Version ID: `8a1564e4-2e37-4306-8bde-682f260050c2`
- Production checks: root 200, `/api/health` ok, 20 topology providers, 9 models.
- `/v1/*` auth accepts the active gateway key and then fails closed with
  `origin_not_ready` while `OMNIROUTE_ORIGIN` is empty.
