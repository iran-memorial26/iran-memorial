-- Search Improvements: unaccent extension + trigram index + updated search vector trigger
-- Migration: 20260217120000_search_improvements

-- 1. Enable unaccent extension (accent-insensitive search: "amini" → "Amīnī")
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Create unaccent-enabled text search configuration (drop if exists first)
DROP TEXT SEARCH CONFIGURATION IF EXISTS simple_unaccent;
CREATE TEXT SEARCH CONFIGURATION simple_unaccent (COPY = simple);
ALTER TEXT SEARCH CONFIGURATION simple_unaccent
  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, simple;

-- 3. Add GIN trigram index on name_latin for fast fuzzy matching
CREATE INDEX IF NOT EXISTS victims_name_latin_trgm_idx
  ON victims USING gin (name_latin gin_trgm_ops);

-- 4. Add GIN trigram index on name_farsi for Farsi fuzzy matching
CREATE INDEX IF NOT EXISTS victims_name_farsi_trgm_idx
  ON victims USING gin (name_farsi gin_trgm_ops);

-- 5. Update search vector trigger to use unaccent (accent-insensitive)
CREATE OR REPLACE FUNCTION victims_search_vector_update()
RETURNS trigger AS $$
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
    setweight(to_tsvector('simple_unaccent', unaccent(coalesce(NEW.name_latin, ''))), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.name_farsi, '')), 'A') ||
    setweight(to_tsvector('simple_unaccent', unaccent(coalesce(city_name, coalesce(NEW.place_of_death, '')))), 'B') ||
    setweight(to_tsvector('simple_unaccent', unaccent(coalesce(province_name, coalesce(NEW.province, '')))), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Rebuild all search vectors with new unaccent configuration
UPDATE victims SET search_vector =
  setweight(to_tsvector('simple_unaccent', unaccent(coalesce(name_latin, ''))), 'A') ||
  setweight(to_tsvector('simple', coalesce(name_farsi, '')), 'A') ||
  setweight(to_tsvector('simple_unaccent', unaccent(coalesce(
    (SELECT c.name_en FROM cities c WHERE c.id = city_id),
    coalesce(place_of_death, '')
  ))), 'B') ||
  setweight(to_tsvector('simple_unaccent', unaccent(coalesce(
    (SELECT p.name_en FROM provinces p JOIN cities c ON c.province_id = p.id WHERE c.id = city_id),
    coalesce(province, '')
  ))), 'C');
