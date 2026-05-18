-- Deaths in Custody — February 2026 (protest-related)
-- Source: Iran International (Feb 6, 2026)
-- https://www.iranintl.com/en/202602068911
-- Victims of January 2025-2026 uprising — arrested protesters who died in custody

DO $$
DECLARE
  v_id UUID;
  city_isfahan INT;
  city_karaj INT;
BEGIN
  SELECT id INTO city_isfahan FROM cities WHERE slug = 'isfahan' LIMIT 1;
  SELECT id INTO city_karaj FROM cities WHERE slug = 'karaj' LIMIT 1;

  -- ─── 1. Mohammad-Amin Aghilizadeh ────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM victims WHERE slug = 'aghilizadeh-mohammad-amin-2026') THEN
    RAISE NOTICE 'Mohammad-Amin Aghilizadeh already exists, skipping.';
  ELSE
    INSERT INTO victims (
      slug, name_latin, name_farsi, gender,
      date_of_death, place_of_death, city_id,
      cause_of_death, circumstances_en, circumstances_fa,
      verification_status, data_source
    ) VALUES (
      'aghilizadeh-mohammad-amin-2026',
      'Mohammad-Amin Aghilizadeh',
      'محمد امین عقیلی‌زاده',
      'male',
      NULL, -- exact date not confirmed, approx. early Feb 2026
      'Fooladshahr, Isfahan Province',
      city_isfahan,
      'Death in custody',
      'Mohammad-Amin Aghilizadeh, a teenager from Fooladshahr in Isfahan Province, was arrested following his participation in the January 2026 protests. His family was initially asked to pay bail for his release. Instead of his freedom, they received a phone call summoning them to collect his body. His corpse bore visible gunshot wounds to the head. No official cause of death was provided by authorities. His case is consistent with a documented pattern of protesters dying in custody under suspicious circumstances, reported by Iran International on February 6, 2026.',
      'محمد امین عقیلی‌زاده، یک نوجوان از فولادشهر اصفهان، پس از شرکت در اعتراضات ژانویه ۲۰۲۶ دستگیر شد. خانواده‌اش ابتدا برای آزادی او از آن‌ها وثیقه خواسته شد، اما به‌جای آزادی، با تماسی برای تحویل گرفتن جسد فرزندشان مواجه شدند. جسد او دارای زخم‌های گلوله در ناحیه سر بود.',
      'unverified',
      'iran-international'
    ) RETURNING id INTO v_id;

    INSERT INTO sources (victim_id, name, url, source_type, published_date)
    VALUES
      (v_id, 'Iran International — Deaths in Custody Report',
       'https://www.iranintl.com/en/202602068911', 'MEDIA', '2026-02-06');

    RAISE NOTICE 'Mohammad-Amin Aghilizadeh inserted with id: %', v_id;
  END IF;

  -- ─── 2. Javad Molaverdi ──────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM victims WHERE slug = 'molaverdi-javad-2026') THEN
    RAISE NOTICE 'Javad Molaverdi already exists, skipping.';
  ELSE
    INSERT INTO victims (
      slug, name_latin, name_farsi, gender,
      date_of_death, place_of_death, city_id,
      cause_of_death, circumstances_en, circumstances_fa,
      verification_status, data_source
    ) VALUES (
      'molaverdi-javad-2026',
      'Javad Molaverdi',
      'جواد مولاوردی',
      'male',
      NULL, -- exact date not confirmed, approx. early Feb 2026
      'Karaj',
      city_karaj,
      'Death in custody',
      'Javad Molaverdi was wounded by birdshot during the January 2026 protests and subsequently arrested. He was transferred to Ghezel-Hesar Prison in Karaj. His family later discovered his body on a cemetery — indicating he died while in state custody. No official cause of death was communicated to the family. His case was documented by Iran International as part of a broader pattern of custodial deaths following the January uprising.',
      'جواد مولاوردی در جریان اعتراضات ژانویه ۲۰۲۶ با ساچمه‌های پلیس زخمی شد و دستگیر گردید. او به زندان قزل‌حصار کرج منتقل شد. خانواده‌اش بعداً جسد او را در قبرستانی یافتند. هیچ دلیل رسمی برای مرگ به خانواده اطلاع داده نشد.',
      'unverified',
      'iran-international'
    ) RETURNING id INTO v_id;

    INSERT INTO sources (victim_id, name, url, source_type, published_date)
    VALUES
      (v_id, 'Iran International — Deaths in Custody Report',
       'https://www.iranintl.com/en/202602068911', 'MEDIA', '2026-02-06');

    RAISE NOTICE 'Javad Molaverdi inserted with id: %', v_id;
  END IF;

END $$;
