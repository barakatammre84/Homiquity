# Gating the public site — and taking it back off

The founder does this. **No routine and no session flips a production variable**
([CHARTER §8](../routines/CHARTER.md), and §1b grades it L3). What follows is the exact sequence,
written to be followed at the panel with nothing to work out.

## Which mechanism, and why this one

Three exist. As of 2026-08-18 the live Railway variable list has `PRELAUNCH_GATED` and
`VITE_PRELAUNCH_GATED` **already present** (values not readable from a session, but roadmap §1.1
records prod serving ungated pages, so they are off). `BETA_ACCESS_CODE` and `INTAKE_PAUSED` are
not set at all.

| Mechanism | What the public gets | Use it for |
|---|---|---|
| **`PRELAUNCH_GATED`** ← *this one* | The waitlist front door. Calculators still render. Email capture still works. The page still exists for crawlers. | "We're building; leave your email." |
| `BETA_ACCESS_CODE` | Nothing without the code (`server/middleware/betaGate.ts`). | A hosted beta for named testers. |
| `INTAKE_PAUSED` | Borrower-safe 503 (`server/services/maintenanceMode.ts`). | An incident. Stop everything now. |

The pre-launch gate is the one **built for this situation** and the only one already wired.

## Turning the gate ON

1. Railway → project **Homiquity** → service **Homiquity** → **Variables**, environment
   **production**.
2. Set **both**:
   ```
   PRELAUNCH_GATED=true
   VITE_PRELAUNCH_GATED=true
   ```
3. **Redeploy. A restart is not enough.** `VITE_PRELAUNCH_GATED` is compiled into the *client
   bundle* at build time — restarting the process re-runs the old bundle and the site stays
   ungated while the server thinks it is gated. This is CHARTER §8's warning, and it is the step
   people skip.
4. Verify from outside, against the **Railway host** — never `www` from an automated context; three
   cron sweeps died on that DNS on 2026-08-06:
   ```bash
   curl -s https://homiquity-production.up.railway.app/api/health | head -c 200
   curl -s https://homiquity-production.up.railway.app/ | grep -ci waitlist
   ```
   The health line's `commit` must equal `origin/main` HEAD, **or the deploy did not ship** — a
   failed Railway build leaves the previous container serving and every check stays green
   (2026-08-06: nine consecutive failed deploys, ~8 commits behind, undetected). A green check is
   not a shipped deploy. The `commit` field is the only proof.
5. Check `www.homiquity.com` by hand once, in a browser — it is the same app, and this is the one
   probe a human should do rather than a script.

## Turning it back OFF

Same panel, set both to `false` (or remove them), **redeploy**, then re-run step 4 — the `commit`
check matters more on the way out than on the way in, because an un-gating that silently did not
ship looks exactly like an un-gating that did.

## What gating does NOT do

- **It does not stop the cron sweeps.** `.github/workflows/cron-jobs.yml` keeps firing seven
  schedules a day at `/api/jobs/*`. That is usually what you want — lifecycle, letter expiry and
  task escalation keep running against real data — but know it is happening.
- **It does not pause the database or the bill.** Railway keeps charging, the trial credit keeps
  draining (roadmap KTLO-1, exhaustion estimated ~2026-09-05).
- **It does not undo anything already public.** Crawlers may hold the ungated pages for a while;
  search results can lag by days.
- **It is not a compliance control.** The licensed-state gate is separate and already live —
  `POST /api/loan-applications` answers 422 `UNLICENSED_STATE` outside Illinois, gated or not.

## Local is unaffected

`pnpm dev:up` never reads these variables unless you put them in your own `.env`. Gating
production has no effect on the local app, which is the whole point: the public sees a waitlist
while the full product runs on your machine ([LOCAL_DEV.md](./LOCAL_DEV.md)).
