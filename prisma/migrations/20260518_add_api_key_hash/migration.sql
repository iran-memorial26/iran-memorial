-- Add key_hash column (nullable first for backfill)
ALTER TABLE "api_keys" ADD COLUMN "key_hash" TEXT;

-- Backfill existing keys using pgcrypto SHA-256
-- (requires pgcrypto extension, which is standard on PostgreSQL 16)
UPDATE "api_keys" SET "key_hash" = encode(digest("key", 'sha256'), 'hex');

-- Make it required + unique after backfill
ALTER TABLE "api_keys" ALTER COLUMN "key_hash" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_key_hash_key" ON "api_keys"("key_hash");
