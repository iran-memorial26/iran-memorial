-- Fatemeh Sepehri (فاطمه سپهری) — Currently Imprisoned
-- Political activist, arrested September 21, 2022 in Mashhad
-- 18-year sentence (February 2023), Vakilabad Prison (Mashhad)
-- Source: IGFM (Internationale Gesellschaft für Menschenrechte)
-- https://www.igfm.de/fatemeh-sepehri/
-- NOTE: date_of_death is NULL (still alive as of 2026-02-17)

DO $$
DECLARE
  v_id UUID;
  city_mashhad INT;
BEGIN
  SELECT id INTO city_mashhad FROM cities WHERE slug = 'mashhad' LIMIT 1;

  IF EXISTS (SELECT 1 FROM victims WHERE slug = 'sepehri-fatemeh-2022') THEN
    RAISE NOTICE 'Fatemeh Sepehri already exists, skipping.';
  ELSE
    INSERT INTO victims (
      slug, name_latin, name_farsi, gender,
      date_of_birth, date_of_death,
      place_of_death, city_id,
      cause_of_death, circumstances_en, circumstances_fa,
      verification_status, data_source
    ) VALUES (
      'sepehri-fatemeh-2022',
      'Fatemeh Sepehri',
      'فاطمه سپهری',
      'female',
      '1964-01-01', -- year confirmed (1964), exact date unknown
      NULL, -- currently alive as of February 2026
      'Vakilabad Prison (Central Prison of Mashhad)',
      city_mashhad,
      'Imprisoned — 18-year sentence',
      'Fatemeh Sepehri is a prominent Iranian political activist currently serving an 18-year prison sentence in Vakilabad Prison (also known as the Central Prison of Mashhad), Razavi Khorasan Province. She was born in 1964 into a religious family as the daughter of a mullah. She was widowed in 1982 when her husband died in the Iran-Iraq War. She later earned a Bachelor''s degree in Business Management from Ferdowsi University in Mashhad at age 40 (in 2004). She is the mother of four children. She has been a persistent voice for women''s rights and political reform in Iran, having been arrested and sentenced multiple times: she previously received a 5-year sentence in 2021 for peaceful protest participation. On September 21, 2022 — shortly after the outbreak of the Woman, Life, Freedom uprising following the death of Mahsa Amini — she was arrested in her home in northeastern Mashhad. In February 2023, the First Chamber of Mashhad''s Revolutionary Court sentenced her to 18 years imprisonment on charges including "propaganda against the regime," "cooperation with hostile nations," "insulting the Supreme Leader," and "improper conduct, incitement to unrest and spreading lies." She was specifically targeted for her public statements supporting the protests. Her case is documented by the IGFM (International Society for Human Rights, Germany) as a case of conscience. As of February 2026, she remains imprisoned in Vakilabad Prison.',
      'فاطمه سپهری یک فعال سیاسی برجسته ایرانی است که در حال حاضر محکوم به ۱۸ سال حبس در زندان وکیل‌آباد مشهد (زندان مرکزی مشهد) است. در سال ۱۳۴۳ در خانواده‌ای مذهبی و دختر یک ملا به دنیا آمد. شوهرش در سال ۱۳۶۱ در جنگ ایران و عراق شهید شد. مادر چهار فرزند است. در ۴۰ سالگی (۱۳۸۳) لیسانس مدیریت بازرگانی از دانشگاه فردوسی مشهد گرفت. در ۲۱ سپتامبر ۲۰۲۲ — چند روز پس از آغاز قیام زن، زندگی، آزادی — در خانه‌اش در مشهد دستگیر شد. در فوریه ۲۰۲۳ به ۱۸ سال حبس محکوم شد. تا فوریه ۲۰۲۶ همچنان در زندان وکیل‌آباد است.',
      'verified',
      'igfm'
    ) RETURNING id INTO v_id;

    INSERT INTO sources (victim_id, name, url, source_type, published_date)
    VALUES
      (v_id, 'IGFM — Fatemeh Sepehri (Internationale Gesellschaft für Menschenrechte)',
       'https://www.igfm.de/fatemeh-sepehri/', 'HUMAN_RIGHTS_ORG', '2023-01-01');

    RAISE NOTICE 'Fatemeh Sepehri inserted with id: %', v_id;
  END IF;

END $$;
