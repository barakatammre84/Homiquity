#!/usr/bin/env bash
# Stand-in for the dead CI `gate` job: merge current origin/main into a PR branch
# and run the gate's own step list against the RESULT. Branch protection has
# strict:false, so a PR's recorded green gate never saw today's main — this is
# what closes that gap while GitHub Actions billing is down.
#
# usage: verify-pr.sh <pr-number> <head-branch>
set -uo pipefail
PR="$1"; BR="$2"
LOG="${SCRATCH:-/tmp}/pr-$PR.log"
: > "$LOG"
res=()

say() { printf '%s\n' "$*" | tee -a "$LOG"; }
step() {
  local name="$1"; shift
  if "$@" >>"$LOG" 2>&1; then res+=("PASS  $name"); printf '  ok   %s\n' "$name"
  else res+=("FAIL  $name"); printf '  FAIL %s\n' "$name"; fi
}

say "===== PR #$PR ($BR) merged with origin/main ====="
# Several guards RATCHET their own baseline file as a side effect (citation-guard
# rewrites scripts/citation-baseline.json when the count comes in under it). git
# carries an uncommitted change across a checkout, so without this reset one PR's
# tightened baseline silently judges the NEXT one — which is how this driver
# first reported main as red on a guard main actually passes.
git checkout -q -- . 2>/dev/null; git clean -qfd scripts 2>/dev/null
git checkout -q -B "verify/$PR" "origin/$BR" >>"$LOG" 2>&1 || { echo "checkout failed"; exit 2; }
BASE=$(git rev-parse --short HEAD)

if git merge --no-edit origin/main >>"$LOG" 2>&1; then
  say "merge: clean ($BASE + $(git rev-parse --short origin/main))"
else
  say "merge: CONFLICT — $(git diff --name-only --diff-filter=U | tr '\n' ' ')"
  git merge --abort >/dev/null 2>&1
  exit 3
fi

pnpm install --frozen-lockfile >>"$LOG" 2>&1

step "typecheck"            pnpm check
step "unit tests"           pnpm test
step "dep audit (prod)"     pnpm audit --prod --audit-level=high
step "schema<->migrations"  node scripts/schema-migration-guard.cjs
step "migration ledger"     node scripts/migration-ledger-guard.cjs
step "design tokens"        node scripts/design-token-guard.cjs
step "UI ratchet"           node scripts/ui-standard-guard.cjs
step "kb index"             node scripts/kb-index-guard.cjs
step "doc staleness"        node scripts/doc-staleness-guard.cjs
step "citations"            pnpm guard:citations
step "query keys"           node scripts/query-key-guard.cjs

# §9 security-review guard reads the PR BODY from the event payload in CI; feed it the real one.
gh pr view "$PR" --json body --jq .body > "${SCRATCH:-/tmp}/body-$PR.txt" 2>/dev/null
CHANGED_FILES="$(git diff --name-only origin/main...HEAD)" \
  PR_BODY="$(cat "${SCRATCH:-/tmp}/body-$PR.txt")" \
  bash -c 'node scripts/security-review-guard.cjs' >>"$LOG" 2>&1 \
  && res+=("PASS  §9 security-review") && echo "  ok   §9 security-review" \
  || { res+=("FAIL  §9 security-review"); echo "  FAIL §9 security-review"; }

step "production build"     pnpm build
step "bundle ratchet"       node scripts/bundle-size-guard.cjs

say ""
printf '%s\n' "${res[@]}" | tee -a "$LOG"
fails=$(printf '%s\n' "${res[@]}" | grep -c '^FAIL' || true)
say ""
say "PR #$PR against current main: $fails failing step(s)"
