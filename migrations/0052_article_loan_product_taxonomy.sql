-- Loan product taxonomy on articles.
--
-- WHY: education content and the conversion funnel were unwired in both
-- directions. Articles could reach /apply, but a persona page (/va-loans,
-- /refinance, /self-employed) had no way to surface the content that answers
-- the objection a visitor arrives with — because nothing joined an article to
-- a loan product. `category_id` is an editorial topic ("Getting Started") and
-- `tags` is free text; neither is a product.
--
-- SHAPE: two axes, not one list, mirroring how wholesale lenders publish their
-- menus. `loan_product_families` is what the loan IS (conventional/fha/va/
-- usda/jumbo/non_qm/home_equity). `doc_methods` is how income is PROVEN
-- (bank_statement/dscr/asset_depletion/1099/wvoe) and nests mostly under
-- non-QM. `transaction_purposes` is what the borrower is doing. The shared
-- vocabulary and the family↔method validity rules live in
-- shared/loanProducts.ts.
--
-- Arrays, not scalars: an article legitimately spans several families (a
-- first-time-buyer guide covers FHA and conventional).
--
-- NULL IS A REAL ANSWER. Existing rows are left unclassified rather than
-- backfilled by inference. "How to improve your credit score before applying"
-- is not about a product, and a guessed classification would put it in front
-- of the wrong borrower on a conversion page. Editors classify from the admin
-- content screen; the seed classifies only the articles whose subject is
-- unambiguous.
--
-- Expand-only and idempotent: additive nullable columns, ignored by the
-- currently-deployed app.

ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "loan_product_families" text[];
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "transaction_purposes" text[];
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "doc_methods" text[];

-- The related-content lookup is "published articles overlapping these
-- families" — an array-overlap (&&) query, which a btree index cannot serve.
CREATE INDEX IF NOT EXISTS "idx_articles_product_families"
    ON "articles" USING gin ("loan_product_families");
