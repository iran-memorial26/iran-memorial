-- Permanent slug -> victim redirects.
-- Captures old slugs after a deduplication merge, a slug rename, or any
-- other operator-driven slug change. The victim detail page consults this
-- table on slug miss and issues a 308 redirect to the surviving record.

CREATE TABLE "victim_slug_redirects" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "from_slug"    TEXT         NOT NULL,
    "to_victim_id" UUID         NOT NULL,
    "reason"       TEXT,
    "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "victim_slug_redirects_pkey" PRIMARY KEY ("id")
);

-- The same old slug should never redirect to two places. Last-write-wins
-- via upsert keeps the API simple for the dedup tool.
CREATE UNIQUE INDEX "victim_slug_redirects_from_slug_key"
    ON "victim_slug_redirects" ("from_slug");

CREATE INDEX "victim_slug_redirects_to_victim_id_idx"
    ON "victim_slug_redirects" ("to_victim_id");

-- Delete redirects when the target victim is removed; orphan redirects
-- pointing at nothing would 500 instead of 404.
ALTER TABLE "victim_slug_redirects"
    ADD CONSTRAINT "victim_slug_redirects_to_victim_id_fkey"
    FOREIGN KEY ("to_victim_id") REFERENCES "victims"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
