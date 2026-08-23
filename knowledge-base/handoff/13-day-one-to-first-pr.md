# 13 — Day one to first PR

> **Freshness:** last verified 2026-08-23 · review every 30 days
> **Verified against** `origin/main` @ 6377727e · **Authoritative:**
> [DEVELOPER_PLAYBOOK §5](../handbook/DEVELOPER_PLAYBOOK.md),
> [app-guide 01](../handbook/app-guide/01-start-here.md),
> [LOCAL_DEV](../runbooks/LOCAL_DEV.md) and
> [TEAM_PRACTICES](../governance/TEAM_PRACTICES.md) — they win on conflict. This chapter walks
> the same path end to end with proofs and traps, on any machine, which none of them does alone.

## The mental model

You ship through a **gate you run yourself**, not past a guard someone else operates. `main`
deploys production on every merge, and the platform currently **requires nothing** before a merge
(zero required status checks — FACTS F-44, measured 2026-08-22): what stands between your first
diff and production is doctrine, the CI gate's evidence, and your own discipline in reading it.
Everything here follows from that: one isolated worktree per piece of work, the cheap checks run
locally before every push, evidence pasted — never summarized — into the PR body, and a squash
merge you make yourself once the gate is green. The repo is built so that a careful stranger can
do all of this on day one; this chapter is the walk.

## Explain it to a new hire

Your first day has eight steps: get the toolchain, get an env file, start the app with one
command, prove it is alive, arm the push gate, run the fast checks, make one small change on a
branch in its own worktree, and land it through a PR whose body shows your evidence. Your first
PR should be deliberately small — a characterisation test is the house-recommended zero-risk
first move ([prompts/new-test.md](prompts/new-test.md) exists exactly for this). By the end of
the day you have touched every mechanism the biggest change would use, and nothing you did
required anyone else's machine, memory, or permission — only their review time.

## Mechanism — the eight steps, with commands

Run everything from the repo root: `cd "$(git rev-parse --show-toplevel)"`.

**1 · Toolchain.** The repo pins its package manager in `package.json` (`"packageManager":
"pnpm@10.34.4"`) — `corepack enable` gives you exactly that pnpm from any Node install. The
declared Node target is `"engines": { "node": "24" }`; enforcement is advisory (this corpus's
2026-08-23 refresh ran green on v22.22.2), but new installs should match it.

**2 · Env.** `cp .env.example .env` and read the file you just copied — its comments are the
documentation. The only hard requirement is `DATABASE_URL`; a `localhost`/`127.0.0.1` URL makes
`server/db.ts` pick the standard `pg` driver automatically (fully local, offline, free).
`bash scripts/local-db.sh up` stands up that Postgres if you have none.

**3 · Run.** `bash scripts/dev-up.sh` — one command from fresh clone to running app on port
**5001** (`up` · `down` · `logs` · `status` subcommands; idempotent; it never overwrites values
already in your `.env`). It also **arms the pre-push gate as a side effect** — see step 5.

**4 · Prove it is alive.** `curl -s http://localhost:5001/api/health` → a JSON body whose
`commit` is `null`. **That null is the local-dev signature, not a defect** — only the deployed
container knows its commit. Log in with the seeded test seats via `http://localhost:5001/test-login`
after setting `DEV_TEST_PASSWORD=<anything>` in `.env` (`LOCAL_DEV.md:212`; the route 404s in
production builds).

**5 · Arm the gate.** `git config core.hooksPath .githooks` — the tracked pre-push hook then
runs the cheap half of CI (tsc + 8 guards, ~30 s) before every push. `scripts/dev-up.sh` does
this for you (it prints `armed the pre-push gate`), and `scripts/hooks-installed-guard.cjs`
checks it. A checkout with no `node_modules` gets a **loud warning and the push proceeds** —
the hook never blocks what it cannot check, so run step 6 yourself in that case.

**6 · The fast checks.** `pnpm install --frozen-lockfile`, then `pnpm check` (types),
`pnpm test` (both vitest lanes **plus** the collection floor — since #670 it fails if vitest
collects fewer files than exist on disk), and `pnpm checkup` (the read-only daily sweep, one
PASS/FAIL line per check). `pnpm preflight` mirrors the whole CI gate locally when you want the
full answer before pushing.

**7 · Branch, in a worktree.** One session = one isolated worktree = one branch
(TEAM_PRACTICES §4) — never work on a branch in the shared primary checkout:

```bash
HQ="$(git rev-parse --show-toplevel)"
git -C "$HQ" fetch origin
git -C "$HQ" worktree add "$HQ/../hq-<slug>" -b <type>/<slug> origin/main
cd "$HQ/../hq-<slug>" && pnpm install --frozen-lockfile && cp "$HQ/.env" .env
```

Worktree dev servers use port **5002** (`PORT=5002 bash scripts/dev-up.sh`). Code work claims
its target in [`../routines/REGISTER.md`](../routines/REGISTER.md) first and treats any file in
an open PR as claimed; docs-only work needs no claim (routines charter §9).

**8 · Land it.** Push, open the PR, and write the body to the TEAM_PRACTICES §5 contract:
verification evidence pasted from real output (integration claims name the port and carry the
`X-Forwarded-Proto: https` detail or they didn't happen), every new dependency justified (there
are none — §10's rule), a prod-impact note, and the **doc-sync line** — `docs updated: <files>`
or `no doc update required`; *silence is not a doc-sync statement*. Gate green → **squash
merge** (the author merges their own green PR; no required reviews) → delete the branch and the
worktree the same day. A merge to `main` is a production deploy; chapter 10 owns what happens
next.

## The facts, with receipts

| Fact | Receipt |
|---|---|
| pnpm is pinned at 10.34.4; Node target is 24 (advisory) | `package.json:6-9` |
| Primary checkout serves **5001**; worktrees **5002**; the staff-journey walker claims 5003; the app's own default with `PORT` unset is 5000 | `scripts/dev-up.sh:27`; `LOCAL_DEV.md`; routines charter §8 |
| The pre-push hook is 9 steps (tsc + 8 guards); unit lanes run only under `PREPUSH_TESTS=1` | `.githooks/pre-push`; chapter 07 |
| The CI `gate` job runs 18 named steps; `pnpm preflight` mirrors them locally (18 steps) | `ci.yml:107-548`; `scripts/preflight.sh` |
| `main` requires **zero** status checks (measured 2026-08-22); doctrine, not the platform, forbids direct pushes | FACTS F-44; chapter 07's status box |
| Merges are squash; branch + worktree deleted the same day they merge | TEAM_PRACTICES §6, §4 |
| `db:push` and `db:generate` are fuses that `exit 1` with the reason | `package.json:26,30`; chapter 03 |
| Evidence tiers T-1 → T3 grade what a run proves | [prompts/_RAILS.md](prompts/_RAILS.md) R14; chapters 07 and 12 |

## Prove it yourself

```bash
cd "$(git rev-parse --show-toplevel)" && git rev-parse --short HEAD   # any clean checkout of origin/main
# → 6377727e @ 6377727e
node -e "const p=require('./package.json');console.log(p.packageManager, p.engines.node)"
# → pnpm@10.34.4 24 @ 6377727e
bash scripts/dev-up.sh status
# → armed the pre-push gate (core.hooksPath -> .githooks) / not running on port 5001   (fresh clone, no server) @ 6377727e
git config core.hooksPath
# → .githooks   (dev-up armed it; empty means run the FIX line hooks-installed-guard prints) @ 6377727e
grep -c '^step ' .githooks/pre-push ; grep -c 'step "' scripts/preflight.sh
# → 9 / 18 @ 6377727e
sed -n '107,548p' .github/workflows/ci.yml | grep -c '^      - name:'
# → 18   (the gate job's named steps) @ 6377727e
grep -n 'PORT="${PORT:-5001}"' scripts/dev-up.sh
# → 27:PORT="${PORT:-5001}" @ 6377727e
curl -s http://localhost:5001/api/health
# → {"status":"ok","timestamp":"…","commit":null,…}   — needs the running dev server; commit:null IS the local signature
```

## Where this breaks

| Trap | Where | Caught by |
|---|---|---|
| Believing direct pushes are "blocked by branch protection". They are barred by doctrine; the platform blocks almost nothing (0 required checks, no required review). | FACTS F-44; `app-guide/01-start-here.md:62` carries the verified banner since #694 | Nothing automated — re-arming the required check is a standing founder decision. |
| A fresh worktree with no `pnpm install` resolves `node_modules` upward into the primary checkout and produces phantom `tsc` errors in files you never touched. | `../routines/LESSONS.md` | The pre-push hook's loud no-install warning; your own step-7 discipline. |
| A new server test file in neither vitest config used to be **silently never run**. | chapter 07's history of the stranded test | **Inverted into a control on 2026-08-23:** `pnpm test` is now the collection-floor guard (#670) and fails the run instead. |
| An untracked new `knowledge-base/**` doc blocks every push from that checkout — `kb-index-guard` walks the filesystem, not the git index. | `scripts/kb-index-guard.cjs`; the 2026-08-20 hygiene log | The guard itself — the fix is the index line, in the same commit (TEAM_PRACTICES §7). |
| Adding a colocated client test reddens `guard:ui` until `pnpm guard:ui --write-table` regenerates the adoption table, in its own commit. | README §"The five facts that bite hardest" row 4 | `guard:ui` — by design. |
| The app's bare default port is 5000 (also the integration lane's default `BASE_URL`), while humans run 5001/5002 — a probe against the wrong port measures a stale or absent server. | `server/app.ts`; `tests/setup.ts`; chapter 07 | Nothing — prove which process serves your port before trusting any measurement (`lsof`, process start time). |

## What we do not know

- **Whether the required status check gets re-armed** — a standing founder ⛔ (routines charter
  §18); until then step 8's gate is evidence you read, not a lock the platform holds.
- **Whether `dev-up.sh` runs unmodified on Windows** — every verified run has been macOS or
  Linux; WSL is the safe assumption, unverified.
- **How long a first PR actually takes a new hire** — this chapter's walk is untimed; the
  teach-back below is the only calibration until someone runs it for real.

## Analogy

A first shift in a professional kitchen. Mise en place before service (steps 1–6: toolchain,
env, running app, armed gate) — nobody cooks from a cold station. You own one station and leave
it clean (one worktree, deleted the day it merges). Every plate crosses the pass and the pass
tastes everything (the gate's 18 steps, your pasted evidence) — but here is the honest part: the
head chef's rule that nothing leaves the kitchen unchecked is a *rule of the house*, not a lock
on the door (zero required checks). Kitchens burn down when someone decides the rule is optional;
that is why the rule lives in writing, and why the log of who plated what is never blank.

## Teach-back checkpoint

1. A fresh worktree's `pnpm check` shows type errors in files you never touched. What happened,
   and what is the fix?
2. What single command takes a fresh clone to a running app, on which port — and what does its
   `/api/health` answer that a deployed one would not?
3. Your PR's gate is green. Name everything that still stands between it and production, and who
   does each part.
4. Which two lines must every PR body carry per the definition of done, and what does silence
   mean for the second?
5. You add `tests/foo.test.ts`, run `pnpm test`, and it passes without ever running your file.
   What do you conclude, and why is the answer different than it was before 2026-08-23?

Answers: [TEACHBACK_KEY.md §13](TEACHBACK_KEY.md).

## Go deeper

- [DEVELOPER_PLAYBOOK §5](../handbook/DEVELOPER_PLAYBOOK.md) — the ten-step quickstart this
  chapter walks with proofs; [LOCAL_DEV](../runbooks/LOCAL_DEV.md) — every local trap, measured.
- [Chapter 07](07-test-harness-and-ci-proof.md) — what each check proves and cannot see;
  [chapter 12](12-loop-safe-build-playbook.md) + [prompts/](prompts/) — the same discipline,
  packaged for loops.
- [TEAM_PRACTICES](../governance/TEAM_PRACTICES.md) — the definition of done and push policy
  this chapter's step 8 restates; [runbooks/CICD.md](../runbooks/CICD.md) — the ship pipeline
  after your merge.
