-- Duplicate Candidates: cache table for pre-computed name similarity pairs
-- Migration: 20260217130000_duplicate_candidates

CREATE TABLE duplicate_candidates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug1       TEXT        NOT NULL,
  name1       TEXT        NOT NULL,
  slug2       TEXT        NOT NULL,
  name2       TEXT        NOT NULL,
  similarity  FLOAT       NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending',
  scanned_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dup_candidates_slug1   ON duplicate_candidates (slug1);
CREATE INDEX idx_dup_candidates_slug2   ON duplicate_candidates (slug2);
CREATE INDEX idx_dup_candidates_status  ON duplicate_candidates (status);
