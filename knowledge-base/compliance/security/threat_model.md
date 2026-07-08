# Threat Model

## Project Overview

Homiquity is a mortgage platform with a React frontend and a Node.js/Express backend backed by PostgreSQL via Drizzle ORM. It serves borrowers, agents, and internal staff, and processes highly sensitive mortgage, identity, income, property, credit, document, and compliance data. Production traffic reaches the Express API through `server/index-prod.ts`, `server/app.ts`, and `server/routes.ts`.

This scan iteration assumes the current deployment is unpublished/private rather than publicly reachable from the internet. That means anonymous internet-only exposure paths are deprioritized, but authenticated borrower, partner, and staff authorization flaws remain fully in scope.

## Assets

- **Borrower identities and sessions** -- authenticated sessions, password-based and OAuth-backed accounts, and role assignments. Compromise allows impersonation or staff privilege abuse.
- **Mortgage application records** -- loan applications, URLA data, property details, rate locks, underwriting state, declarations, deal activities, and generated letters. These records directly affect lending decisions and business operations.
- **Sensitive personal and financial data** -- names, addresses, employment history, assets, liabilities, credit consent data, uploaded documents, and other borrower PII. Exposure would create major privacy, regulatory, and fraud risk.
- **Documents and derived intelligence** -- uploaded files, OCR/extraction results, and generated PDFs. These can contain income proofs, identity documents, and underwriting artifacts.
- **Compliance and audit records** -- credit pulls, adverse-action history, retention records, and audit trails. Tampering or disclosure can create regulatory and legal exposure.
- **Application and integration secrets** -- database credentials, email credentials, AI/API keys, Plaid credentials, Google Maps keys, and object-storage access. Leakage could lead to account compromise or third-party abuse.
- **Operational and commercial control-plane data** -- referral leads, pricing catalogs, underwriting rules, SLA settings, pipeline metrics, and lender/product metadata. Exposure can leak confidential business logic and partner-sensitive commercial information.

## Trust Boundaries

- **Browser to API** -- every client request crosses from an untrusted browser into the Express API. The server must authenticate and authorize every read and write; client-side routing and UI state are not security controls.
- **Authenticated borrower to staff/admin boundary** -- borrowers, brokers/agents, and internal mortgage staff have materially different permissions. Role separation must be enforced server-side for every route and every referenced record.
- **General staff to underwriting/control-plane boundary** -- broad staff roles such as `loa`, `broker`, and `lender` should not automatically inherit authority to waive underwriting conditions, advance pipeline stages, or disable global underwriting rules. These actions materially affect credit decisions and platform-wide controls.
- **Application record ownership boundary** -- even among authenticated users with the same base role, each borrower should only access their own application, child records, documents, and workflow state unless explicit sharing exists.
- **API to PostgreSQL** -- route handlers call generic storage methods that frequently accept raw IDs. Because many storage helpers do not enforce ownership themselves, authorization must happen before those helpers are invoked.
- **API to object storage and external services** -- the server exchanges sensitive files and decision inputs with storage, Plaid, email, AI services, and mapping/property services. These calls must not allow unauthorized data fetches or leakage.
- **Dev/internal to production boundary** -- mock or sandbox-only paths are out of scope unless proven reachable in production. Production scans should focus on the actual Express runtime and deployed route set.

## Scan Anchors

- **Production entry points:** `server/index-prod.ts`, `server/app.ts`, `server/routes.ts`
- **Highest-risk code areas:** `server/routes/borrower.ts`, `server/routes/lending.ts`, `server/routes/compliance.ts`, `server/routes/documents.ts`, `server/routes/task-engine.ts`, `server/routes/underwriting.ts`, `server/routes/underwriting-rules.ts`, `server/storage.ts`
- **Newly validated hot spots:** `server/routes/agent-broker.ts`, `server/routes/staff-invites.ts`, `server/routes/intelligence.ts`, `server/routes/data-intelligence.ts`, `server/auth.ts`, `server/socialAuth.ts`, `server/integrations/auth/` (the Replit auth integration was removed 2026-07-02), onboarding verification routes in `server/routes/borrower.ts`, shared pipeline views such as `/api/pipeline/queue`, compliance-wide views such as `/api/compliance/dashboard` and `/api/credit/archive-eligible`, document list/download/upload routes in `server/routes/borrower.ts`, `server/routes/documents.ts`, and `server/routes/lending.ts`, document-package mutation routes in `server/routes/borrower.ts` (especially `POST /api/document-packages/:packageId/items`), message state mutations such as `PATCH /api/messages/:messageId/document-request`, generic staff status mutations in `server/routes/lending.ts`, closing-guarantee routes in `server/routes/borrower.ts`, homeowner post-close routes such as `/api/homeowner/equity/:profileId` and `/api/homeowner/equity`, the global API response logger in `server/app.ts`, deal-team mutation routes, and endpoints that accept raw `applicationId`, `taskId`, `documentId`, `letterId`, invite codes, verification identifiers, snapshot IDs, profile IDs, message IDs, or user IDs
- **Public vs authenticated vs admin surfaces:** public property/listing/content routes; borrower authenticated routes under `/api`; staff/admin actions commonly guarded by `requireRole(...)` or `isStaffRole(...)`
- **Usually ignore unless proven reachable:** mockup/dev-only scaffolding and experimental sandbox code outside the production Express path; duplicate route definitions that are shadowed by an earlier production registration order
- **Specifically shadowed in current production route order:** ~~the later JSON `POST /api/documents/upload` handler is shadowed by the earlier multipart route~~ **(obsolete 2026-07-04: PR #44 deleted the multipart disk path entirely — `POST /api/documents/upload` is JSON-registration-only and rejects multipart; uploads flow through presigned URLs via `/api/uploads/request-url`)**

## Threat Categories

### Spoofing

This application relies on session-backed authentication and multiple user roles. The API must treat every protected route as hostile until it validates the session and current user role. OAuth identities, password-based accounts, and any staff-only action must map to the correct server-side identity. Sensitive actions such as task management, underwriting operations, and credit workflows must never trust user-controlled IDs in place of verified identity.

Required guarantees:
- Protected routes MUST require a valid authenticated session.
- Staff-only and admin-only operations MUST enforce role checks server-side.
- Session-backed authorization MUST be refreshed from current server-side role state so role changes and revocations take effect promptly.
- Server-side business actions MUST use the authenticated user identity, not client-supplied user identifiers, as the source of truth.
- High-impact underwriting and policy actions MUST require appropriately narrow roles or explicit assignment-based authorization rather than any generic staff role.
- Identity-proofing and KYC/AML flows MUST be backed by real verification logic in production; simulated or fixed-answer checks are not acceptable substitutes for borrower verification.

### Tampering

Borrowers and staff can submit large amounts of financial data, workflow state, and compliance metadata. Because many storage methods accept raw IDs and partial update objects, tampering risk is high if route handlers do not verify ownership before writing. The system must not allow one user to modify another borrower’s application, linked child records, or workflow artifacts by swapping IDs in the request.

Required guarantees:
- Every write keyed by `applicationId`, `taskId`, `documentId`, or other child-record ID MUST verify ownership or authorized staff access before mutation.
- Server-side loan, compliance, and workflow state MUST be derived from authorized records, not blindly from client-submitted identifiers.
- Generic storage helpers MUST only be called after authorization has been established, or be wrapped in ownership-scoped variants for sensitive record types.

### Information Disclosure

The platform stores mortgage PII, uploaded documents, credit-related records, generated letters, and confidential internal pricing and underwriting data. The biggest disclosure risk is broken object-level authorization on authenticated routes that return data by application ID or record ID, especially where `broker` and `lender` are treated as generic staff.

Required guarantees:
- Borrower-facing reads MUST be scoped to the requesting user’s own applications unless a staff role is explicitly allowed.
- Document, consent, credit, URLA, referral-lead, and predictive-analytics endpoints MUST not return data for arbitrary IDs supplied by another authenticated user.
- Partner roles such as `broker` and `lender` MUST not receive global access to organization-wide borrower records, referral leads, pricing catalogs, workflow analytics, or underwriting telemetry unless an explicit tenant or assignment scope is enforced.
- API responses and logs MUST avoid exposing secrets, raw credit payloads, or unnecessary sensitive fields.
- Secrets such as invite codes and third-party bearer tokens MUST not be placed in URLs, returned wholesale from ORM rows, or written verbatim into request/response logs.

### Denial of Service

The API accepts file uploads, document extraction requests, letter generation, and other potentially expensive operations. Public and authenticated endpoints must avoid unbounded abuse that could degrade service or inflate third-party costs.

Required guarantees:
- Authentication, upload, and expensive processing endpoints MUST remain rate-limited or otherwise bounded.
- File uploads and document-processing requests MUST enforce reasonable size and type limits.
- External service calls and generation flows MUST fail safely and avoid unbounded retries.

### Elevation of Privilege

The most relevant privilege-escalation risk is broken access control between borrowers and staff, between one borrower and another, and between external partners and internal control-plane capabilities. In this codebase, helper methods often expose or mutate records by raw ID, so a route that checks only `isAuthenticated` or broad `isStaffRole(...)` membership can become an IDOR or horizontal privilege-escalation flaw. Staff-only capabilities like credit actions, underwriting artifacts, or workflow management must not be reachable through weaker alternate routes.

Required guarantees:
- Every route that references application-scoped or child-record-scoped data MUST verify owner-or-staff access server-side.
- Role-restricted capabilities MUST not be reachable through adjacent authenticated endpoints that bypass the intended authorization helper.
- Sensitive record types with indirect identifiers (tasks, rate locks, consents, child URLA rows, linked documents) MUST be resolved back to an authorized parent application before access is granted.
- Broad staff roles such as `broker`, `lender`, `loa`, and `processor` MUST not automatically receive global control over platform-wide task queues, pricing catalogs, milestones, policy artifacts, credit workflows, or compensation records without assignment or narrower role checks.
- Assignment-based safeguards are only meaningful if team-membership mutation routes are themselves tightly authorized; otherwise assignment checks can be bypassed by self-enrollment.

## Reporting Scope Notes

- When the deployment is unpublished/private, do not report findings that depend only on anonymous public internet reachability. Continue to report vulnerabilities reachable by authenticated users, invited partners, staff, or other trusted-network actors.
- Do not repropose weaknesses that require a separate database compromise unless the scan also finds a production-reachable write primitive that makes the integrity failure exploitable in practice.
