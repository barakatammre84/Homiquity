-- 0045: add the rate_locks.confirmed_by -> users.id foreign key that 0040 omitted
--
-- shared/schema/lendingRatesOps.ts declares
--   confirmedBy: varchar("confirmed_by").references(() => users.id)
-- but 0040 created the column as a bare `varchar` with no REFERENCES clause,
-- so production has the column without the constraint. The schema has been
-- asserting a referential guarantee the database does not enforce. Its own
-- sibling one migration later, 0043's `recorded_by varchar REFERENCES
-- users(id)`, shows the omission was an oversight and not a decision.
--
-- Why this cannot fail on existing rows, and therefore needs no prod data
-- probe under DB_MIGRATIONS.md §Contract migrations:
--
-- ADD CONSTRAINT ... NOT VALID instructs Postgres to skip the scan of existing
-- rows entirely. The statement is O(1) with respect to table contents, so no
-- pre-existing value of confirmed_by — valid, orphaned, or NULL — can abort
-- it. This is the standard safe form of adding a foreign key to a populated
-- table, and it is what keeps this out of the 2026-07-13 outage class.
-- Enforcement still applies in full to every INSERT and UPDATE from here on,
-- which is the guarantee the schema already promises the application.
--
-- Deliberately NOT running VALIDATE CONSTRAINT here. Validation scans the
-- whole table and would fail loudly if any historical row holds an orphaned
-- confirmed_by, which is exactly the kind of abort this migration must avoid.
-- Validating later is a separate, deliberate step: it needs a read-only probe
-- of the orphan count first, per the runbook.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rate_locks_confirmed_by_users_id_fk'
  ) THEN
    ALTER TABLE "rate_locks"
      ADD CONSTRAINT "rate_locks_confirmed_by_users_id_fk"
      FOREIGN KEY ("confirmed_by") REFERENCES "users"("id")
      NOT VALID;
  END IF;
END $$;
