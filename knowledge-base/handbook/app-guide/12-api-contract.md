# 12 — The UI ↔ Backend API Contract

The boundary rules that [04 — API Surface](04-api-routes.md) and
[05 — Data Flow](05-data-flow.md) assume but never state: **who owns a payload shape, what the wire
states mean, and how a shape changes without dropping a borrower's answer.**

This chapter exists because the ownership was implied across three documents and one test snapshot,
and the gaps showed up as data loss. Two separate 2026-08-18 defects had the same root cause — the
intake schema had no way to say *"clear this field"*, so a borrower who emptied an input got a
success toast and kept the old value. The fix was a contract change, not a UI change.

## Who owns a shape

**The server owns every request and response shape.** A route declares it with a module-scope Zod
schema — usually `createInsertSchema` off the Drizzle table in [`shared/schema/`](../../../shared/schema/),
`.omit()`-ing every server-injected field (userId, applicationId, status, timestamps) so the client
cannot supply them at all. The client consumes that shape; it never negotiates it.

The layering rule is the enforcement: `client/` never imports from `server/`, `server/` never imports
from `client/`, and both import from `shared/`. **`shared/` is the contract surface** — a type that
both sides need lives there or the boundary is being crossed some other way.

| Layer | Owns | File |
|---|---|---|
| Route | validation, status codes, auth gating | `server/routes/**` |
| Contract types + Zod source | the shape itself | `shared/schema/**`, `shared/*.ts` |
| Client | consumption, cache keys, rendering | `client/src/lib/queryClient.ts` + pages |

## The three wire states

A PATCH-style body distinguishes **three** states, and conflating any two loses data:

| On the wire | Means | Server does |
|---|---|---|
| key **absent** | unchanged | leaves the stored value alone |
| key present with a **value** | set to this | writes it |
| key present as **`null`** | **clear it** | writes NULL |

`null` is a first-class third state, not a missing value. Before it existed, "empty" and "unchanged"
were the same message and the server could only choose one — which is why a cleared field silently
survived a save. Columns that admit a cleared answer are nullable in the schema, so adding the state
needed no migration.

**This is machine-checked.** [`tests/zodSchemaSemantics.test.ts`](../../../tests/zodSchemaSemantics.test.ts)
parses probe payloads against every exported schema and snapshots the outcomes to
`tests/__snapshots__/zod-schema-semantics.json`. Its `all-keys-null` probe is the one that records
which fields accept `null` — one probe, every key at once, added precisely because the per-field
probes had missed this class. The test also unwraps `z.preprocess`/`.transform` to reach the object
shape underneath; a schema that hides its shape behind a transform used to be tested by ten scalar
probes and nothing else.

## Error shape

Validation failures come back as `res.status(400).json({ error, details })` — `parseBodyOr400`
([`server/routes/validate.ts`](../../../server/routes/validate.ts)) writes `{ error: "Invalid
request body", details: <per-field errors> }` and returns `undefined`, so **every caller must
`if (data === undefined) return;` before using the value.** Other client errors are
`res.status(4xx).json({ error })`. Unexpected errors bubble to the central handler; do not
hand-roll a 500 body.

On the client, `throwIfResNotOk` turns any non-2xx into an `ApiError` carrying the status and the
response text ([`client/src/lib/queryClient.ts`](../../../client/src/lib/queryClient.ts)). A 401
latches the session-expired handler except on the three background polls — so **a new background
poll must be added to that allow-list or it will bounce a signed-in user to `/login`.**

## Obligations that ride on the boundary

- **Authorization is server-side, never by hiding UI.** Public data → no middleware; borrower data →
  `isAuthenticated` **plus** a check that the resource belongs to `req.user.id`; staff/admin →
  `requireRole(...)` with `isInternalStaffRole`/`isStaffRole` from `shared/roles.ts`. Never trust a
  client-supplied user id.
- **PII crosses the boundary encrypted.** SSNs via `server/services/ssnVault.ts`, other PII via
  `encryptionService.ts`, and every PII-touching mutation writes a `server/auditLog.ts` entry.
  Response-body logging is allow-list only (`RESPONSE_BODY_LOG_ALLOWLIST` in `server/app.ts`).
- **CSRF is app-wide** with a single `/api/webhooks/*` carve-out; webhook receivers authenticate
  with a shared-secret header instead.
- **Query keys are the client's half of the contract** and are guarded: `pnpm guard:querykeys` runs
  the key, reachability and transport guards together. A new endpoint with an unreachable key is a
  red gate, not a style note.

## How a shape changes

1. **Only a backend lane proposes it.** The [Backend Data Engineer](../../../.claude/skills/backend-data-engineer/SKILL.md)
   is accountable (CHARTER §10b); the Primary Engineer may also take one in its company-wide lane.
   **The UI Conformance Sweep and the Wiring Audit may not** — CHARTER §10/§10a and DESIGN_SYSTEM §14
   forbid Zod edits and payload changes inside a visual batch, because capture fields feed the
   ULDD/UCD package and a large styling diff is where a dropped field hides best. They file a ticket.
2. **A `shared/schema/**` diff ships its migration in the same PR** — hand-authored
   `migrations/NNNN_*.sql` + a `migrations/meta/_journal.json` entry, expand-only and idempotent.
   `pnpm guard:schema` fails the PR otherwise. Never `pnpm db:push`, never `drizzle-kit generate`
   (both hard-blocked). See [DB_MIGRATIONS.md](../../runbooks/DB_MIGRATIONS.md).
3. **Re-record the snapshot and read every delta.** A changed line in
   `zod-schema-semantics.json` means a data-admission rule changed — that is the signal, not noise.
   On a merge conflict **never take one side wholesale** (REGISTER's shared-file hazards); re-record
   after merging and re-read.
4. **Widen before you narrow.** Add the new state, ship it, let the deployed client and the deployed
   server both tolerate old and new. A narrowing that can fail on existing rows is a **contract**
   migration: L3, prepared and ⛔-flagged, never merged by a routine.
5. **The client change follows** in the same PR or the immediately next one, and the two are named
   in each other's PR bodies. A shape that shipped with no consumer and a consumer that shipped with
   no shape are the same outage.

## Where to look next

[04 — API Surface](04-api-routes.md) for the endpoint tables and domain registration order ·
[03 — Database & Schema](03-database.md) for the tables behind the shapes ·
[05 — Data Flow](05-data-flow.md) for a loan's journey across the boundary ·
[06 — Auth, Security & Secrets](06-auth-security-secrets.md) for the gating detail ·
the [`api-routes`](../../../.claude/skills/api-routes/SKILL.md) skill for the fast-start rules.
