# Homiquity — Lender Demo Video: Script & Storyboard

**Audience:** wholesale / TPO lender partners (UWM, Rocket Pro TPO, Plaza, Angel Oak, Newrez).
**Goal:** show the full end-to-end loop — *borrower → organized, standards-valid MISMO package → delivered to a wholesale lender* — and prove the platform is built and validated today.
**Format:** screen-capture (Loom / QuickTime / OBS) with voiceover. **Target runtime ≈ 5:45.**
**Companion asset:** `Homiquity_Lender_Demo.pptx` (same narrative arc, for live pitch or leave-behind).

---

## 0. Before you record

**Server & environment**
- Run the app locally: `pnpm dev` → http://localhost:5001 (worktree test servers use 5002).
  - *Gotcha:* if `pnpm` isn't on PATH, temporarily set `.claude/launch.json` to `npm run dev`, then revert before committing.
- Record on **dev**, where the full marketing site and authed surfaces render. In production the site is in **pre-license gated mode** (a stranger sees only education + waitlist until NMLS licensing lands), so don't record prod for the funnel.
- Sign in to authed surfaces via **`/test-login`** (dev only; 404s in prod). Use the role picker:
  - **Borrower** → the buyer demo account (`active_buyer`) for intake, pre-approval, documents.
  - **Loan Officer / Underwriter** → for the pipeline, the MISMO package, and lender submission.
- Use a **seeded demo application** so the file has data. Note its **application id** from the URL (e.g. `/loan-options/<id>`) — several staff routes need it.

**Screen hygiene (must-do)**
- **Never show `DEV_TEST_PASSWORD`** or any real credential on screen — type it off-frame or paste, and trim that moment.
- SSNs already display as **last-4 only** (vault) — that's expected; don't reveal full PII anywhere.
- Use demo/test names and emails; blur anything that looks like a real person if unsure.
- 1920×1080 capture, browser at 100% zoom, clean tab bar, notifications off.

**Narration honesty rails (say these accurately)**
- Licensing is **in progress** — frame the platform as *credential-ready*, not licensed.
- Credit, DU/LPA, AVM, and lender submission run as **deterministic simulations behind production adapters** today; they **switch to live the day we're credentialed** — the seam is already built. Present this as a *strength* (fast onboarding), never claim a live vendor call.
- The engine **validates**, it does not **approve**; **AI extracts and structures, it never decides.** Don't say "approved" or "qualified."

---

## Scene-by-scene

### Scene 1 — Cold open: who we are  ·  ~0:00–0:20
| | |
|---|---|
| **Screen / route** | Landing `/` (dev) |
| **Role** | Logged out |
| **On-screen** | Slow scroll of the hero + one persona section. |
| **Narration (VO)** | "Getting a mortgage is slow and opaque because the borrower's file is a mess no two parties see the same way. Homiquity is a digital mortgage brokerage that turns a borrower's raw inputs into one organized, lender-ready package — and delivers it straight to a wholesale lender." |
| **Capture** | Title-card overlay: *Homiquity — a digital mortgage brokerage.* |

### Scene 2 — Acquisition: we feed you borrowers  ·  ~0:20–1:00
| | |
|---|---|
| **Screen / route** | `/first-time-buyer` → `/va-loans` → `/calculators` → `/approval-strength` |
| **Role** | Logged out |
| **On-screen** | Click through two persona landing pages; open the calculators hub; open Approval Strength. |
| **Narration (VO)** | "The top of the funnel is purpose-built. Persona landing pages for first-time buyers, VA, self-employed, and refinance; an SEO and education engine that ranks; and a suite of nine calculators plus an Approval Strength tool that turn browsers into consented applicants. That's qualified volume you didn't have to source." |
| **Capture** | Overlay chips: *Persona LPs · SEO engine · 9 calculators.* |

### Scene 3 — Intake: a consented, complete application  ·  ~1:00–1:50
| | |
|---|---|
| **Screen / route** | `/test-login` (Borrower) → `/dashboard` → `/onboarding` → `/urla-form` |
| **Role** | Borrower |
| **On-screen** | Sign in off-frame; land on the borrower dashboard; step into onboarding; show the URLA (1003) form. |
| **Narration (VO)** | "A borrower signs in and starts intake. We capture a complete, consented URLA — the 1003 — and the TRID clock starts at exactly the six application pieces, not a moment sooner or later. Along the way, AI coaching structures and completes the file — it extracts and organizes, it never decides." |
| **Capture** | Overlay: *Consented URLA · TRID at the six pieces · AI = extraction only.* Trim the sign-in keystrokes. |

### Scene 4 — Documents & verification  ·  ~1:50–2:20
| | |
|---|---|
| **Screen / route** | `/documents` → `/verification` → `/identity-verification` |
| **Role** | Borrower |
| **On-screen** | Show the document checklist, asset/income verification, and identity verification states. |
| **Narration (VO)** | "Documents, assets, income, and identity come together in one place. Asset and income verification and the tax-return insight pipeline are wired and ready — running behind production adapters today, live the day we're credentialed." |
| **Capture** | Overlay: *Verified file, one place.* |

### Scene 5 — The instant pre-approval read  ·  ~2:20–3:05
| | |
|---|---|
| **Screen / route** | `/apply` (PreApproval) → `/application-summary` |
| **Role** | Borrower |
| **On-screen** | Show the pre-approval read / application summary — numbers resolving in-session. |
| **Narration (VO)** | "Here's the difference: an instant, deterministic pre-approval read. Same inputs, same outcome — no black box deciding who qualifies. Affordability, DTI, and credit-tier math resolve in one session, ambiguity routes to a human, and there's no adverse action without the required notice. The borrower finally knows where they stand." |
| **Capture** | Overlay: *Deterministic · AI-free · Auditable.* |

### Scene 6 — Options & pricing  ·  ~3:05–3:35
| | |
|---|---|
| **Screen / route** | `/loan-options/<id>` → `/compare-offers/<id>` → `/loan-estimate/<id>` |
| **Role** | Borrower |
| **On-screen** | Walk the loan options, the side-by-side compare, and a Loan Estimate. |
| **Narration (VO)** | "Options are presented cleanly, with LLPA-aware pricing computed against agency grids — cited, not guessed — and every rate carries its Reg Z disclosures. The borrower can compare, side by side, in plain language." |
| **Capture** | Overlay: *LLPA-aware · Reg Z disclosures on every rate.* |

### Scene 7 — Staff view: the pipeline  ·  ~3:35–4:05
| | |
|---|---|
| **Screen / route** | `/test-login` (Loan Officer) → `/staff-dashboard` → `/pipeline-queue` → `/lo-command-center` |
| **Role** | Loan Officer / staff |
| **On-screen** | Switch accounts; show the staff dashboard, the pipeline queue, and the LO Command Center with the demo file. |
| **Narration (VO)** | "Now the lender's-eye view. Staff open a pipeline with role-accurate gates. Here's our demo borrower's file, ready to work." |
| **Capture** | Overlay: *Role-gated pipeline.* Trim the account switch. |

### Scene 8 — The lender-ready package: MISMO export  ·  ~4:05–4:45
| | |
|---|---|
| **Screen / route** | `/borrower-file/<id>` → click **Export MISMO** |
| **Role** | Loan Officer / staff |
| **On-screen** | Open the borrower file; click **Export MISMO**; open the downloaded `mismo-<id>.xml` and scroll a few elements. |
| **Narration (VO)** | "One click produces a MISMO 3.4, ULDD-Phase-5-valid package — the format your systems ingest. Behind it: QM points-and-fees pre-flighted against the note-date thresholds, the anti-steering disclosure under Reg Z, Special Feature Codes derived and validated as a set, and your UCD, ULDD, and EarlyCheck delivery edits run as a lender's-eye pre-check — before you ever see the file." |
| **Capture** | Overlay: *MISMO 3.4 / ULDD · QM · anti-steering · edit-mirror pre-flight.* Show the XML briefly, don't dwell. |

### Scene 9 — Delivery: readiness gate + lender submission  ·  ~4:45–5:25
| | |
|---|---|
| **Screen / route** | `/lo-command-center` → open the **Submission Readiness** dialog |
| **Role** | Loan Officer / staff |
| **On-screen** | Open the readiness dialog; show the four stages — **File intake & disclosures · Automated underwriting (DU + LPA) · Wholesale lender package · Delivery pre-flight (lender's-eye view)** — click **Run DU / LPA** to clear stage 2 (the gate requires a recorded AUS run) — then the submit action, the Target-5 lender list, and the status flow. |
| **Narration (VO)** | "Delivery is gated. The file can't be submitted until intake, automated underwriting, and the lender package are all clean. Then we submit to a wholesale partner — and track it through a real status machine, from submitted to acknowledged to underwriting to clear-to-close to funded. Every submission carries a snapshot of exactly what we believed about the file when we sent it. The submission adapter is a simulation until a broker agreement exists — and it goes live the day you credential us." |
| **Capture** | Overlay: *Readiness-gated · Target-5 · full status machine.* |

### Scene 10 — Compliance & audit  ·  ~5:25–5:40
| | |
|---|---|
| **Screen / route** | `/compliance` |
| **Role** | Loan Officer / staff |
| **On-screen** | Brief pass over the compliance/audit surface. |
| **Narration (VO)** | "All of it is compliance-first: a deterministic engine, PII in a vault as ciphertext and last-four, and an audit log on every action. MISMO and NMLS terminology is grounded in the official specs — never invented." |
| **Capture** | Overlay: *Deterministic · PII vault · audit everywhere.* |

### Scene 11 — The ask  ·  ~5:40–5:55
| | |
|---|---|
| **Screen / route** | Return to `/` (or cut to the deck's closing "ask" slide) |
| **Role** | — |
| **On-screen** | Clean brand frame. |
| **Narration (VO)** | "The platform is built and validated end to end. We're completing NMLS licensing now, and the integration seams are already in place — going live is configuration, not a rebuild. Credential us on your TPO channel, and let's run a live pilot the day it clears." |
| **Capture** | End card: *Homiquity Mortgage Corporation · Credential us on your TPO channel · support@homiquity.com · [contact — TODO].* Veteran-founded mark. |

---

## Post-production notes
- **Captions/overlays:** keep the lower-third overlays from each scene's *Capture* row — they carry the claim while the VO moves on.
- **Trim:** every sign-in and account switch (Scenes 3, 7). Never leave a password frame in.
- **Pace:** 1.0–1.1× on the click-throughs; pause on Scene 5 (the read) and Scene 8 (the MISMO XML) — those are the "aha" beats.
- **Music:** low, neutral, corporate — under the VO.
- **Export:** 1080p, MP4/H.264. Keep a captioned and a clean cut.
- **Honesty check before publishing:** scrub the VO for the words "approved," "qualified," or any live-vendor claim — replace with "validated / pre-approval read / behind a production adapter." Confirm no NMLS number is shown (it prints only once issued).

## One-page shot checklist
1. `/` hero — 2. `/first-time-buyer`, `/va-loans`, `/calculators`, `/approval-strength` — 3. `/test-login`→Borrower, `/dashboard`, `/onboarding`, `/urla-form` — 4. `/documents`, `/verification`, `/identity-verification` — 5. `/apply`, `/application-summary` — 6. `/loan-options/<id>`, `/compare-offers/<id>`, `/loan-estimate/<id>` — 7. `/test-login`→LO, `/staff-dashboard`, `/pipeline-queue`, `/lo-command-center` — 8. `/borrower-file/<id>` → **Export MISMO** → open XML — 9. `/lo-command-center` → Submission Readiness dialog → **Run DU / LPA** → submit → status — 10. `/compliance` — 11. `/` end card.
