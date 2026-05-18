-- Province duplicate cleanup
UPDATE "victims" SET "province" = 'Khorasan-e Razavi' WHERE "province" IN ('Khorasan', 'Khorasan\Khorasan-e Razavi');
UPDATE "victims" SET "province" = 'Sistan va Baluchestan' WHERE "province" = 'Sistan Va Baluchestan';
UPDATE "victims" SET "province" = 'Kohgiluyeh va Boyer-Ahmad' WHERE "province" = 'Kohgiluyeh-va Boyer-Ahmad';

-- Enable pg_trgm (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for fuzzy search
CREATE INDEX IF NOT EXISTS "victims_name_latin_trgm_idx" ON "victims" USING gin ("name_latin" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "victims_name_farsi_trgm_idx" ON "victims" USING gin ("name_farsi" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "victims_place_of_death_trgm_idx" ON "victims" USING gin ("place_of_death" gin_trgm_ops);

-- tsvector column for full-text search
ALTER TABLE "victims" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- Populate search_vector for existing rows
UPDATE "victims" SET "search_vector" =
  setweight(to_tsvector('simple', coalesce("name_latin", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("name_farsi", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("place_of_death", '')), 'B') ||
  setweight(to_tsvector('simple', coalesce("province", '')), 'C');

-- GIN index on search_vector
CREATE INDEX IF NOT EXISTS "victims_search_vector_idx" ON "victims" USING gin ("search_vector");

-- Trigger function to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION victims_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.name_latin, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.name_farsi, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.place_of_death, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.province, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop first to be idempotent)
DROP TRIGGER IF EXISTS victims_search_vector_trigger ON "victims";
CREATE TRIGGER victims_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "victims"
  FOR EACH ROW
  EXECUTE FUNCTION victims_search_vector_update();

-- Index on gender for filter performance
CREATE INDEX IF NOT EXISTS "victims_gender_idx" ON "victims"("gender");
