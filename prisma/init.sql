-- Enable pg_trgm for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for fuzzy search
CREATE INDEX IF NOT EXISTS "victims_name_latin_trgm_idx" ON "victims" USING gin ("name_latin" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "victims_name_farsi_trgm_idx" ON "victims" USING gin ("name_farsi" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "victims_place_of_death_trgm_idx" ON "victims" USING gin ("place_of_death" gin_trgm_ops);

-- tsvector column for full-text search
ALTER TABLE "victims" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- Populate search_vector for existing rows (using city/province relations)
UPDATE "victims" v SET "search_vector" =
  setweight(to_tsvector('simple', coalesce(v."name_latin", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(v."name_farsi", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(c."name_en", '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(p."name_en", '')), 'C')
FROM "cities" c
JOIN "provinces" p ON c."province_id" = p."id"
WHERE v."city_id" = c."id";

-- Also update rows without city_id (fallback to old text fields)
UPDATE "victims" SET "search_vector" =
  setweight(to_tsvector('simple', coalesce("name_latin", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("name_farsi", '')), 'A') ||
  setweight(to_tsvector('simple', coalesce("place_of_death", '')), 'B') ||
  setweight(to_tsvector('simple', coalesce("province", '')), 'C')
WHERE "city_id" IS NULL;

-- GIN index on search_vector
CREATE INDEX IF NOT EXISTS "victims_search_vector_idx" ON "victims" USING gin ("search_vector");

-- Trigger function to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION victims_search_vector_update() RETURNS trigger AS $$
DECLARE
  city_name TEXT;
  province_name TEXT;
BEGIN
  IF NEW.city_id IS NOT NULL THEN
    SELECT c.name_en, p.name_en INTO city_name, province_name
    FROM cities c JOIN provinces p ON c.province_id = p.id
    WHERE c.id = NEW.city_id;
  END IF;
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.name_latin, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.name_farsi, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(city_name, coalesce(NEW.place_of_death, ''))), 'B') ||
    setweight(to_tsvector('simple', coalesce(province_name, coalesce(NEW.province, ''))), 'C');
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

-- Index on date_of_death DESC for default list sort
CREATE INDEX IF NOT EXISTS "victims_date_of_death_desc_idx" ON "victims" ("date_of_death" DESC NULLS LAST);

-- Foreign key indexes for detail page lookups
CREATE INDEX IF NOT EXISTS "sources_victim_id_idx" ON "sources" ("victim_id");
CREATE INDEX IF NOT EXISTS "sources_event_id_idx" ON "sources" ("event_id");
