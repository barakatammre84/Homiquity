-- Debts paid by others — Fannie Mae Selling Guide B3-6-05, Monthly Debt
-- Obligations, "Debts Paid by Others" (edition 08/05/2026; a section revised
-- in that release).
--
-- B3-6-05 lets the lender exclude a non-mortgage payment from the borrower's
-- recurring monthly obligations when another party is actually repaying the
-- debt (whether or not that party is obligated on it; never when that party
-- is an interested party to the transaction), and exclude a full PITIA when
-- the payer is obligated on the mortgage, there are no delinquencies in the
-- most recent 12 months, and the borrower is not using rental income from
-- that property — in every case on the most recent 12 months' cancelled
-- checks or bank statements from the other party.
--
-- Nothing on urla_liabilities could carry the declaration, so every such debt
-- sat in the DTI and a borrower whose parent pays their student loan was
-- qualified on a ratio the Guide says they need not carry. These columns hold
-- the borrower's declaration and the three facts the rule turns on; the rule
-- is shared/liabilityExclusions.ts, and the 12-month documentation is an
-- auto-generated loan_condition (PRE_UW_THIRD_PARTY_PAID_DEBT) that staff
-- clear on the documents — so there is deliberately no staff-only column a
-- borrower could set through the table-column whitelist on the liability
-- routes.
--
-- Expand-only and idempotent: ADD COLUMN IF NOT EXISTS, nullable, no CHECK.
-- paid_by_other_party defaults to false — "not claimed" is the truthful state
-- of every existing row, not a guess. The three fact columns stay NULL until
-- the borrower answers: NULL means "not answered", which the rule treats as a
-- condition not yet met, never as a yes.

ALTER TABLE "urla_liabilities"
  ADD COLUMN IF NOT EXISTS "paid_by_other_party" boolean DEFAULT false;
ALTER TABLE "urla_liabilities"
  ADD COLUMN IF NOT EXISTS "other_party_relationship" varchar(60);
ALTER TABLE "urla_liabilities"
  ADD COLUMN IF NOT EXISTS "other_party_obligated" boolean;
ALTER TABLE "urla_liabilities"
  ADD COLUMN IF NOT EXISTS "other_party_interested_party" boolean;
ALTER TABLE "urla_liabilities"
  ADD COLUMN IF NOT EXISTS "uses_rental_income_from_property" boolean;
