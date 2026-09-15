# Replace Instructions — Canonical V3.2

1. Back up the project directory you are replacing.
2. Extract this package into a **new empty directory**. Do not overlay stale `node_modules`, `dist`, `.env`, `.wrangler`, databases, caches, or scratch files from the old tree.
3. Do not copy old provider/key dumps or source-packaged secrets into V3.2.
4. Restore dependencies and verify the exact extracted tree:

```bash
npm ci
npm run lint
npm test
npm run build
npm run test:node
npm run verify:safety
npm run manifest
```

On Windows you can run `VERIFY-AND-BUILD.cmd` for this sequence.

5. Start the verified build/dev environment and compare layout/hierarchy at 1368×753 against `docs/reference/target-dashboard.png`. The reference screenshot contains example values; **do not expect or copy those values**. Runtime values must come from the real APIs or display unknown/no data.
6. Before Cloudflare deployment:
   - create/inspect the dedicated D1 database and replace the zero UUID placeholder in `wrangler.toml`;
   - set the verified HTTPS/Tunnel `OMNIROUTE_ORIGIN`;
   - set required secrets outside source;
   - apply D1 migrations through `0003_observed_metrics.sql`;
   - configure Cloudflare Access for the admin/dashboard boundary;
   - run `npm run verify:deploy-config` and require PASS.
7. Deploy only the exact source/build that passed all gates; record the deployed Worker version and perform end-to-end auth, rate-limit, streaming, D1 telemetry, dashboard, Access and OmniRoute-routing checks.

The source package contains no `node_modules` and no stale `dist`. A production `dist` must be generated from this exact source.
