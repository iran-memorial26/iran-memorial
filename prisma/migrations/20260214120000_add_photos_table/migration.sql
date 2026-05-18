-- CreateTable
CREATE TABLE "photos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "victim_id" UUID,
    "event_id" UUID,
    "url" TEXT NOT NULL,
    "caption_en" TEXT,
    "caption_fa" TEXT,
    "source_credit" TEXT,
    "photo_type" TEXT NOT NULL DEFAULT 'portrait',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "photos_victim_id_idx" ON "photos"("victim_id");

-- CreateIndex
CREATE INDEX "photos_event_id_idx" ON "photos"("event_id");

-- CreateIndex
CREATE INDEX "photos_victim_id_is_primary_idx" ON "photos"("victim_id", "is_primary");

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_victim_id_fkey" FOREIGN KEY ("victim_id") REFERENCES "victims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
