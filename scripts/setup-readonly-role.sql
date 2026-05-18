-- ============================================================
-- memorial_readonly: dedicated Postgres role for public read paths
-- ============================================================
--
-- Apply once on each environment as a SUPERUSER:
--
--   docker exec -i iran-db psql -U postgres -d iran_memorial \
--     < scripts/setup-readonly-role.sql
--
-- Then set DATABASE_URL_READONLY in the app .env and restart the
-- container.
--
-- Idempotent: safe to re-run.
-- ============================================================

-- 1. Role with login (Prisma needs a real connection user).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'memorial_readonly') THEN
    -- Password set by the operator out-of-band. Replace 'CHANGE_ME' before applying,
    -- or re-issue ALTER USER ... PASSWORD '...' separately to keep secrets out of git.
    CREATE ROLE memorial_readonly LOGIN PASSWORD 'CHANGE_ME';
  END IF;
END$$;

-- 2. Connect + see schema.
GRANT CONNECT ON DATABASE iran_memorial TO memorial_readonly;
GRANT USAGE ON SCHEMA public TO memorial_readonly;

-- 3. SELECT on every existing table.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO memorial_readonly;

-- 4. SELECT on every FUTURE table created by the `memorial` owner role.
--    Without this, Prisma migrations that add tables would silently
--    leave the readonly client unable to see new data.
ALTER DEFAULT PRIVILEGES FOR ROLE memorial IN SCHEMA public
  GRANT SELECT ON TABLES TO memorial_readonly;

-- 5. Belt-and-braces: explicitly REVOKE write privileges so accidental
--    grants from a future migration get clobbered back.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM memorial_readonly;

-- 6. Sanity check (run separately as memorial_readonly to confirm):
--   SET ROLE memorial_readonly;
--   SELECT COUNT(*) FROM victims;        -- works
--   INSERT INTO victims (slug) VALUES ('x');  -- ERROR: permission denied
