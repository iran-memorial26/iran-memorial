-- Content + perceptual hashes for duplicate detection.
-- content_hash: sha256 of file bytes (catches exact duplicates / re-downloads).
-- phash: 64-bit perceptual hash (catches resized/recompressed variants).
--   Stored as BIGINT for index-friendly Hamming-distance queries via bit_count.
ALTER TABLE "photos"
  ADD COLUMN "content_hash" CHAR(64),
  ADD COLUMN "phash" BIGINT;

CREATE INDEX "photos_content_hash_idx" ON "photos" ("content_hash");
CREATE INDEX "photos_phash_idx" ON "photos" ("phash");
