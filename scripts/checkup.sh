#!/usr/bin/env bash
# Daily code health checkup — read-only, safe to run anytime: `pnpm checkup`
#
# Checks: working tree clean, in sync with origin/main, typecheck, unit tests,
# production build, dependency vulnerabilities, orphaned files, production health.
# Prints one PASS/FAIL line per check and exits non-zero if anything failed.
#
# Deliberately NOT included: integration tests (they need a running server and
# currently pollute buyer@test.com data — see CTO_ROADMAP.md item 10).

set -uo pipefail
cd "$(dirname "$0")/.."

# Canonical prod host since the 2026-07-13 domain cutover (the binding
# post-deploy health check in CICD.md probes the same URL).
PROD_URL="${PROD_URL:-https://www.homiquity.com}"
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT
FAILED=0

check() {
  local name="$1"
  shift
  if "$@" >"$LOG" 2>&1; then
    echo "PASS  $name"
  else
    echo "FAIL  $name"
    tail -20 "$LOG" | sed 's/^/      | /'
    FAILED=1
  fi
}

tree_clean() { [ -z "$(git status --porcelain)" ]; }

main_in_sync() {
  git fetch -q origin || return 1
  [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || {
    echo "HEAD $(git rev-parse --short HEAD) != origin/main $(git rev-parse --short origin/main) (unpushed or unpulled work)"
    return 1
  }
}

prod_healthy() {
  curl -sf -m 15 "$PROD_URL/api/health" | grep -q '"status":"ok"'
}

echo "=== Homiquity daily checkup: $(date '+%Y-%m-%d %H:%M') ==="
check "working tree clean"            tree_clean
check "in sync with origin/main"      main_in_sync
check "typecheck (tsc)"               npx tsc --noEmit
# No --silent on script runs: pnpm v10 forwards post-scriptname flags INTO the
# script line, so it lands on the last command of the && chain — esbuild
# rejected it and the build check failed on a healthy build (found 2026-07-19).
# check() captures all output to $LOG anyway, so the flag bought nothing.
check "unit tests"                    pnpm test
check "production build"              pnpm build
check "dependency vulnerabilities"    pnpm audit --audit-level=moderate
check "no orphaned files"             node scripts/orphan-scan.cjs
check "schema ↔ migrations synced"    node scripts/schema-migration-guard.cjs
check "design tokens (no raw colors)" node scripts/design-token-guard.cjs
check "knowledge base indexed"        node scripts/kb-index-guard.cjs
check "regulatory ledger fresh"       node scripts/regulatory-freshness.cjs
check "living docs fresh"             node scripts/doc-freshness-guard.cjs
check "production health ($PROD_URL)" prod_healthy

if [ "$FAILED" -eq 0 ]; then
  echo "=== All checks passed ==="
else
  echo "=== CHECKUP FAILED — see FAIL lines above ==="
fi
exit "$FAILED"
