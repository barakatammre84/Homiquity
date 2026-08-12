# Orphan-branch triage — 2026-08-06

**Status:** decision doc. No code has been moved. Every branch below is preserved
as a pushed tag (`archive/<branch-name>`), so nothing here can be lost by deleting
the branch.

## Why this exists

Parallel sessions across the Vercel→Railway cutover left four cloud-session
branches with unmerged commits and **no pull request**. They were invisible to
`gh pr list`, so a PR-based cleanup would have silently discarded them. This
document says what is on each one, what is already redundant, and what is worth
recovering.

| Branch | Commits ahead | Tag | Recommendation |
|---|---|---|---|
| `claude/determined-mccarthy-xyq4f8` | 73 | `archive/claude-determined-mccarthy-xyq4f8` | **Cherry-pick ~10 fixes; abandon the rest** |
| `claude/determined-mccarthy-we8h69` | 6 | `archive/claude-determined-mccarthy-we8h69` | **Keep — land after rebase** |
| `claude/determined-mccarthy-7ga80s` | 6 | `archive/claude-determined-mccarthy-7ga80s` | **Abandon; salvage 2 files** |
| `claude/determined-mccarthy-ykguyg` | 1 | `archive/claude-determined-mccarthy-ykguyg` | ~~Land as-is~~ → **DO NOT LAND — superseded, would regress** |

---

## 1. `xyq4f8` — 73 commits, and why it must not be rebased

### The headline number is misleading

The three-dot diff reports **394 files / +34,663 / −22,654**, which reads like a
enormous body of lost work. It is not. That diff compares the *merge-base* to the
branch, so it counts work that has since landed on `main` by other routes.

Measured properly: **159 of those 394 files (40%) are already byte-identical on
`main`.** The branch's merge-base is `d8d39b7` (#375); `main` has advanced ~130
commits since.

Worked example — `fix(hmda): stop submitting demographic answers the applicant
retracted` (`121e720`) looks like a compliance-critical orphan. It is not: `main`
already carries the whole `client/src/pages/borrower/hmda/` module *and* the
clearing logic, byte-identical. It landed via another PR.

### Two hard blockers against rebasing the branch wholesale

1. **It predates the Railway cutover.** It still carries `api/index.ts`, the
   Vercel serverless entrypoint that #424 deliberately deleted along with the rest
   of the Vercel platform surface. Rebasing re-introduces a dead platform's
   scaffolding.
2. **Its migration number is already taken.** The branch adds
   `migrations/0046_policy_profiles_unique_version.sql`, but `main`'s `0046` is
   `0046_document_borrower_description.sql` and the journal is at **0052**. The
   file would need renumbering to `0054`+ with a matching `_journal.json` entry.

Combined with ~35 mechanical "split `X.tsx` into a module" commits that collide
with everything else in flight, a full rebase is a high-conflict, low-yield
exercise. **Do not rebase it.**

### What is actually worth recovering

The 73 commits split into two classes: ~21 genuine bug fixes and ~35 mechanical
file-splitting refactors. The refactors are the conflict surface and carry no
behaviour; the fixes are the value.

Each fix below was classified by whether every file it touched is byte-identical
between `main` and the branch. **That is a proxy, not proof** — `main` moved 130
commits, so a file can differ for unrelated reasons. Two were therefore verified
by reading `main`'s current source, and **both are confirmed live defects**:

**Confirmed still broken on `main` today:**

- **`135010e` — staff can only verify the *last* document on a task.**
  [`TaskDetail.tsx:360`](../../client/src/pages/borrower/TaskDetail.tsx) and
  `:373` both act on `task.documents?.[task.documents.length - 1]`, for Approve
  *and* Reject. On any multi-upload task — "2 years of tax returns" is the normal
  shape — the earlier documents can never be verified, while the card instructs
  the reviewer to "verify or reject them". The API has always taken a `docId`;
  only the UI collapses the choice. **Highest-value single fix on the branch.**
- **`33080c7` — Plaid Link is opened from the render body.**
  [`Verification.tsx:173`](../../client/src/pages/borrower/Verification.tsx) runs
  `setIsLoading(true); open();` directly in render. `open()` is a side effect;
  React may discard a render, and StrictMode double-renders, so the modal can be
  launched for a render that never commits, or launched twice. Note
  `PlaidConnectButton.tsx:117` already does this correctly with `useEffect` + a
  ref — so the codebase contains both the right and wrong pattern for the same
  vendor.

**Classified OUTSTANDING (files differ; bug not individually verified):**
`a96d5b8` five mutations that fail in silence · `1de88da` four buttons with no
handler · `f53449b` policy console claims saves it never made · `21fa394` Loan
Estimate Print/Download PDF buttons · `e794c47` document progress never reaches
100% · `0464663` bare "0" on the staff Credit tab · `5c90fbe` optional
verifications counted toward the required total · `ead8f03` failed credit-consent
POST leaves the authorize button stuck · `7f199e3` DPA claims directory coverage
after a failed load · `44a79c5` AI-coach renders a failed load as "no history" ·
`a90a473` four more surfaces render failure as emptiness · `6d7a9db` formatting
absent dates (18 files) · `65278ec` uncancellable KYC re-poll timers · `032d427`
saved-properties stubbed but never wired · `4bd933b` policy threshold editor not
wired to its existing API · `c476a31` agent contact + three policy-console actions.

**Already landed:** `121e720` (HMDA). **Partially landed:** `9d01848` (SLA badge
Tailwind interpolation, 1/3 files), `0bad483` (a11y back-button label, 1/2).

### Recommended action for `xyq4f8`

Cherry-pick the two confirmed fixes first as small independent PRs, then work
down the OUTSTANDING list *verifying each against `main` before porting* — several
will turn out to be already-fixed, as HMDA was. Abandon all `Refactor X.tsx` /
`Split X.tsx` commits; `main` has since restructured much of that surface anyway.
Then delete the branch — the tag preserves it.

---

## 2. `we8h69` vs `7ga80s` — divergent siblings, cannot both land

These two branches refactor the **same files different ways**. Five files are
touched by both, and **all five conflict**:

```
client/src/pages/admin/AdminUsers.tsx          CONFLICTING
client/src/pages/admin/adminUsers/types.ts     CONFLICTING
client/src/pages/lending/PreApproval.tsx       CONFLICTING
knowledge-base/governance/TEAM_PRACTICES.md    CONFLICTING
tests/creditConsentScope.test.ts               CONFLICTING
```

They even split the same page into differently-named modules — `StepInput.tsx`
(7ga80s) vs `StepInputs.tsx` + `FunnelShell.tsx` + `choiceAnswers.ts` (we8h69),
and `InviteDialog`/`InvitesTable`/`RoleDialog`/`UserStatsGrid` (7ga80s) vs
`CreateInviteDialog`/`StaffInvitesCard`/`ChangeRoleDialog`/`UserStatsCards`
(we8h69). Landing both would leave two parallel module trees for one page.

### Recommendation: keep `we8h69`

It is strictly the more valuable branch, because only it carries work that is not
a refactor:

- **A verified, still-live auth defect.** `ROUTE_GATES.partnerHub` admits `cpa`
  ([`routeGates.ts:82`](../../client/src/lib/routeGates.ts)) while
  `GET /api/partners/me` and `/me/referrals` are
  `requireRole("realtor", "admin")`
  ([`partners.ts:200`](../../server/routes/partners.ts)). A CPA who reaches
  `/partners/hub` renders a page whose every data call 403s. **Confirmed present
  on `main` as of this writing.** The commit also deletes four unreachable in-page
  `role !== "admin"` branches (all `/admin/*` routes already gate via
  `<AdminPage>` → `PrivateLayout`), and carries its §9 security review in the
  commit body.
- **The Railway platform documentation correction** — `CLAUDE.md`,
  `CTO_ROADMAP.md`, and `BETA_GO_LIVE_READINESS.md` still describing the old
  deploy target. Directly relevant to the cutover just completed.
- Extensions to `scripts/security-review-guard.cjs` + `tests/routeGateDrift.test.ts`.

**Action:** rebase `we8h69` onto `main`, drop or re-derive the `AdminUsers` /
`PreApproval` refactors if they conflict with anything newer, and land it — ideally
splitting the auth fix and the docs correction into separate PRs, since the auth
fix is a §9-triggering change that deserves review on its own.

### Salvage from `7ga80s` before abandoning

Two files are unique to it and unrelated to the conflicting refactors:

- `.agents/memory/urla-form-refactor-trap.md` — a recorded refactor trap. Note it
  is written to `.agents/memory/`, which is **not** where this repo keeps
  knowledge (`knowledge-base/`). Relocate the content rather than the file.
- `client/src/components/scenarioSimulator/*` — a ScenarioSimulatorDialog split
  that `we8h69` does not touch, so it does not conflict.

---

## 3. `ykguyg` — DO NOT LAND. Superseded, and it would regress.

> **Corrected after first publication.** This section originally read "1 commit,
> land as-is — lowest-risk of the four". That was wrong, and it is a useful kind
> of wrong: the recommendation was made from commit shape (one clean commit, no
> overlap with the sibling branches) without applying this document's *own* rule —
> measure how much already landed — to a branch small enough to look obviously
> safe. **Apply that rule to the small branches too.**

`refactor(staff): separate TaskOperations UI from data/business logic`, splitting
`TaskOperations.tsx` into a `taskOperations/` module. **All six of its module
files are already on `main`** — five byte-identical. The work landed by another
route.

The sixth, `useTaskOperations.ts`, is **newer on `main`**, and that is what makes
landing the branch actively harmful rather than merely redundant. `main` uses the
`taskEngineKeys` factory; the branch hardcodes query-key strings:

| | `main` (current) | `ykguyg` (would overwrite) |
|---|---|---|
| fetch key | `taskEngineKeys.metrics()` | `["/api/task-engine/metrics"]` |
| invalidation | `taskEngineKeys.all()` | `["/api/task-engine"]` |

That invalidation is not just stylistically worse — it is **dead**.
`partialMatchKey` is element-wise, not string-prefix, so `["/api/task-engine"]`
**never matches** `["/api/task-engine/metrics"]`. Landing this would silently
reintroduce exactly the class of bug the query-key factory and its guards exist to
prevent: mutations appear to succeed, the cache never clears, and the stale UI
looks like a backend fault.

**Branch deleted.** Tag `archive/claude-determined-mccarthy-ykguyg` (`b01f2c2`)
retains it. Nothing needs salvaging from it.

---

## Recovery

Every branch is tagged and the tags are pushed:

```bash
git fetch origin --tags
git checkout -b recover archive/claude-determined-mccarthy-xyq4f8
```

### 🚨 A tag is only as current as the moment it was cut

`archive/claude-determined-mccarthy-7ga80s` points at `69474cf`, but by the time the
branch was reviewed its head was `5c3011f` — **a live session pushed a commit after
the tag was cut.** Deleting the branch on the strength of that tag would have
orphaned the one genuinely-unmerged fix on it. Hence the second tag,
`archive/claude-determined-mccarthy-7ga80s-head` (`5c3011f`).

**Before deleting any branch, assert `tag == branch head`** — a tag proves what was
preserved, not that nothing arrived afterwards. In a repo where several sessions push
concurrently, that gap is the normal case, not the exception.

The salvaged fix is PR #455: `react-dom` was never actually in the `react-vendor`
chunk, because the object form of Rollup's `manualChunks` matches by **resolved module
id** and only `react-dom/client` is ever imported. Measured over two builds — index
984.20 → 801.22 kB (−57 kB gzipped), cold total unchanged. So it is **cache
partitioning, not a payload reduction**; the win is that app-code deploys stop
invalidating the React vendor chunk. Still open at the time of writing, and `main`
still carries the `["react", "react-dom", "wouter"]` grouping.

The branches themselves may be deleted once their recommended salvage is done;
the tags are the durable record.
