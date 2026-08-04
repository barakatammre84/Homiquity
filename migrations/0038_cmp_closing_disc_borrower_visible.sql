-- Borrower Clarity PR 4 (kb log 2026-08-04 §4): surface the closing-prep task
-- as a borrower transparency row. The task-engine SLA seed is insert-only
-- (onConflictDoNothing), so existing databases need this one-row flip; fresh
-- databases get it from the seed. Data-only, idempotent, no schema change.
UPDATE task_type_sla_mapping
SET visible_to_borrower = true,
    borrower_display_text = 'We''re preparing your closing paperwork.'
WHERE task_type_code = 'CMP_CLOSING_DISC'
  AND (visible_to_borrower IS DISTINCT FROM true OR borrower_display_text IS NULL);
