# Dashboard Design Reference

Canonical visual target: `target-dashboard-1368x753.png`.

The supplied `Cloudflare_AI_Router_Transparent_DesignSpace_1368x753_v2.zip` is a visual/design reference only. Its example KPI numbers, provider health, traffic, threats, latency, cost, uptime, and geographic values are not runtime truth and must never be hard-coded as live data.

Implementation rules:

- Preserve the 1368×753 desktop composition, card density, spacing, hierarchy, sidebar/header proportions, topology composition, and provider presentation.
- Build the board with real React components; do not use the reference screenshot as the application UI.
- Provider and model lists must use the complete loaded inventory; dashboard summaries may be intentionally bounded only when the UI explicitly says so and links to the complete workspace.
- Provider credentials remain encrypted/secret. The UI may show credential presence metadata only.
- Gateway/admin API keys remain hashed in storage. List views expose masked metadata only; raw secrets are never persisted or re-displayed.
- Live OmniRoute data is authoritative when supported and validated. SQLite is snapshot/reference data and must be labeled accordingly.
- Cloudflare/edge measurements are separate from local/runtime measurements. Local verification must not be presented as Cloudflare production evidence.
- Unknown or unobserved values must render as Unknown, Unavailable, Not observed, Not configured, or `—`, never as invented operational values.
