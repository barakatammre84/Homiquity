# Routine reports

Dated, immutable run reports: `<YYYY-MM-DD>-<routine-id>.md`.

Format and required sections: [`../CHARTER.md`](../CHARTER.md) §9. Every report ends with
`STATUS: OK|WARN|FAIL`.

**These are the proof-of-life record.** Evening Triage counts the day's expected reports against
those actually present and names every routine that did not run — because the previous suite went
silent for five weeks and nothing noticed ([`../CHARTER.md`](../CHARTER.md) §0). A missing report is
a `WARN` with the routine named, never a shrug.

Like [`../../logs/`](../../logs/), these go stale the moment they are written. They record what was
true at run time. **Verify any "X is broken" or "Y is missing" claim against the code before acting
on it.**
