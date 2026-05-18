-- Add multilingual description columns for new languages (fr, it, es, ar)
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "description_ar" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "description_fr" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "description_it" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "description_es" TEXT;

-- DropIndex
DROP INDEX IF EXISTS "victims_search_vector_idx";

-- CreateIndex (tsvector uses default GIN index, not gin_trgm_ops)
CREATE INDEX "victims_search_vector_idx" ON "victims" USING GIN ("search_vector");
