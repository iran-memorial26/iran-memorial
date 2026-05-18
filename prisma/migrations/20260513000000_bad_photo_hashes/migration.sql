-- Blocklist of photo SHA-256 hashes that must never be attached to a victim.
--
-- Populated by operators (via the new `enricher photo-block <hash>` CLI) when
-- a specific image is found to be wrong, generic, NSFW, stolen, or otherwise
-- unsuitable. The photo_mirror pipeline consults this table after every
-- download and refuses to persist a hash that is on the list; the photo_audit
-- pipeline can also retroactively delete every Photo row + on-disk file whose
-- content_hash is blocked.
--
-- First entry, populated in the data-fix that motivated this table:
--   5c96e08eee41977d3ebd0ce4612acabe6dfaf6c0b6b070e731b06494c71d20c7
--   (Generic image mis-attributed to Mahsa Amini, Nika Shakarami, and
--    Armita Geravand — three of the most prominent 2022 WLF victims —
--    via a faulty Telegram photo-mirror run.)

CREATE TABLE "bad_photo_hashes" (
    "sha256"      CHAR(64)    PRIMARY KEY,
    "reason"      TEXT        NOT NULL,
    "added_by"    TEXT,
    "first_seen_url" TEXT,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  "bad_photo_hashes"   IS 'SHA-256 blocklist for photo content. photo_mirror skips on insert; photo_audit deletes on retroactive sweep.';
COMMENT ON COLUMN "bad_photo_hashes"."sha256" IS 'Lower-case hex SHA-256 of the image bytes. Matches photos.content_hash.';
COMMENT ON COLUMN "bad_photo_hashes"."reason" IS 'Short operator note: why is this image blocked? Visible in audit reports.';
