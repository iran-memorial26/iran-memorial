-- Victim — structured education + online-presence fields.
-- Purely additive (no drops, no renames). Existing rows get NULL for every
-- new column; backfill happens incrementally via the submit pipeline and
-- future enricher runs.

ALTER TABLE "victims"
  ADD COLUMN "field_of_study"      TEXT,
  ADD COLUMN "university_name"     TEXT,
  ADD COLUMN "university_city"     TEXT,
  ADD COLUMN "degree_level"        TEXT,
  ADD COLUMN "graduation_year"     INTEGER,
  ADD COLUMN "instagram_handle"    TEXT,
  ADD COLUMN "x_handle"            TEXT,
  ADD COLUMN "linkedin_url"        TEXT,
  ADD COLUMN "github_handle"       TEXT,
  ADD COLUMN "telegram_handle"     TEXT,
  ADD COLUMN "facebook_url"        TEXT,
  ADD COLUMN "youtube_channel_url" TEXT,
  ADD COLUMN "website_url"         TEXT;

-- Indexes for the most likely filter dimensions on /victims.
-- field_of_study + university_name will be drill-down dimensions
-- ("show me all students of Sharif University who were killed").
CREATE INDEX IF NOT EXISTS "victims_university_name_idx"
  ON "victims" ("university_name")
  WHERE "university_name" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "victims_field_of_study_idx"
  ON "victims" ("field_of_study")
  WHERE "field_of_study" IS NOT NULL;
