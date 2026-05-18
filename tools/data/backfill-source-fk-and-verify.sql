-- Backfill `sources.data_source_id` by URL pattern, then re-run the
-- 3-tier auto-verify rule documented at /methodology.
--
-- Diagnostic findings (2026-05-02):
--   • All 9,629 unverified victims have sources without data_source_id FK
--   • 3,073 of those have an iranrights.org (Boroumand HIGH) source — they
--     should be Rule-A verified but the auto-verify rule only sees the FK
--   • The URL-pattern fallback in lib/credibility.ts already classifies
--     these correctly for the badge UI, but the DB rule does not
--
-- Run as a single transaction; review counts at each step before COMMIT.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Ensure all relevant sources exist in the registry
-- ---------------------------------------------------------------------------
INSERT INTO data_sources (slug, name, full_name, name_en, name_de, name_fa,
                          url, credibility, source_type, country_code, is_active,
                          created_at, updated_at)
VALUES
  ('hengaw', 'Hengaw', 'Hengaw Organization for Human Rights',
   'Hengaw', 'Hengaw', 'هنگاو',
   'https://hengaw.net', 'HIGH', 'NGO', 'IR', TRUE, NOW(), NOW()),
  ('iranmonitor', 'Iran Monitor', 'Iran Monitor Memorial',
   'Iran Monitor', 'Iran Monitor', 'ایران مانیتور',
   'https://www.iranmonitor.org', 'MEDIUM', 'MEMORIAL_PROJECT', NULL, TRUE, NOW(), NOW()),
  ('witness-report', 'witness.report', 'witness.report Community Archive',
   'witness.report', 'witness.report', 'witness.report',
   'https://witness.report', 'LOW', 'COMMUNITY', NULL, TRUE, NOW(), NOW()),
  ('iranintl', 'Iran International', 'Iran International TV',
   'Iran International', 'Iran International', 'ایران اینترنشنال',
   'https://iranintl.com', 'MEDIUM', 'MEDIA', 'GB', TRUE, NOW(), NOW()),
  ('iranwire', 'IranWire', 'IranWire',
   'IranWire', 'IranWire', 'ایران‌وایر',
   'https://iranwire.com', 'MEDIUM', 'MEDIA', NULL, TRUE, NOW(), NOW()),
  -- 2026-05-03 hygiene: register the open social platforms so unrecognized
  -- citations show up in /sources and get the correct community badge.
  -- Verification rules are unchanged — these stay LOW credibility.
  ('telegram', 'Telegram', 'Telegram public channels',
   'Telegram', 'Telegram', 'تلگرام',
   'https://t.me', 'LOW', 'SOCIAL_MEDIA', NULL, TRUE, NOW(), NOW()),
  ('twitter-x', 'X (Twitter)', 'X / Twitter public posts',
   'X (Twitter)', 'X (Twitter)', 'ایکس / توییتر',
   'https://x.com', 'LOW', 'SOCIAL_MEDIA', NULL, TRUE, NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Backfill sources.data_source_id by URL pattern
--    Only touches rows where data_source_id IS NULL.
-- ---------------------------------------------------------------------------
WITH mapping(pattern, slug) AS (VALUES
  ('iranrights.org',          'boroumand'),
  ('iranhr.net',              'ihr'),
  ('amnesty.org',             'amnesty'),
  ('hra-news.org',            'hrana'),
  ('hraney.net',              'hrana'),
  ('hengaw.net',              'hengaw'),
  ('un.org',                  'un-ffm'),
  ('ohchr.org',               'un-ffm'),
  ('iranmonitor.org',         'iranmonitor'),
  ('iranvictims.com',         'iranvictims'),
  ('iranvictims.org',         'iranvictims'),
  ('iranrevolution.org',      'iranrevolution'),
  ('iranrevolution.online',   'iranrevolution'),
  ('wikipedia.org',           'wikipedia-wlf'),
  ('iranintl.com',            'iranintl'),
  ('iranwire.com',            'iranwire'),
  ('witness.report',          'witness-report'),
  ('t.me',                    'telegram'),
  ('telegram.me',             'telegram'),
  ('x.com',                   'twitter-x'),
  ('twitter.com',             'twitter-x')
)
UPDATE sources s
SET data_source_id = ds.id
FROM mapping m
JOIN data_sources ds ON ds.slug = m.slug
WHERE s.data_source_id IS NULL
  AND s.url ILIKE '%' || m.pattern || '%';

-- ---------------------------------------------------------------------------
-- 3. How many sources got an FK now?
-- ---------------------------------------------------------------------------
SELECT
  ds.slug,
  ds.credibility,
  COUNT(*) AS source_rows
FROM sources s
JOIN data_sources ds ON ds.id = s.data_source_id
GROUP BY ds.slug, ds.credibility
ORDER BY ds.credibility, source_rows DESC;

-- ---------------------------------------------------------------------------
-- 4. Apply Rule A: 1+ HIGH-credibility source → verified
-- ---------------------------------------------------------------------------
WITH rule_a AS (
  SELECT DISTINCT s.victim_id
  FROM sources s
  JOIN data_sources ds ON ds.id = s.data_source_id
  WHERE ds.credibility = 'HIGH'
    AND s.victim_id IS NOT NULL
)
UPDATE victims v
SET verification_status = 'verified'
FROM rule_a
WHERE v.id = rule_a.victim_id
  AND v.verification_status = 'unverified';

-- ---------------------------------------------------------------------------
-- 5. Apply Rule B: 2+ MEDIUM-or-higher sources → verified
-- ---------------------------------------------------------------------------
WITH rule_b AS (
  SELECT s.victim_id
  FROM sources s
  JOIN data_sources ds ON ds.id = s.data_source_id
  WHERE ds.credibility IN ('HIGH', 'MEDIUM')
    AND s.victim_id IS NOT NULL
  GROUP BY s.victim_id
  HAVING COUNT(DISTINCT ds.id) >= 2
)
UPDATE victims v
SET verification_status = 'verified'
FROM rule_b
WHERE v.id = rule_b.victim_id
  AND v.verification_status = 'unverified';

-- ---------------------------------------------------------------------------
-- 6. Apply Rule C: 3+ sources of any tier → verified
-- ---------------------------------------------------------------------------
WITH rule_c AS (
  SELECT s.victim_id
  FROM sources s
  WHERE s.victim_id IS NOT NULL
  GROUP BY s.victim_id
  HAVING COUNT(*) >= 3
)
UPDATE victims v
SET verification_status = 'verified'
FROM rule_c
WHERE v.id = rule_c.victim_id
  AND v.verification_status = 'unverified';

-- ---------------------------------------------------------------------------
-- 7. Final verified counts
-- ---------------------------------------------------------------------------
SELECT verification_status, COUNT(*) FROM victims GROUP BY verification_status ORDER BY 2 DESC;

COMMIT;
