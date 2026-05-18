-- Add iranmonitor and VahidOnline to data_sources table

INSERT INTO data_sources (slug, name, full_name, name_en, name_fa, name_de, url, description_en, credibility, source_type, country_code, is_active, created_at, updated_at) VALUES
(
  'iranmonitor',
  'Iran Monitor',
  'Iran Monitor Memorial',
  'Iran Monitor Memorial',
  'ایران مانیتور',
  'Iran Monitor Memorial',
  'https://www.iranmonitor.org/memorial',
  'Structured API version of the @RememberTheirNames Telegram channel. Provides JSON access to memorial data with photos and biographical information.',
  'MEDIUM',
  'MEMORIAL_PROJECT',
  NULL,
  true,
  NOW(),
  NOW()
),
(
  'telegram-vahid',
  'Vahid Online',
  'Telegram @VahidOnline',
  'Vahid Online (Telegram)',
  'وحید آنلاین',
  'Vahid Online (Telegram)',
  'https://t.me/VahidOnline',
  'Citizen journalism Telegram channel (934K subscribers) documenting protest victims with photos and names. Covers recent casualties from ongoing demonstrations.',
  'MEDIUM',
  'SOCIAL_MEDIA',
  NULL,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO NOTHING;
