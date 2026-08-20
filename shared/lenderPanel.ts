/**
 * Whether Homiquity can truthfully say it shops a borrower's file.
 *
 * Homiquity is a mortgage broker: it arranges financing with third-party
 * wholesale lenders and does not make credit decisions or fund loans (the
 * standing disclosure in `client/src/components/Footer.tsx`). Shopping a file
 * across a panel of lenders is therefore the core customer promise — and it is
 * only true once at least one wholesale lender has a signed broker agreement.
 *
 * 🚨 THE GATE IS THE POINT. Every row in `wholesale_lenders` is seeded at
 * `approvalStatus: "target"` (`server/seedData/wholesaleLenderTargets.ts`), and
 * the submission service hard-blocks on that flag
 * (`shared/schema/lendingWholesale.ts`). Advertising "we shop your file" while
 * no counterparty is approved is a Reg N / UDAAP misrepresentation: it markets a
 * capability the product cannot perform. The marketing copy therefore reads
 * from this flag rather than being written inline, so the day a broker agreement
 * is signed the change is one boolean, not a hunt through page copy.
 *
 * FOUNDER-MAINTAINED. Flip to `true` only when a wholesale lender actually sits
 * at `approvalStatus: "approved"` in the database — never in anticipation of one.
 *
 * Lender NAMES never appear in borrower-facing copy regardless of this flag:
 * wholesale-lender identity is masked from borrowers by doctrine
 * (`shared/borrowerActivityView.ts`, `scrubLenderIdentity`). "Our lending
 * partners" is the only permitted phrasing — no names, no count.
 */
export const LENDER_PANEL_LIVE = false;

/**
 * The advocacy sentence for public marketing surfaces, in the tense the company
 * can currently support.
 *
 * Both variants describe a broker acting for the customer. The pre-panel variant
 * claims only what is true today — that we prepare the file and take it out —
 * and never implies a live panel or a completed shopping process.
 */
export function lenderAdvocacyLine(): string {
  return LENDER_PANEL_LIVE
    ? "We shop your file across our lending partners."
    : "We prepare your file and take it to our lending partners.";
}

/**
 * The same promise in second person for body copy that continues a sentence.
 * Kept beside the line above so the two can never drift into different claims.
 */
export function lenderAdvocacyClause(): string {
  return LENDER_PANEL_LIVE
    ? "then we shop your file across our lending partners"
    : "then we prepare your file and take it to our lending partners";
}
