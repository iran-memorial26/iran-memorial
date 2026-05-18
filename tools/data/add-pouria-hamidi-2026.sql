-- Data: Pouria Hamidi (پوریا حمیدی) — added 2026-02-17
-- Source: Iran International, February 8, 2026
-- 28-year-old man from Bushehr who died by politically-motivated suicide
-- after recording a final video addressed to Trump and Western governments

DO $$
DECLARE
  v_id UUID;
  city_id INT;
BEGIN
  -- Get Bushehr city ID
  SELECT id INTO city_id FROM cities WHERE slug = 'bushehr' LIMIT 1;

  -- Check if already exists
  IF EXISTS (SELECT 1 FROM victims WHERE slug = 'hamidi-pouria-2026') THEN
    RAISE NOTICE 'Pouria Hamidi already exists, skipping.';
    RETURN;
  END IF;

  -- Insert victim
  INSERT INTO victims (
    slug,
    name_latin,
    name_farsi,
    gender,
    age_at_death,
    date_of_death,
    place_of_death,
    province,
    city_id,
    cause_of_death,
    circumstances_en,
    circumstances_fa,
    responsible_forces,
    beliefs_en,
    quotes,
    verification_status,
    data_source
  ) VALUES (
    'hamidi-pouria-2026',
    'Pouria Hamidi',
    'پوریا حمیدی',
    'male',
    28,
    '2026-02-07',
    'Bushehr, Iran',
    'Bushehr',
    city_id,
    'Suicide (politically motivated)',
    'Pouria Hamidi, a 28-year-old man from Bushehr, died by suicide in early February 2026 after recording a roughly 10-minute video in English addressed to US President Donald Trump and Western governments. In the video, which he titled "This Is My Sacrifice – Please, Free My Country" and uploaded to his YouTube channel "PoorY X", he urged Western leaders not to negotiate with the Islamic Republic and alleged that over 40,000 people had been killed in government crackdowns. He expressed support for exiled Crown Prince Reza Pahlavi. His closing words in Persian were: "We, the people of Iran, are lonely people." His death was confirmed by a family-issued death notice. Some sources close to his family questioned the official suicide narrative and alleged possible government involvement, though this remains unverified.',
    'پوریا حمیدی، جوان ۲۸ ساله اهل بوشهر، در اوایل بهمن ۱۴۰۴ پس از ضبط ویدیویی حدوداً ۱۰ دقیقه‌ای به زبان انگلیسی خطاب به رئیس‌جمهور آمریکا دونالد ترامپ و دولت‌های غربی، جان خود را از دست داد. در این ویدیو که با عنوان «این فداکاری من است – لطفاً کشور مرا آزاد کنید» در کانال یوتیوب «PoorY X» منتشر شد، از رهبران غربی خواست با جمهوری اسلامی مذاکره نکنند و ادعا کرد بیش از ۴۰٬۰۰۰ نفر در سرکوب‌های حکومتی کشته شده‌اند. او در پایان به فارسی گفت: «ما ایرانیان، مردم تنهایی هستیم.» مرگ او با انتشار اطلاعیه تسلیت خانواده تأیید شد. برخی از نزدیکان خانواده‌اش روایت خودکشی را زیر سؤال بردند.',
    'Islamic Republic of Iran (indirect — state-induced despair)',
    'Pouria Hamidi was a freedom activist who documented his despair at the Islamic Republic''s systematic repression. In his final video he said: "I can''t eat. I can''t sleep. I can''t even cry about it because it''s upsetting to be born in a place that has no future." and "We can''t fight this regime alone."',
    ARRAY[
      'If you''re watching this, then I''m not around anymore.',
      'I can''t eat. I can''t sleep. I can''t even cry about it because it''s upsetting to be born in a place that has no future.',
      'We can''t fight this regime alone.',
      'We, the people of Iran, are lonely people.'
    ],
    'unverified',
    'iranintl-manual'
  ) RETURNING id INTO v_id;

  -- Insert sources
  INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES
    (v_id, 'Iran International – Pouria Hamidi report', 'https://www.iranintl.com/en/202602083545', 'news', '2026-02-08'),
    (v_id, 'Daily Wire – Pouria Hamidi report', 'https://www.dailywire.com/news/young-iranian-man-begs-trump-to-strike-regime-before-taking-his-own-life-attacking-iran-is-the-only-hope', 'news', '2026-02-09'),
    (v_id, 'YouTube – Final Video by PoorY X (This Is My Sacrifice)', 'https://www.youtube.com/@PoorYX', 'video', '2026-02-05'),
    (v_id, 'Republic World – Pouria Hamidi coverage', 'https://www.republicworld.com/world-news/just-attack-dont-negotiate-iranian-mans-final-video-plea-to-trump-against-talks-with-tehran-before-suicide', 'news', '2026-02-09');

  RAISE NOTICE 'Pouria Hamidi inserted with id: %', v_id;
END $$;
