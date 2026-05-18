-- Executions — January 7, 2026 (Moharebeh charge, Yazd Central Prison)
-- Source: Hengaw (Jan 9, 2026) — https://hengaw.net/en/news/2026/01/article-61
-- Source: Iran Human Rights (IHRNGO) — https://en.iranhrs.org/executions-in-iran-january-2026-human-rights-concerns/
-- Both arrested ~3 years prior (approx. 2022–2023), joint case
-- Specific alleged acts were not disclosed by any rights organization

DO $$
DECLARE
  v_id UUID;
  city_yazd INT;
BEGIN
  SELECT id INTO city_yazd FROM cities WHERE slug = 'yazd' LIMIT 1;

  -- ─── 1. Kaveh Panahi ──────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM victims WHERE slug = 'panahi-kaveh-2026') THEN
    RAISE NOTICE 'Kaveh Panahi already exists, skipping.';
  ELSE
    INSERT INTO victims (
      slug, name_latin, name_farsi, gender,
      date_of_death, place_of_death, city_id,
      cause_of_death, circumstances_en, circumstances_fa,
      verification_status, data_source
    ) VALUES (
      'panahi-kaveh-2026',
      'Kaveh Panahi',
      'کاوه پناهی',
      'male',
      '2026-01-07',
      'Yazd Central Prison',
      city_yazd,
      'Execution » Hanging',
      'Kaveh Panahi was executed in the early hours of January 7, 2026 at Yazd Central Prison, along with Ali Nirang, in a joint case. Both men had been arrested approximately three years prior (around 2022–2023) and were sentenced to death on charges of Moharebeh ("waging war against God" — محاربه). The Hengaw Organization for Human Rights, which documented the case, explicitly noted that "no clear information has been released regarding the specific acts cited to justify the accusation." Their executions occurred on the same day that Iranian security forces began mass shootings of protesters during the nationwide uprising that erupted on December 28, 2025.',
      'کاوه پناهی در سحرگاه ۷ ژانویه ۲۰۲۶ در زندان مرکزی یزد، همراه با علی نیرنگ، در یک پرونده مشترک اعدام شد. هر دو نفر حدود سه سال پیش از اعدام دستگیر شده بودند و به اتهام محاربه به مرگ محکوم شدند. سازمان هنگاو برای حقوق بشر که این پرونده را مستند کرده، به صراحت اعلام کرد که هیچ اطلاعات روشنی درباره اقدامات مشخصی که به عنوان دلیل این اتهام ذکر شده منتشر نشده است.',
      'unverified',
      'hengaw'
    ) RETURNING id INTO v_id;

    INSERT INTO sources (victim_id, name, url, source_type, published_date)
    VALUES
      (v_id, 'Hengaw — Iran Executes 13 Prisoners Across Multiple Prisons',
       'https://hengaw.net/en/news/2026/01/article-61', 'HUMAN_RIGHTS_ORG', '2026-01-09'),
      (v_id, 'Iran Human Rights — Executions in Iran January 2026',
       'https://en.iranhrs.org/executions-in-iran-january-2026-human-rights-concerns/', 'HUMAN_RIGHTS_ORG', '2026-01-15');

    RAISE NOTICE 'Kaveh Panahi inserted with id: %', v_id;
  END IF;

  -- ─── 2. Ali Nirang ────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM victims WHERE slug = 'nirang-ali-2026') THEN
    RAISE NOTICE 'Ali Nirang already exists, skipping.';
  ELSE
    INSERT INTO victims (
      slug, name_latin, name_farsi, gender,
      date_of_death, place_of_death, city_id,
      cause_of_death, circumstances_en, circumstances_fa,
      verification_status, data_source
    ) VALUES (
      'nirang-ali-2026',
      'Ali Nirang',
      'علی نیرنگ',
      'male',
      '2026-01-07',
      'Yazd Central Prison',
      city_yazd,
      'Execution » Hanging',
      'Ali Nirang (also referred to as Ali Nirang Golbidgahi) was executed in the early hours of January 7, 2026 at Yazd Central Prison in a joint case with Kaveh Panahi. Both men had been arrested approximately three years prior (around 2022–2023) on charges of Moharebeh ("waging war against God" — محاربه). The Hengaw Organization for Human Rights noted that no details about the specific alleged acts were publicly disclosed. Their executions coincided with the onset of mass repression during the January 2026 uprising.',
      'علی نیرنگ (همچنین علی نیرنگ گلبیدگهی) در سحرگاه ۷ ژانویه ۲۰۲۶ در زندان مرکزی یزد در یک پرونده مشترک با کاوه پناهی اعدام شد. هر دو حدود سه سال پیش دستگیر شده و به اتهام محاربه به مرگ محکوم شده بودند. سازمان هنگاو اعلام کرد که هیچ اطلاعات مشخصی درباره اقدامات منتسب به آن‌ها منتشر نشده است.',
      'unverified',
      'hengaw'
    ) RETURNING id INTO v_id;

    INSERT INTO sources (victim_id, name, url, source_type, published_date)
    VALUES
      (v_id, 'Hengaw — Iran Executes 13 Prisoners Across Multiple Prisons',
       'https://hengaw.net/en/news/2026/01/article-61', 'HUMAN_RIGHTS_ORG', '2026-01-09'),
      (v_id, 'Iran Human Rights — Executions in Iran January 2026',
       'https://en.iranhrs.org/executions-in-iran-january-2026-human-rights-concerns/', 'HUMAN_RIGHTS_ORG', '2026-01-15');

    RAISE NOTICE 'Ali Nirang inserted with id: %', v_id;
  END IF;

END $$;
