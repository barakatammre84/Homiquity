# Archive

Factually obsolete documents retained for history. **Never act on anything in this
directory.** Each file carries a dated banner explaining why it was archived and where the
current truth lives.

Archival rule (from the root [README.md](../../README.md) doc tiers): a document is
archived — not deleted, not silently rewritten — when the world it describes no longer
exists (platform migration, superseded process). Dated *snapshots* that are merely old but
still describe this platform stay in `kb/` with a status banner instead.

**2026-07-08 batch quarantine (deliberate exception to the rule above).** The launch-era
operational logs below — founder-routines, lo-audit, and one-time platform assessments
(2026-07-02 → 07-06) — still describe *this* platform, so by the default rule they would
stay in `kb/` with banners. They were archived in bulk anyway, on explicit founder
authorization, to keep the active knowledge base lean for readers and LLM context. Their
dated findings are preserved verbatim under the new paths (each file carries an ARCHIVED
banner); any still-live follow-up was migrated out first — e.g. the status-vocabulary prod
migration reminder → CTO_ROADMAP **CH-8**. These snapshots form a referential chain (later
runs cite earlier ones), which is why they moved as one unit rather than piecemeal.

| File | Archived | Why |
|---|---|---|
| [roadmap/CTO_ROADMAP_2026-08-23.md](./roadmap/CTO_ROADMAP_2026-08-23.md) | 2026-08-23 | The launch-queue roadmap, whole, at `c8bb44f`. Rewritten on the founder's development-first directive (CHARTER §1a, 2026-08-23): the Selling Guide became the base of the roadmap and the launch-shaped partition ("blocks go-live" / "launch-blocking" / "post-flip" / "do NOT start") was withdrawn; business events moved to one founder lane that never gates engineering. Every open item migrated to the successor; three corrections are recorded in its banner rather than applied |
| [PRE_PRODUCTION_OPS_ROUTINES.md](./PRE_PRODUCTION_OPS_ROUTINES.md) | 2026-08-23 | The founder's 2026-07-04 pre-launch operating doctrine, built around the 5-routine launch suite (with GTM and lender-sales business routines) that stopped running 2026-07-04 and never resumed (CHARTER §0). The live operating doctrine is CHARTER §1–§3a and the Guide-keyed CTO_ROADMAP; the launch-suite framing contradicts the 2026-08-23 development-first directive |
| [roadmap/CTO_ROADMAP_2026-08-06.md](./roadmap/CTO_ROADMAP_2026-08-06.md) | 2026-08-06 | The pre-rewrite roadmap, whole: 79 closed items with their closure reasoning, plus the two frozen status boxes. The live file was rewritten as a lean launch queue (96 KB → 17 KB) because ~71% of its bytes were narratives about finished work and the open items had become unfindable. Four corrections are recorded in its banner rather than applied to the text |
| [ux-audit/](./ux-audit/) | 2026-08-06 | The UX daily-loop routine is dead (last run 2026-07-16). It also sat under `logs/`, declared immutable, while describing a routine that rewrote its own artifacts daily. Its own exec-summary names the successor: `feature-review/FINDINGS.md` |
| [LAUNCH_READINESS_CHECKLIST.md](./LAUNCH_READINESS_CHECKLIST.md) | 2026-07-04 | Feb-2026 Replit-era checklist; superseded by the CTO_ROADMAP.md launch sprint |
| [INFRASTRUCTURE_RISKS.md](./INFRASTRUCTURE_RISKS.md) | 2026-07-04 | Feb-2026 findings since fixed (fail-closed encryption, versioned migrations) |
| [founder-routines/](./founder-routines/) | 2026-07-08 | Launch-sprint daily C-suite routine runs (07-04 → 07-06); superseded by CTO_ROADMAP + later runs |
| [lo-audit/](./lo-audit/) | 2026-07-08 | Nightly LO workflow audits (07-03 → 07-04-pm); findings closed/reframed in CTO_ROADMAP |
| [assessments/](./assessments/) | 2026-07-08 | One-time platform/lender/UI audits (07-02 → 07-03); superseded by CTO_ROADMAP |
