# Escalation playbook: discrimination or credit-reporting-error complaints

**Status: rehearsal asset.** No live borrowers yet. ⛔ **This entire file requires founder/legal signoff before any of its scripted copy is used with a real borrower** — it is denial-adjacent and Reg B/ECOA-sensitive.

## Why this file exists

The task doctrine for this routine requires that "complaints alleging discrimination or credit-reporting errors get a defined escalation (immediate founder + Compliance Executive visibility) — if undefined, define it in the escalation playbook today." As of 2026-07-04 this escalation path was **undefined in code and in prior playbooks** — this file defines it.

## Trigger

Any borrower communication containing language like: "discriminated," "unfair," "why was I denied because of [protected class]," "my credit report is wrong," "this score isn't mine," "I want to dispute this decision," or any variation directed at the reason(s) stated on an Adverse Action Notice (AAN).

## What exists in code today (verified)

- The AAN page (`client/src/pages/borrower/AdverseActionNotice.tsx`) renders the staff-authored `noticeText`, which unconditionally includes the ECOA notice + creditor identity + administering federal agency (`server/services/creditService.ts:1014-1028`), and — only when the action was actually based on a consumer report — the FCRA free-report/dispute-rights language + bureau contact block (`server/services/creditService.ts:984-1006`, gated correctly so a self-reported-data denial never falsely claims a bureau report was used).
- There is **no dedicated, routed "complaint" or "discrimination report" form** anywhere in the app. The only in-app contact surfaces today are: (1) the borrower↔staff 1:1 message thread (`POST /api/messages`, `server/routes/borrower.ts:2607`), which requires the borrower to already have an assigned team member, and (2) static `mailto:` links on the public Privacy/Terms/Disclosures pages (`compliance@homiquity.com`, `legal@homiquity.com`, `privacy@homiquity.com`, `support@homiquity.com` — see `server/config/company.ts:6`).
- **Neither surface has special routing or flagging for discrimination/credit-error content.** A message like this today lands in the assigned LO's normal inbox with no different priority, no founder visibility, and no compliance flag. This is the gap this playbook closes procedurally until engineering builds an automated flag (see ticket below).

## First response (exact copy — ⛔ pending signoff)

> Thank you for telling us this — I want to make sure it's handled correctly. I'm not able to discuss or add to the reasons stated on your notice myself, but I'm escalating this immediately to our compliance and leadership team, and someone will follow up with you directly. In the meantime, your notice includes your right to dispute inaccurate information with the credit bureau listed, and to request a free copy of your report within 60 days.

## What to check in the app

- Locate the specific AAN in question via `/adverse-action/:id` on the borrower's application and read the exact `primaryReason` / `secondaryReasons` / `noticeText` that was actually delivered — never guess or restate reasons from memory.
- Confirm whether the complaint is about (a) the *stated reason itself* (discrimination claim) or (b) the *underlying data* (credit-reporting error) — both route the same way below, but knowing which helps the founder prep.
- Do not open, forward, or reply substantively to the message yourself beyond the scripted acknowledgment above.

## Escalation line (mandatory, immediate — not end-of-day)

1. Do not respond further in the borrower's own words. Use only the scripted acknowledgment above (once signed off) or a plainer variant approved by the founder.
2. Immediately notify the founder directly (this IS the founder — no separate Compliance Executive role exists at this company size; the same person carries both hats).
3. Log the complaint verbatim (borrower's own words, timestamp, application ID, AAN ID if applicable) — do not summarize or paraphrase in the log.
4. Never re-litigate, embellish, add to, or speculate beyond the reasons already stated on the notice. An improvised extra reason or justification offered in a support conversation is itself a Reg B compliance incident, independent of whether the original decision was correct.
5. This category of complaint is a launch-readiness signal, not routine support volume — it should surface in the next Chief-of-Staff triage regardless of when in the day it happens.

## Compliance rail this must never cross

Support/CS never adjudicates, explains away, or adds context to an adverse-action reason. The AAN's stated reasons are the only reasons that may ever be given to the borrower about that decision — full stop. Any request to "just explain more" gets the scripted deflection above and a founder escalation, never an improvised answer.

## Remediation ticket (see CTO_ROADMAP.md)

No code currently flags or specially routes discrimination/credit-error language in borrower messages — today it relies entirely on a human reading normal support inbox traffic and recognizing the trigger phrases above. A P1 ticket for an automated keyword/sentiment flag + founder notification on the messages send path has been added to CTO_ROADMAP.md.
