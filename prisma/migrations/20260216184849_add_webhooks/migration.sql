-- DropIndex
DROP INDEX "sources_event_id_idx";

-- DropIndex
DROP INDEX "sources_victim_id_idx";

-- DropIndex
DROP INDEX "victims_date_of_death_desc_idx";

-- DropIndex
DROP INDEX "victims_gender_idx";

-- DropIndex
DROP INDEX "victims_name_farsi_trgm_idx";

-- DropIndex
DROP INDEX "victims_name_latin_trgm_idx";

-- DropIndex
DROP INDEX "victims_place_of_death_trgm_idx";

-- DropIndex
DROP INDEX "victims_search_vector_idx";

-- CreateTable
CREATE TABLE "webhooks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "api_key_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhooks_api_key_id_idx" ON "webhooks"("api_key_id");

-- CreateIndex
CREATE INDEX "victims_search_vector_idx" ON "victims" USING GIN ("search_vector");

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
