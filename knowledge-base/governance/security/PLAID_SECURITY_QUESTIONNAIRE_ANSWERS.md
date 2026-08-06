# Plaid Security Questionnaire — Answers & Pre-Submit Checklist

**Status:** 🔴 DO NOT SUBMIT until every checklist item in §1 is checked. Several answers
below become true only when the checklist is done — submitting early would misstate our
posture to Plaid's compliance team.
**Internal doc** — not itself an attachment. Attachments are the PDF exports of the three
companion docs (see §3).
**Authority:** [Information Security Policy](INFORMATION_SECURITY_POLICY.md) pack, drafted 2026-07-17.

## 1. Pre-submit checklist (blocking)

### 1a. Enable 2FA on every console — Founder + Developer, both accounts

Use an authenticator app or passkey (not SMS where avoidable). Check off and update the
[Asset & Endpoint Register](ASSET_REGISTER.md) §1 as you go.

- [ ] **GitHub** — Settings → Password and authentication → Two-factor authentication. If the
      repo lives in an organization, also: Org Settings → Authentication security → Require
      two-factor authentication.
- [ ] **Railway** (the application host since the 2026-08 migration off Vercel; the Vercel
      project has been deleted, so there is no Vercel account left to secure) — Account
      Settings → enable two-factor authentication for both members. If sign-in is via GitHub or
      Google, 2FA on that identity provider covers the login — record which in the register,
      and confirm both people are project members with the narrowest workable role.
- [ ] **Neon** — Account Settings → Security → Two-factor authentication. (If sign-in is
      "Continue with Google/GitHub", 2FA on that identity provider covers it — note which in
      the register.)
- [ ] **Google Workspace / Google account** — myaccount.google.com/security → 2-Step
      Verification (this also covers Google Cloud / GCS console access).
- [ ] **Anthropic Console** — Settings → Security → enable 2FA (or note SSO-via-Google).
- [ ] **RapidAPI**, **Sentry** (if in use), **email provider** (if in use), **domain
      registrar** — enable 2FA or record "SSO via Google" in the register.
- [ ] **Plaid Dashboard** — enable 2FA now on the dashboard account you're using for this
      application.

### 1b. Verify the founder laptop (Developer laptop verified ✅ 2026-07-17)

- [ ] Run the verification block in [ASSET_REGISTER.md](ASSET_REGISTER.md) §2 on the
      founder's Mac; fix anything not matching the expected output (System Settings →
      Privacy & Security → FileVault; General → Software Update → automatic updates; Lock
      Screen → require password immediately). Record results in the register row.

### 1c. Adopt the policy pack

- [ ] Founder reads the four docs (Information Security Policy, Access Control Policy,
      Asset & Endpoint Register, Incident Response Plan).
- [ ] Fill the signature block in
      [INFORMATION_SECURITY_POLICY.md](INFORMATION_SECURITY_POLICY.md) §12 (both rows).
- [ ] Merge the PR carrying the pack + the CI dependency-audit step — the merge commit is
      the adoption record. (Q2 and Q4 answers are valid only after this merge.)

### 1d. Verify the hosting provider's certification status *(added 2026-08-06 — blocking)*

Hosting moved from Vercel to **Railway** in August 2026. Nobody has verified Railway's security
attestations, and the Q4 comment previously folded the host into a sentence about providers'
"SOC 2 programs".

- [ ] Founder checks Railway's trust/compliance page for a current SOC 2 Type II (or other)
      attestation, records what was found **with the date** in
      [INFORMATION_SECURITY_POLICY.md](INFORMATION_SECURITY_POLICY.md) §4, and updates the Q4
      comment below to match.
- **Until that is done, do not restore Railway into any certification claim.** The Q4 wording
  below deliberately states only what we control (containers rebuilt from source each deploy,
  provider-managed patching) without asserting a certification we have not seen. An unverified
  attestation claimed to Plaid's compliance team is materially worse than an acknowledged gap.

### 1e. Final consistency pass

- [ ] Register has no remaining ⬜ in the 2FA column (or a dated exception note).
- [ ] Export the three attachment PDFs (§3) from the merged versions.
- [ ] Every attachment says **Railway**, not Vercel, and none of them claims a Railway
      certification that §1d did not verify.

## 2. The eight answers

> Option labels below are the expected Plaid phrasing; where the live form's options differ,
> pick the closest option that remains **true** — never rounder-sounding-but-false — and let
> the comment carry the precision.

### Q1 — Hosting strategy

**Select:** Cloud hosting (already selected — keep).
**Comment:**
> All server-side components run on managed cloud infrastructure: Railway (managed container
> hosting) and Neon (managed PostgreSQL), with Google Cloud Storage for borrower-document
> storage. The application is a single Node.js process in one managed container, serving both
> the API and the static front end. We operate no on-premise or self-managed servers.

### Q2 — Documented information security policy

**Select:** **Yes** — change from the current "No" **only after checklist §1c** (documented
policy, operationalized).
**Comment:**
> We maintain a documented Information Security Policy (attached) covering data
> classification and encryption standards, access control, endpoint/BYOD requirements,
> vendor management, vulnerability management, secure development, and incident response.
> It is owned by the CEO as Security Owner, reviewed annually, and operationalized through
> engineering practice — including binding pre-merge security reviews for any change
> touching PII encryption, authentication, authorization, uploads, or messaging.

**Attach:** Information Security Policy PDF (optionally + Incident Response Plan PDF).

### Q3 — Visibility into network endpoints

**Select:** Yes (the option closest to a maintained inventory).
**Comment:**
> Production consists entirely of managed cloud services — one managed application container
> plus managed PostgreSQL and object storage, with no self-managed server instances to
> discover — and our corporate footprint is two laptops. Both are
> enumerated in a maintained Asset & Endpoint Register (attached), reviewed quarterly. There
> is no corporate LAN or VPN: every asset is an independently authenticated cloud endpoint,
> so unmanaged endpoints cannot join a corporate or production network.

**Attach:** Asset & Endpoint Register PDF.

### Q4 — Vulnerability scanning (laptops + production)

**Select:** Yes if the option allows qualified scope; otherwise the closest truthful option
— valid **only after checklist §1c** (the CI audit step must be merged).
**Comment:**
> Application dependencies are scanned on every pull request via `pnpm audit` as a required,
> blocking CI check (high/critical severities), plus weekly automated Dependabot update PRs.
> Production infrastructure is fully managed (Railway for application hosting, Neon for
> PostgreSQL, Google Cloud for object storage) — OS and platform patching is performed by
> those providers, and our application container is rebuilt from source on every deploy and
> replaced rather than patched in place, so there are no mutable server instances for us to
> scan or patch. Employee laptops enforce automatic OS and security updates under our BYOD
> standard; given a two-device footprint with no local storage of borrower data, we do not
> currently run a dedicated endpoint vulnerability scanner.

⚠️ *Wording note (2026-08-06): this comment previously read "under their SOC 2 programs" while
naming the host. Neon and Google Cloud maintain SOC 2 Type II programs; **Railway's attestation
has not been verified by us**, so the host is deliberately excluded from any certification
claim here. Do not re-add it until checklist §1d is done — see
[INFORMATION_SECURITY_POLICY](INFORMATION_SECURITY_POLICY.md) §4.*

### Q5 — Endpoint security tools against malicious code

**Select:** Yes (qualified) — valid **only after checklist §1b** verifies the founder's Mac.
**Comment:**
> Work devices are Apple Macs protected by macOS's built-in, automatically updated
> anti-malware stack (Gatekeeper + XProtect) with FileVault full-disk encryption and
> immediate screen lock; compliance is verified per-device and recorded in our Asset &
> Endpoint Register. Production runs on managed container infrastructure whose image is
> rebuilt from source on every deploy — there are no mutable server instances on which
> endpoint agents would run.

### Q6 — BYOD

**Select:** Yes.
**Comment:**
> Yes — our two-person team works on personal devices governed by a documented BYOD standard
> (Information Security Policy §6): FileVault full-disk encryption, Gatekeeper/XProtect
> enabled, automatic OS and security updates, immediate screen lock, 2FA on all work
> accounts, no local storage of borrower data, immediate reporting with credential
> revocation on loss, and per-device compliance tracked in the Asset & Endpoint Register.

### Q7 — Defined process for controlling access to production assets and data

**Select:** Yes.
**Comment:**
> Yes — documented in our Access Control Policy (attached): least-privilege access held by
> two named individuals, 2FA required on every console, quarterly access reviews, and
> 24-hour revocation on departure. Production changes land only through pull requests gated
> by required CI checks, with branch protection enforced for administrators and a
> documented merge procedure (gate verified green before merge) that applies even if
> platform enforcement lapses; no standing production database credential exists
> (connection strings are minted at run time from a scoped API key). Within the
> application, every route enforces server-side role-based access control with per-resource
> ownership checks; sensitive PII (SSNs, account numbers) is stored write-only under
> field-level AES-256-GCM encryption, and staff access to it is audit-logged with actor,
> IP, and timestamp.

⚠️ *Accuracy note (2026-07-19): branch protection was silently dropped for ~2½ hours when
the repo was briefly made private (Free plan), then re-applied and probe-verified when it
went public again the same day — the answer above stays true because the documented
procedure backstops the platform control. The repo is currently **public** by founder
decision ("for now, pro later"); if it goes private again, GitHub Pro is required to keep
branch protection enforced, or this answer must be re-worded. See
[TEAM_PRACTICES](../../governance/TEAM_PRACTICES.md) §6 and the Asset Register.*

**Attach:** Access Control Policy PDF.

### Q8 — Strong authentication (2FA) on all critical assets

**Select:** **Yes** — valid **only after checklist §1a is fully done**. If asked before
then, the honest answer is "partially deployed"; do not submit early.
**Comment:**
> Yes — two-factor authentication (authenticator app or passkey) is required by our Access
> Control Policy and enabled on every console with access to source code, production
> infrastructure, or borrower data: GitHub, Railway, Neon, Google Workspace/Cloud, Anthropic,
> and ancillary vendor consoles, for both team members.

## 3. Attachments to export (after merge)

| Attach to | Document |
|---|---|
| Q2 | INFORMATION_SECURITY_POLICY.pdf (+ optionally INCIDENT_RESPONSE_PLAN.pdf) |
| Q3 | ASSET_REGISTER.pdf |
| Q7 | ACCESS_CONTROL_POLICY.pdf |

## 4. Ground rules

- The **founder/user submits the questionnaire** — these are company attestations.
- If Plaid's form offers an option set where none of the mapped selections is accurate,
  answer with the more conservative option and use the comment field; never select a
  stronger claim than the register supports on that day.
- Keep this doc updated if Plaid asks follow-ups — it is the single home for our
  vendor-security-questionnaire answers.
