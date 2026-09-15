# OmniRoute Edge V3.2 Completion Design

## Goal
Complete the product in three coordinated tracks: richer dashboard/UI, stronger operational data contracts and OmniRoute connectivity visibility, and reproducible deployment/verification. Operational data must never be fabricated.

## Architecture
Cloudflare Worker remains the only production `/v1/*` edge path. OmniRoute remains the sole provider/model routing and fallback authority. D1 stores only facts observed by the edge plus explicitly labelled legacy/read-only inventory snapshots. The React UI consumes backend capability/source metadata so unsupported control-plane features render as unavailable/read-only rather than simulated.

## Data truth rules
- Request count, status, latency, path, correlation ID and authenticated key identity come from edge-observed telemetry.
- Requested model may be recorded only when parsed from the actual JSON request body.
- Selected model, provider, token usage and cost remain unknown unless an authoritative upstream source supplies them.
- Runtime memory/CPU is unavailable in Worker runtime unless a real sample exists; zeros are not used as placeholders.
- Provider/model inventory is labelled as a read-only snapshot until an authoritative OmniRoute management API is integrated.
- `/v1/models` may be probed only against the configured OmniRoute origin and is reported as a connectivity/model-surface probe, not provider health.
- No local provider scoring, fallback, provider health probing, prompt firewall simulation or synthetic alerts.

## UI completion
Every sidebar surface gets a complete operational layout with search/filter/summary/empty/error states. Routing, security-policy and firewall pages explain capability state and show only observed evidence. Settings exposes deployment, gateway, telemetry and OmniRoute connectivity truth. The approved 1368x753 Cloudflare-style dashboard remains the visual reference.

## Operational completion
Add `/api/system/capabilities` and `/api/omniroute/status`. Pass OmniRoute configuration bindings into the Hono observability app. Capture requested model safely from real request bodies. Add nullable observed metrics columns so token/cost values are not represented by fabricated zeros.

## Verification
Add dependency-free contract tests first, run them RED then GREEN, run static safety/import checks, TypeScript syntax parsing, then attempt `npm ci`, `tsc`, Vitest and Vite build. Build/runtime claims remain BLOCKED if registry access prevents dependency restore. Final ZIP is extracted and hash-compared file by file and scanned for secrets/runtime databases.
