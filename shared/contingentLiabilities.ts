// ---------------------------------------------------------------------------
// Contingent-liability register — the balance sheet of an asset-light broker.
//
// Homiquity holds no loans, so there is nothing to mismatch against
// liabilities and no duration risk on assets. That is the correct structure.
// It also means the company's real balance sheet is entirely CONTINGENT:
// obligations that exist only if something happens — a fee comes in over what
// was disclosed, a loan pays off early, a lock expires before closing.
//
// None of it was enumerated anywhere, in code or in the knowledge base, which
// is why "is our reserve adequate?" had no answer. Not a hard answer — no
// answer, because the question had no operands.
//
// ---------------------------------------------------------------------------
// THE ONE RULE THIS MODULE ENFORCES
// ---------------------------------------------------------------------------
// Some exposures can be measured from live data. Others are real, unbounded,
// and cannot be quantified without a statute or counsel — TILA statutory
// damages, the state surety-bond requirement, minimum net worth.
//
// A register that silently omitted the second kind would produce a total that
// looks complete and is not, which is worse than no total at all. So every
// entry declares its `basis`, the sum is named `quantifiedFloor` rather than
// "total", and `unquantifiedCount` travels with it. A consumer cannot read the
// number without also reading how much is missing from it.
// ---------------------------------------------------------------------------

export const EXPOSURE_BASES = ["computed", "policy_unquantified"] as const;
export type ExposureBasis = (typeof EXPOSURE_BASES)[number];

export const EXPOSURE_CATEGORIES = [
  "trid_cure",
  "epo_clawback",
  "lock_honor",
  "lock_extension",
  "regz_lo_comp",
  "commission_payable",
  "surety_bond",
  "minimum_net_worth",
] as const;
export type ExposureCategory = (typeof EXPOSURE_CATEGORIES)[number];

export interface ExposureEntry {
  category: ExposureCategory;
  label: string;
  basis: ExposureBasis;
  /** Dollars at risk. Null for policy_unquantified — never 0, which would lie. */
  amount: number | null;
  /** How many files/instances carry this exposure. */
  count: number;
  /** How long an instance stays exposed. */
  window: string;
  /** What triggers the obligation. */
  trigger: string;
  /** Assumptions the figure rests on; empty when it rests on none. */
  assumptions: string[];
  /** What a human must do to quantify or verify this. */
  action: string | null;
  note: string;
}

export interface ContingentLiabilityRegister {
  /**
   * Sum of the `computed` entries. Deliberately NOT called "total": the
   * unquantified entries below are real exposures excluded from it.
   */
  quantifiedFloor: number;
  /** Exposures that are real but have no dollar figure here. */
  unquantifiedCount: number;
  /** True while any exposure lacks a figure — i.e. the floor is incomplete. */
  incomplete: boolean;
  entries: ExposureEntry[];
  /** Every assumption any figure rests on, deduplicated. */
  assumptions: string[];
  /** Everything a human must resolve, in one list. */
  actions: string[];
  summary: string;
}

export interface RegisterInputs {
  /** Realized TRID cure exposure — files whose disclosures went up unjustified. */
  tridCure: { amount: number; fileCount: number };
  /** EPO clawback register (shared/compensationClawback.ts). */
  clawback: { totalAtRisk: number; atRiskCount: number; indeterminateCount: number; usesAssumedWindow: boolean };
  /** Rate-lock exposure split by whether a lender is actually on the hook. */
  locks: {
    /** Rows presented as live with NO lender confirmation (legacy, pre-F-3). */
    unconfirmedCount: number;
    unconfirmedLoanVolume: number;
    /** Confirmed locks expiring soon on files not yet closed. */
    expiringSoonCount: number;
    expiringSoonLoanVolume: number;
  };
  /** Funded loans carrying a known Reg Z §1026.36 / ATR defect. */
  regZExposedLoanCount: number;
  /**
   * Commission payouts on funded files (`broker_commissions`), split by
   * lifecycle state. See shared/costLedger.ts for why `approved` is a payable
   * and `pending` is not yet one.
   */
  commissions: {
    approvedAmount: number;
    approvedCount: number;
    pendingAmount: number;
    pendingCount: number;
    /** Already disbursed on loans still inside a live EPO clawback window. */
    paidInsideClawbackWindowAmount: number;
    paidInsideClawbackWindowCount: number;
  };
}

/**
 * Basis-point cost of extending a rate lock, per day, used to size the
 * expiring-lock exposure.
 *
 * PLATFORM ASSUMPTION — extension pricing comes from each executed broker
 * agreement, and none exists. Sized for a 15-day extension. Replace when
 * agreements land. Ledger: `platform-lock-extension-bps-per-day`.
 */
export const ASSUMED_EXTENSION_BPS_PER_DAY = 1.5;
export const ASSUMED_EXTENSION_DAYS = 15;

/**
 * Adverse rate move used to size the honor exposure on an UNCONFIRMED quote,
 * expressed as points of price.
 *
 * PLATFORM ASSUMPTION. A 50 bps move is roughly 2 points of price; this is a
 * scenario parameter, not a forecast, and exists so the exposure has a size
 * rather than being described in prose. Ledger: `platform-lock-shock-points`.
 */
export const ASSUMED_RATE_SHOCK_POINTS = 2;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function buildContingentLiabilityRegister(input: RegisterInputs): ContingentLiabilityRegister {
  const entries: ExposureEntry[] = [];

  // --- TRID good-faith cures (F-4) ----------------------------------------
  entries.push({
    category: "trid_cure",
    label: "TRID good-faith fee cures",
    basis: "computed",
    amount: round2(input.tridCure.amount),
    count: input.tridCure.fileCount,
    window: "Until closing, then 60 days post-consummation to refund",
    trigger: "A disclosed charge increases without a valid changed circumstance",
    assumptions: [],
    action: input.tridCure.amount > 0
      ? "Cure at closing or document a changed circumstance for each affected file."
      : null,
    note:
      "Measured from the persisted Loan Estimate baselines — only files whose latest evaluation " +
      "returned cure_required are counted. Files with no issued LE carry no cure exposure yet.",
  });

  // --- EPO compensation clawback (F-8) ------------------------------------
  entries.push({
    category: "epo_clawback",
    label: "Early-payoff compensation clawback",
    basis: "computed",
    amount: round2(input.clawback.totalAtRisk),
    count: input.clawback.atRiskCount,
    window: "From funding until the EPO window closes",
    trigger: "A funded loan pays off inside the lender's early-payoff window",
    assumptions: input.clawback.usesAssumedWindow
      ? ["EPO window length is the platform default — no executed broker agreement supplies a term."]
      : [],
    action: input.clawback.indeterminateCount > 0
      ? `Record the lender remittance for ${input.clawback.indeterminateCount} funded loan(s) — their exposure is unknown, not zero.`
      : null,
    note:
      input.clawback.indeterminateCount > 0
        ? `${input.clawback.indeterminateCount} at-risk loan(s) have no remittance recorded and contribute $0 to the figure despite being exposed.`
        : "Every at-risk loan has a recorded remittance.",
  });

  // --- Lock honor on unconfirmed quotes (F-3 residual) --------------------
  const honorExposure = round2(
    (input.locks.unconfirmedLoanVolume * ASSUMED_RATE_SHOCK_POINTS) / 100,
  );
  entries.push({
    category: "lock_honor",
    label: "Honor exposure on unconfirmed rate quotes",
    basis: "computed",
    amount: honorExposure,
    count: input.locks.unconfirmedCount,
    window: "Until the quote is confirmed by a lender, repriced, or withdrawn",
    trigger: "Rates move against a quote no lender ever committed to",
    assumptions: [
      `Sized at ${ASSUMED_RATE_SHOCK_POINTS} points of price (roughly a 50 bps adverse move) — a scenario, not a forecast.`,
    ],
    action: input.locks.unconfirmedCount > 0
      ? `Obtain lender confirmation for ${input.locks.unconfirmedCount} open record(s), or reclassify them as quotes to the borrower.`
      : null,
    note:
      "New locks cannot be created without lender confirmation. This counts rows written before " +
      "that gate existed — a confirmed lock is the lender's obligation, not ours.",
  });

  // --- Extension cost on locks nearing expiry (F-10) ----------------------
  const extensionExposure = round2(
    (input.locks.expiringSoonLoanVolume * ASSUMED_EXTENSION_BPS_PER_DAY * ASSUMED_EXTENSION_DAYS) / 10_000,
  );
  entries.push({
    category: "lock_extension",
    label: "Rate-lock extension cost",
    basis: "computed",
    amount: extensionExposure,
    count: input.locks.expiringSoonCount,
    window: "Until each lock expires",
    trigger: "A file does not close before its lock expires and the lender bills an extension",
    assumptions: [
      `Sized at ${ASSUMED_EXTENSION_BPS_PER_DAY} bps/day for ${ASSUMED_EXTENSION_DAYS} days — no executed agreement supplies extension pricing.`,
    ],
    action: null,
    note:
      "Falls on the broker unless passed through with a changed circumstance, which is why the " +
      "extend endpoint records a payer.",
  });

  // --- Reg Z §1026.36 / ATR liability (F-1, F-2) --------------------------
  entries.push({
    category: "regz_lo_comp",
    label: "Reg Z §1026.36 / ATR liability on defective loans",
    basis: "policy_unquantified",
    amount: null,
    count: input.regZExposedLoanCount,
    window: "Life of the loan; ATR is a defense to foreclosure",
    trigger: "A funded loan carries a dual-compensation or points-and-fees defect",
    assumptions: [],
    action:
      "TILA statutory and actual damages could not be quantified here — the amounts require the " +
      "statute and counsel. Count of exposed loans is reported; the multiplier is not.",
    note:
      input.regZExposedLoanCount > 0
        ? "Loans funded before the compensation and QM gates landed may carry defects — review them individually."
        : "No funded loan is currently flagged with a known defect.",
  });

  // --- Commission payouts owed on funded files ----------------------------
  //
  // The only obligation on this register that is a CASH payable rather than a
  // contingency: once a loan funds and the commission is approved, the company
  // owes the money outright. It belongs here anyway, because this register is
  // the platform's only balance-sheet artifact and omitting the one certain
  // liability from the list of uncertain ones inverts the reader's picture of
  // what the company owes.
  //
  // The EPO interaction is the part that does not net out. When a lender
  // reclaims its compensation on an early payoff, the clawback entry above
  // sizes the loss at the comp we must return — but a commission already
  // DISBURSED against that same loan is not recoverable from the lender and
  // generally not from the payee. So the true cash loss on an EPO is the
  // clawback PLUS the commission already paid, and that second amount is
  // reported here rather than silently folded into the first.
  const commissionPayable = round2(input.commissions.approvedAmount);
  entries.push({
    category: "commission_payable",
    label: "Commission payouts owed on funded files",
    basis: "computed",
    amount: commissionPayable,
    count: input.commissions.approvedCount,
    window: "From approval until disbursement",
    trigger: "A funded file carries an approved referral/originator commission not yet paid",
    assumptions: [],
    action:
      input.commissions.pendingCount > 0
        ? `Approve or reject ${input.commissions.pendingCount} pending commission(s) worth $${input.commissions.pendingAmount.toFixed(2)} — they are owed or not owed, and today they are neither.`
        : null,
    note:
      input.commissions.paidInsideClawbackWindowCount > 0
        ? `$${input.commissions.paidInsideClawbackWindowAmount.toFixed(2)} of commission has already been disbursed on ${input.commissions.paidInsideClawbackWindowCount} loan(s) still inside a live EPO window. That money is unrecoverable if the lender claws back its compensation, so the real loss on those files exceeds the EPO figure above by this amount.`
        : "No disbursed commission sits on a loan inside a live EPO window.",
  });

  // --- Licensing capital requirements -------------------------------------
  entries.push({
    category: "surety_bond",
    label: "Surety bond (state licensing)",
    basis: "policy_unquantified",
    amount: null,
    count: 0,
    window: "Continuous while licensed",
    trigger: "A condition of maintaining the residential mortgage license",
    assumptions: [],
    action:
      "Verify the bond amount required for the licensed footprint against the state statute and " +
      "record it here. Not verifiable from this codebase.",
    note: "Appears nowhere in the code or the NMLS knowledge base despite an active license.",
  });

  entries.push({
    category: "minimum_net_worth",
    label: "Minimum net worth (state licensing)",
    basis: "policy_unquantified",
    amount: null,
    count: 0,
    window: "Continuous while licensed",
    trigger: "A condition of maintaining the residential mortgage license",
    assumptions: [],
    action:
      "Verify the minimum net worth required for the licensed footprint against the state statute " +
      "and record it here. Not verifiable from this codebase.",
    note:
      "Interacts with everything above: the contingent exposures are claims against exactly the " +
      "net worth the licence requires be maintained.",
  });

  const quantifiedFloor = round2(
    entries.reduce((sum, e) => sum + (e.amount ?? 0), 0),
  );
  const unquantified = entries.filter(e => e.basis === "policy_unquantified");
  const assumptions = [...new Set(entries.flatMap(e => e.assumptions))];
  const actions = entries.map(e => e.action).filter((a): a is string => !!a);

  return {
    quantifiedFloor,
    unquantifiedCount: unquantified.length,
    incomplete: unquantified.length > 0,
    entries,
    assumptions,
    actions,
    summary:
      `$${quantifiedFloor.toFixed(2)} of contingent liability is measurable today across ` +
      `${entries.filter(e => e.basis === "computed").length} exposure types. ` +
      `${unquantified.length} further exposure(s) are real but unquantified here ` +
      `(${unquantified.map(e => e.label).join(", ")}), so this is a FLOOR, not a reserve figure.`,
  };
}
