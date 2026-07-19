# Asset & Endpoint Register

**Company:** Homiquity Mortgage Corporation (NMLS #427468) · **Owner:** Founder/CEO (Security Owner)
**Review cadence:** quarterly and at any access change · **Last review:** 2026-07-17
**Authority:** [Information Security Policy](INFORMATION_SECURITY_POLICY.md) §§6–7; builds on the assets section of the [threat model](../../compliance/security/threat_model.md).

Legend: ✅ verified · ⬜ action open (tracked in the
[pre-submit checklist](PLAID_SECURITY_QUESTIONNAIRE_ANSWERS.md)) · — not applicable.

## 1. Production & service assets

All production infrastructure is managed cloud — there are **no self-managed server
instances** anywhere. Access = which of the two team members hold console seats.

| Service | Purpose | Data touched | Access | 2FA |
|---|---|---|---|---|
| Vercel | Application hosting (serverless), env secrets, deploys | Application traffic; runtime logs (response bodies allowlisted) | 2 | ⬜ enable |
| Neon | Production PostgreSQL (managed; TLS; point-in-time recovery) | All application records; Restricted fields encrypted at field level (AES-256-GCM) | 2 | ⬜ enable |
| GitHub | Source (private repo), CI (Actions), `NEON_API_KEY` secret — no enforced branch protection (Free-plan private repo; merge gate is procedural, [TEAM_PRACTICES](../TEAM_PRACTICES.md) §6) | Source code; no borrower data | 2 | ⬜ enable |
| Google Workspace | Company email / identity | Business communications | 2 | ⬜ enable |
| Google Cloud (GCS + optional KMS) | Borrower document storage (private bucket, presigned access); optional envelope-encryption KEK | Restricted documents | Service account via Vercel env; console: 1–2 | ⬜ enable |
| Anthropic Console | AI API keys (document extraction, AI Coach) | Prompt context may include borrower data — governed by the [AI Governance Policy](../AI_GOVERNANCE_POLICY.md) | 2 | ⬜ enable |
| RapidAPI | Property data / AVM vendor proxy | Property addresses (no borrower identity) | 1–2 | ⬜ enable |
| Error monitoring (Sentry) | Optional — active only if `SENTRY_DSN` is set | Error metadata (logging allowlist applies) | founder confirm | founder confirm |
| Email delivery (SendGrid/SMTP) | Optional — notifications disabled when unset | Notification content | founder confirm | founder confirm |
| Plaid Dashboard | Pending clearance — no keys issued yet | (future) asset/income data; access tokens will be stored encrypted (`piiVault`) | 2 at issuance | ⬜ enable at issuance |
| DNS / domain registrar (homiquity.com) | Control plane only | None | founder | founder confirm |

Credit bureaus, AUS (DU), and AVM vendors beyond the above run as **deterministic
simulations behind adapters** — no live credentials exist for them (see
[CLAUDE.md](../../../CLAUDE.md) architecture ground rules).

## 2. Corporate endpoints (BYOD laptops)

The complete corporate endpoint inventory is two laptops. Compliance columns per the
[BYOD standard](INFORMATION_SECURITY_POLICY.md#6-endpoint--byod-standard).

| Device | User | FileVault | Gatekeeper / XProtect | Auto OS + security updates | Screen lock | Verified |
|---|---|---|---|---|---|---|
| MacBook — macOS 26.5.2 | Developer | ✅ On | ✅ Enabled (XProtect config v5323) | ✅ On (incl. config-data + critical updates) | ✅ Immediate | 2026-07-17 (command audit) |
| Founder laptop | Founder/CEO | ⬜ verify | ⬜ verify | ⬜ verify | ⬜ verify | pending |

**Verification block** — run in Terminal on the device, then record results above:

```bash
fdesetup status                # expect: FileVault is On.
spctl --status                 # expect: assessments enabled
defaults read /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates   # expect: 1
defaults read /Library/Preferences/com.apple.SoftwareUpdate CriticalUpdateInstall              # expect: 1
sysadminctl -screenLock status # expect: immediate (or ≤ 5 seconds)
sw_vers                        # record OS version
```

## 3. Network posture

There is no corporate office network, VPN, or LAN — Homiquity is a fully remote two-person
company. Every asset in §1 is an independently authenticated cloud endpoint reached over
TLS; there is no flat internal network to traverse and no SSH surface. New network endpoints
cannot silently join production: the serverless platform exposes no instance provisioning to
us, and corporate endpoints are limited to the enumerated devices in §2.

## 4. Data locations

| Location | Contents | Control |
|---|---|---|
| Neon production database | All application records | Restricted fields encrypted (AES-256-GCM, versioned keys); TLS; PITR |
| Neon database branches (dev/preview) | Development/preview copies under the same Neon project | Access limited to the same two authorized operators |
| GCS bucket | Borrower-uploaded documents | Private; presigned, ACL-checked access; 10 MB upload cap + server-side content-type re-verification |
| Vercel | Env secrets; runtime logs | Response-body logging allowlisted; secrets scoped per environment |
| Endpoints (§2) | **No borrower PII stored locally** (policy §6) | FileVault + BYOD standard |

## 5. Review

Quarterly, owned by the Security Owner: re-verify §2 devices, re-confirm every §1 seat and
2FA status, and prune anything no longer needed. Update the **Last review** date above.
