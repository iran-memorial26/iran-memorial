-- Self-host photo mirror.
-- After mirroring, photos.url is rewritten to /photos/<id>.<ext> (served by
-- this app from a local filesystem volume); the original external URL is
-- preserved in original_url for archival, re-mirror, and provenance.
-- Same pattern for the legacy victims.photo_url column.
ALTER TABLE "photos"
  ADD COLUMN "original_url" TEXT;

ALTER TABLE "victims"
  ADD COLUMN "photo_original_url" TEXT;
