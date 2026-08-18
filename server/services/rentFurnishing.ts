import * as fs from "fs";
import * as path from "path";
import {
  type FurnishingState,
  type RentPaymentProvenance,
  type RentPaymentStatus,
} from "@shared/schema/rent";
import { isCompilerReleased } from "@shared/lib/metro2/compiler";

/**
 * Rent furnishing — the gate between the rent ledger and a credit bureau.
 *
 * This module is PURE and performs no I/O beyond one existence check for the authority
 * corpus. It decides *whether* something may be furnished; it never transmits anything,
 * because nothing in this repo can (shared/lib/metro2/compiler.ts throws).
 *
 * Homiquity is a consumer-report USER everywhere else in this codebase — permissible
 * purpose, adverse action, retention. Furnishing inverts that: we would be WRITING to a
 * consumer's file at a third party. The asymmetry matters for how this module is built.
 * A wrong read in the user direction produces a bad decision we can revisit. A wrong
 * write in this direction produces a derogatory mark on someone's credit report that
 * only they can remove, by filing a dispute they have to discover first.
 *
 * So every gate here fails CLOSED, and each one can only ever refuse.
 */

// -----------------------------------------------------------------------------
// Billing
// -----------------------------------------------------------------------------

/**
 * Whether a consumer may be charged for rent reporting. FALSE, and not a feature flag.
 *
 * The pitch that opened this program proposed the opposite explicitly: "queue the users
 * in a Pending Bureau Submission database state, collect the subscription revenue, and
 * batch-release the Metro 2 file the day you hit 100 users." Charging monthly for credit
 * reporting that is not occurring is a deceptive-practice exposure on its own, and
 * whether a subscription positioned as credit improvement falls inside CROA
 * (15 U.S.C. §1679b(b), advance payment) is an open counsel question — first raised by
 * the 2026-08-04 renter-incubation adjudication §5.6, still unanswered.
 *
 * There is no billing hook, no payment processor, and no price surface anywhere in the
 * product. Flipping this constant is therefore not sufficient to charge anyone, which is
 * intentional: the guard is the absence, and this constant is where the absence is
 * written down. Ledger: croa-1679b-advance-payment.
 */
export const RENT_REPORTING_BILLING_ENABLED = false;

// -----------------------------------------------------------------------------
// Provenance gate
// -----------------------------------------------------------------------------

/**
 * The only provenance a furnished payment may carry.
 *
 * `platform_processed` means the money moved through the platform's payment partner and
 * we hold the partner's own reference for the transfer — first-party evidence.
 *
 * `bank_observed` is deliberately excluded. That is the pitch's design: scan Plaid
 * transactions for an outflow "within 5% of the lease amount" matching keywords like
 * "Rent", "Venmo", or "Zelle". Consider what a false negative does — it furnishes a
 * MISSED payment for a consumer who paid, from a fuzzy string comparison. A heuristic is
 * an acceptable basis for a suggestion and an unacceptable basis for a derogatory
 * statement to a credit bureau.
 *
 * Ledger: fcra-1681s2-furnisher-accuracy.
 */
export const FURNISHABLE_PROVENANCE: readonly RentPaymentProvenance[] = ["platform_processed"];

/** Payment lifecycle states that represent a settled fact worth reporting. */
const REPORTABLE_STATUSES: readonly RentPaymentStatus[] = ["paid", "late", "missed"];

export interface FurnishabilityInput {
  readonly status: RentPaymentStatus;
  readonly provenance: RentPaymentProvenance;
  readonly processorReference?: string | null;
}

export interface FurnishabilityVerdict {
  readonly furnishable: boolean;
  /** Every reason it was refused. Empty iff `furnishable`. */
  readonly blockers: readonly string[];
}

/**
 * Is one rent payment eligible to be furnished? Pure; order-independent; reports every
 * blocker rather than the first, so a caller cannot fix one and assume it is clear.
 */
export function evaluatePaymentFurnishability(input: FurnishabilityInput): FurnishabilityVerdict {
  const blockers: string[] = [];

  if (!FURNISHABLE_PROVENANCE.includes(input.provenance)) {
    blockers.push(
      `provenance '${input.provenance}' is not furnishable — only ` +
        `${FURNISHABLE_PROVENANCE.join(", ")} rests on first-party evidence`,
    );
  }

  if (!REPORTABLE_STATUSES.includes(input.status)) {
    blockers.push(`status '${input.status}' is not a settled outcome`);
  }

  // A platform_processed row without the partner's reference is a claim about a transfer
  // we cannot point at. That is exactly the provenance-column failure CLAUDE.md forbids:
  // the honest value is "we do not have it", never a synthesised identifier.
  if (input.provenance === "platform_processed" && !input.processorReference) {
    blockers.push("platform_processed payment carries no processor reference — unverifiable");
  }

  return { furnishable: blockers.length === 0, blockers };
}

/** Throwing form, for call sites where proceeding without the check is the bug. */
export function assertFurnishable(input: FurnishabilityInput): void {
  const verdict = evaluatePaymentFurnishability(input);
  if (!verdict.furnishable) {
    throw new Error(`rent payment is not furnishable: ${verdict.blockers.join("; ")}`);
  }
}

// -----------------------------------------------------------------------------
// Queue state machine
// -----------------------------------------------------------------------------

/**
 * Legal transitions for `rent_furnishing_queue.state`.
 *
 * `pending_authority` is the entry state and, today, the terminus — nothing can leave it
 * while the authority corpus is absent. `suppressed` is terminal on purpose: a consumer
 * who withdraws is not silently re-enrolled by a later sweep; re-entry requires a fresh
 * row and a fresh authorisation.
 */
export const FURNISHING_TRANSITIONS: Readonly<Record<FurnishingState, readonly FurnishingState[]>> = {
  pending_authority: ["pending_minimum_lines", "suppressed"],
  pending_minimum_lines: ["queued", "suppressed"],
  queued: ["furnished", "suppressed"],
  furnished: ["disputed", "suppressed"],
  // A dispute resolves either by correcting/redelivering or by removing the line.
  disputed: ["queued", "suppressed"],
  suppressed: [],
};

export function canTransition(from: FurnishingState, to: FurnishingState): boolean {
  return FURNISHING_TRANSITIONS[from].includes(to);
}

/**
 * Queue states from which a lease may still be **erased** rather than suppressed.
 *
 * The distinction is not bookkeeping. Once a tradeline has left the building, deleting
 * our copy does not un-say it — the record lives at the bureau, and the only honest
 * remedy is `suppressed`, which excludes the line from every subsequent file and is
 * itself a thing we must be able to prove we did. Erasing the local row instead would
 * destroy the evidence of what we furnished while leaving the furnished data in place:
 * the worst of both, and unanswerable when the consumer disputes it.
 *
 * `pending_authority` is erasable because nothing has ever left. Today that is every
 * row, because nothing can furnish — but this list, not that fact, is what makes the
 * rule survive the day furnishing turns on.
 */
export const ERASABLE_FURNISHING_STATES: readonly FurnishingState[] = ["pending_authority"];

export function isErasable(state: FurnishingState): boolean {
  return ERASABLE_FURNISHING_STATES.includes(state);
}

export function assertTransition(from: FurnishingState, to: FurnishingState): void {
  if (!canTransition(from, to)) {
    throw new Error(`illegal furnishing transition: ${from} -> ${to}`);
  }
}

// -----------------------------------------------------------------------------
// Authority gate
// -----------------------------------------------------------------------------

// process.cwd(), not __dirname: the production bundle is ESM
// (`esbuild … --format=esm`, package.json "build"), where __dirname does not exist.
// This was the only __dirname in server/ or shared/ — the house pattern is
// process.cwd() (see server/routes/seo.ts). Harmless today because nothing in the
// server import graph reaches this module, but it would throw at module load the
// moment the gate is wired to a route, which is the worst possible time to find out.
const METRO2_DOCS_DIR = path.resolve(process.cwd(), "docs", "cdia-metro2");

/**
 * Has the Metro 2 authority actually landed?
 *
 * A README alone is not authority — docs/cdia-metro2/ ships with one describing what to
 * obtain. This looks for any *other* file in the directory, which is what a placed manual
 * looks like.
 */
export function hasMetro2Authority(): boolean {
  if (!fs.existsSync(METRO2_DOCS_DIR)) return false;
  return fs
    .readdirSync(METRO2_DOCS_DIR)
    .some((f) => f.toLowerCase() !== "readme.md" && !f.startsWith("."));
}

/**
 * THE BUREAU MINIMUM IS NOT A CONSTANT IN THIS REPO — deliberately.
 *
 * The pitch asserted "Equifax, Experian, and TransUnion generally will not accept you as
 * a direct Data Furnisher until you have 100+ active reporting lines." That number is an
 * uncited external claim about three private companies' onboarding policies, and no
 * document in this repo confirms it. Hardcoding 100 would give a made-up threshold the
 * appearance of policy, and every downstream surface would then quote it to users.
 *
 * Same treatment as the portal-gated DSCR minimum in
 * server/services/income/paths/dscr.ts, which exports no threshold constant and is
 * pinned by tests/nonQmProgramGate.test.ts. `pending_minimum_lines` exists as a state so
 * the shape of the requirement is modelled; the number arrives with the per-bureau
 * furnisher specifications listed in docs/cdia-metro2/README.md.
 */
export const BUREAU_MINIMUM_ACTIVE_LINES = null;

export interface ProgramReadiness {
  readonly canFurnish: boolean;
  readonly blockers: readonly string[];
}

/**
 * Can the program furnish anything at all, right now? Independent of any single payment.
 *
 * Returns every blocker so the answer reads as a checklist rather than a wall.
 */
export function evaluateProgramReadiness(): ProgramReadiness {
  const blockers: string[] = [];

  if (!hasMetro2Authority()) {
    blockers.push(
      "docs/cdia-metro2/ holds no manual — the Metro 2 format authority is absent " +
        "(acquisition is a CDIA membership action, not a download)",
    );
  }
  if (!isCompilerReleased()) {
    blockers.push("shared/lib/metro2/compiler.ts FIELD_LAYOUT is empty — no record can be built");
  }
  if (BUREAU_MINIMUM_ACTIVE_LINES === null) {
    blockers.push(
      "the per-bureau active-line minimum is unknown — no in-repo document states it, " +
        "and the pitched figure of 100 is an uncited external claim",
    );
  }

  return { canFurnish: blockers.length === 0, blockers };
}
