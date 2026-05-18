-- Track broken/expired photo URLs (e.g. expired Telegram CDN links) so frontend
-- can filter them out instead of rendering broken-image fallbacks.
ALTER TABLE "photos"
  ADD COLUMN "is_broken" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "last_checked_at" TIMESTAMPTZ,
  ADD COLUMN "last_status_code" INTEGER;

CREATE INDEX "photos_is_broken_idx" ON "photos" ("is_broken");
