#!/usr/bin/env bash
#
# The harness tiers, one token each.
#
# `knowledge-base/handoff/prompts/_RAILS.md` R14 defines a proof hierarchy: each tier
# proves one thing and is blind to the rest, and a loop may claim completion only by
# citing tier output. Until now the rails carried the COMMANDS as prose, so a loop
# retyped a nine-guard chain from a markdown table — and the table and the gate could
# drift apart with nothing to notice.
#
# This file is now the executable definition. The rails describe what each tier proves
# and cannot see; the commands live here, once.
#
#   pnpm harness:t0    static      — types, guard scripts parse, ratchets not regressed
#   pnpm harness:t1    unit        — both vitest lanes, with the collection floor
#   pnpm harness:t2    integrated  — T0 + T1 + audit + the §9 guard as CI computes it
#   pnpm harness:t3    full        — + build, bundle ratchet, prod-mode boot, integration lane
#
# T-1 (standing checks), T4 (browser) and T5 (post-merge prod) are deliberately absent:
# each needs a judgement or a running service that a single command cannot honestly
# assert. Their definitions stay in R14. Do not add a `harness:t4` that boots a server
# and calls silence success.
#
# A tier that CANNOT run must fail, never pass quietly — the same rule the gate follows.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

TIER="${1:-}"
[ -z "$TIER" ] && { echo "usage: bash scripts/harness.sh t0|t1|t2|t3" >&2; exit 2; }

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }

t0() {
  step "T0 static — types"
  pnpm check || return 1
  step "T0 static — guard scripts parse"
  for f in scripts/*.cjs; do node --check "$f" || return 1; done
  step "T0 static — ratchets and structural guards"
  pnpm guard:schema && pnpm guard:migrations \
    && pnpm guard:kb && pnpm guard:staleness && pnpm guard:citations \
    && pnpm guard:querykeys && pnpm guard:tokens && pnpm guard:ui
}

# `pnpm test` IS scripts/test-collection-guard.cjs, which compares each lane's real
# `include` against the files on disk and fails on a silent shortfall. R14 used to ask
# for that comparison by hand; the guard is strictly stronger, so do not re-add it here.
t1() { step "T1 unit — both lanes + the collection floor"; pnpm test; }

t2() { step "T2 — preflight --fast"; bash scripts/preflight.sh --fast; }

t3() { step "T3 — full preflight"; bash scripts/preflight.sh; }

case "$TIER" in
  t0) t0 ;;
  t1) t1 ;;
  t2) t2 ;;
  t3) t3 ;;
  *) echo "unknown tier '$TIER' — expected t0, t1, t2 or t3" >&2; exit 2 ;;
esac
rc=$?

if [ $rc -eq 0 ]; then
  printf '\n\033[32m✓ %s passed\033[0m — cite this line in the LOOP REPORT.\n' "$TIER"
else
  printf '\n\033[31m✗ %s FAILED (exit %d)\033[0m — a red tier is terminal, not a reason to loosen it.\n' "$TIER" "$rc"
fi
exit $rc
