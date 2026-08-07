-- 0054_urla_partial_rows.sql
-- Add a table to persist partially-filled URLA rows as drafts so the borrower
-- never loses intermediate work even when they haven't completed identifying
-- fields. Stored as JSON per application / borrower sequence / section.

CREATE TABLE IF NOT EXISTS urla_partial_rows (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id varchar NOT NULL,
  borrower_sequence_number integer NOT NULL DEFAULT 1,
  section varchar NOT NULL,
  data jsonb NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS urla_partial_rows_app_seq_section_idx
  ON urla_partial_rows (application_id, borrower_sequence_number, section);