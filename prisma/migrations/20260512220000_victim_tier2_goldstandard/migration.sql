-- Tier-2 goldstandard fields. Strict-typed structured columns the legacy
-- circumstances_* free-text fields cannot expose to filters or schema.org.
-- Additive only; every existing row stays untouched (NULL / default false).

ALTER TABLE "victims"
  ADD COLUMN "mother_tongue"              TEXT,
  ADD COLUMN "prison_name"                TEXT,
  ADD COLUMN "prison_cell_block"          TEXT,
  ADD COLUMN "arrest_date"                DATE,
  ADD COLUMN "arrest_location"            TEXT,
  ADD COLUMN "charges_en"                 TEXT,
  ADD COLUMN "charges_fa"                 TEXT,
  ADD COLUMN "lawyer_name"                TEXT,
  ADD COLUMN "lawyer_persecuted"          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "last_words_en"              TEXT,
  ADD COLUMN "last_words_fa"              TEXT,
  ADD COLUMN "international_recognition"  TEXT,
  ADD COLUMN "family_member_killed"       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "disability_status"          TEXT;

-- Indexes for the most likely filter dimensions:
-- prison_name — "every Evin prisoner killed in custody"
-- lawyer_name — "every case Mohammad-Reza Faqihi defended" (legal-pattern analysis)
-- arrest_date — temporal analysis of custody->execution intervals

CREATE INDEX IF NOT EXISTS "victims_prison_name_idx"
  ON "victims" ("prison_name")
  WHERE "prison_name" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "victims_lawyer_name_idx"
  ON "victims" ("lawyer_name")
  WHERE "lawyer_name" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "victims_arrest_date_idx"
  ON "victims" ("arrest_date")
  WHERE "arrest_date" IS NOT NULL;
