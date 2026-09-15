# CP05-POLICY-ROUTING-V2

## What changed
- `src/server/router.ts`
  - `checkCandidatePolicy()` (ignored `policies.action` entirely — every policy
    behaved as a hard deny, "deny-oriented" as the spec described) replaced with
    `evaluateCandidatePolicies()`.
  - `policies.action` (`allow` | `deny`) is now the authoritative behavior switch.
    `policies.type` only decides the domain (`model_*` → match against model name,
    `provider_*` → match against provider name); `token_limit_daily` and
    `block_external_on_sensitive` are unchanged special-purpose hard-deny types.
  - Precedence, implemented exactly as specified: **hard deny > allow constraint >
    normal routing.**
    - `action: 'deny'` + match → candidate ineligible immediately (hard deny).
    - `action: 'allow'` + non-empty list + candidate not in list → ineligible
      (allow constraint), *unless* a hard deny already fired for that candidate.
    - No policy matches → eligible.
  - Every policy evaluated against every candidate now produces a
    `PolicyEvaluationRecord { policyId, policyName, policyType, action, matched,
    decision, reason }` — this is the audit trail the spec asked for.
- `src/server/app.ts`
  - The `policy_violation` `security_events.detail` is now
    `JSON.stringify({ summary, auditTrail })` where `auditTrail` is the full list of
    `PolicyEvaluationRecord`s (with candidate provider/model attached) across every
    candidate that was evaluated — not a single concatenated string.
- `src/server/__tests__/policy.test.ts` — new.

## Actual verification commands + actual results

```
$ npx vitest run src/server/__tests__/policy.test.ts
 ✓ src/server/__tests__/policy.test.ts  (10 tests) 105ms
 Test Files  1 passed (1)
      Tests  10 passed (10)
```

Cases covered and passing (matches the spec's required test list):
- deny policy (`action=deny`) makes a matching model ineligible
- allow policy (`action=allow`) restricts eligibility to the allowed set — a
  non-matching model is denied
- allow policy lets a matching model through
- deny provider policy denies that provider
- allow provider policy: only the allowed provider is eligible, the other is denied
- conflicting allow + deny on the same model → hard deny wins (precedence)
- `token_limit_daily`: a client over its daily limit is denied
- `block_external_on_sensitive`: a sensitive request blocks non-local providers
- no eligible provider at all → `selected: null` with a clear reason
- highest-score provider denied by policy → the second-best candidate is selected
  instead (proves policy filtering runs *after* scoring/ranking, not before)

## Known limitations
- Backward compatibility: policies created before this change (via the admin API,
  which already accepted `action` in the request body but the routing engine
  ignored it) default to `action: 'deny'` at the DB column level. Any existing
  `model_allowlist`-typed policy that was relying on the *old*, type-name-driven
  allow behavior will now behave as a deny policy unless its `action` is explicitly
  updated to `'allow'`. No data migration was written to backfill this, because
  there is no reliable way to distinguish "admin explicitly chose deny" from
  "column never touched, still at its default" after the fact — flagged here
  rather than guessed at.
- The admin UI (`App.tsx`) has no policy management screen at all currently (only
  the backend/admin API does CRUD), so there was nothing to update or redesign
  there for this stage — confirmed by inspection before making this change.
