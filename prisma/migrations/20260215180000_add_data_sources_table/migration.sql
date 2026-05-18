-- CreateEnum
CREATE TYPE "SourceCredibility" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('NGO', 'MEDIA', 'GOVERNMENT', 'ACADEMIC', 'COMMUNITY', 'MEMORIAL_PROJECT', 'SOCIAL_MEDIA', 'OFFICIAL_DOCUMENT');

-- CreateTable
CREATE TABLE "data_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "full_name" TEXT,
    "name_en" TEXT,
    "name_fa" TEXT,
    "name_de" TEXT,
    "url" TEXT,
    "description_en" TEXT,
    "description_fa" TEXT,
    "description_de" TEXT,
    "credibility" "SourceCredibility" NOT NULL DEFAULT 'MEDIUM',
    "source_type" "SourceType",
    "country_code" TEXT,
    "founded_year" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "sources" ADD COLUMN "data_source_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "data_sources_slug_key" ON "data_sources"("slug");

-- CreateIndex
CREATE INDEX "sources_data_source_id_idx" ON "sources"("data_source_id");

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
