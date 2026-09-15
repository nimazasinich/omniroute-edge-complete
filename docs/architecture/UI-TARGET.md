# Canonical V3 UI Target

`docs/reference/target-dashboard.png` is the visual source of truth for the Canonical V3 dashboard composition.

The implementation targets the same dense desktop information architecture:

- full-width Cloudflare AI Router header with quick search and primary tabs;
- narrow left navigation rail;
- six KPI cards;
- central **Global AI Traffic Topology** workspace;
- right-side **Runtime Resources** and **AI Firewall Activity** panels;
- bottom **Recent AI Routing Decisions**, **Provider Health**, and **Global Edge Traffic** panels.

## Truthfulness rule

The screenshot is a **visual reference only**. Its operational numbers are not copied into runtime state. UI values must come from observed V3 APIs/telemetry or display an explicit unknown/empty state. Decorative map geography is labelled illustrative when geographic request telemetry is unavailable.

Provider/model selection, retry and failover remain owned by OmniRoute. Provider/model/routing controls in this dashboard stay read-only unless a real OmniRoute management API is integrated and verified.
