-- Executions — 2022 Woman, Life, Freedom Uprising (Zan, Zendegi, Azadi)
-- Three young men executed for alleged acts during the September 2022 protests
-- All cases condemned internationally as relying on torture-extracted confessions

DO $$
DECLARE
  v_id UUID;
  city_karaj  INT;
  city_tehran INT;
BEGIN
  SELECT id INTO city_karaj  FROM cities WHERE slug = 'karaj'  LIMIT 1;
  SELECT id INTO city_tehran FROM cities WHERE slug = 'tehran' LIMIT 1;

  -- ─── 1. Mohammad Mahdi Karami ─────────────────────────────────────────────
  -- Born Oct 31, 2001, Kutan Sofla, Bijar, Kurdistan — grew up in Nazarabad/Karaj
  -- Karate national champion, youth team member, volunteer coach
  -- Arrested Nov 5, 2022, executed Jan 7, 2023 at Karaj Central Prison, age 21
  IF EXISTS (SELECT 1 FROM victims WHERE slug = 'karami-mohammad-mahdi-2023') THEN
    RAISE NOTICE 'Mohammad Mahdi Karami already exists, skipping.';
  ELSE
    INSERT INTO victims (
      slug, name_latin, name_farsi, gender,
      date_of_birth, date_of_death, age_at_death,
      place_of_death, city_id,
      cause_of_death, circumstances_en, circumstances_fa,
      verification_status, data_source
    ) VALUES (
      'karami-mohammad-mahdi-2023',
      'Mohammad Mahdi Karami',
      'محمد مهدی کرمی',
      'male',
      '2001-10-31',
      '2023-01-07',
      21,
      'Karaj Central Prison (زندان مرکزی کرج)',
      city_karaj,
      'Execution » Hanging',
      'Mohammad Mahdi Karami was executed on January 7, 2023, at Karaj Central Prison at the age of 21. He was arrested on November 5, 2022 — two days after the killing of Basij volunteer Seyed Ruhollah Ajamian during the 40th-day memorial protests for Hadis Najafi in Karaj. He was charged with Efsad-fel-arz ("Corruption on Earth" — افساد فی الارض), a mandatory capital charge. Born in Kutan Sofla village, Bijar County, Kurdistan Province, he had grown up in Nazarabad near Karaj. He became a national karate champion representing Iran in youth team competitions and volunteered as a coach for children. He was reportedly beaten unconscious upon arrest, given only 15 minutes to present his defense, denied access to a lawyer of his choosing, and subjected to torture from which confessions were extracted. He denied all charges throughout his detention. His execution was the third known execution in connection with the 2022 Woman, Life, Freedom uprising. International condemnation came from UN experts, Amnesty International, NIAC, and Hengaw.',
      'محمد مهدی کرمی در ۷ ژانویه ۲۰۲۳ در زندان مرکزی کرج در ۲۱ سالگی اعدام شد. او در ۵ نوامبر ۲۰۲۲ — دو روز پس از کشته شدن عضو بسیج سید روح‌الله اجامیان — دستگیر شد. قهرمان ملی کاراته و مربی داوطلبانه کودکان بود. در دوران بازجویی زیر شکنجه قرار گرفت و تنها ۱۵ دقیقه برای دفاع از خود وقت داشت. او تمام اتهامات را رد کرد. اعدام او سومین اعدام شناخته‌شده مرتبط با قیام زن، زندگی، آزادی بود.',
      'verified',
      'hengaw'
    ) RETURNING id INTO v_id;

    INSERT INTO sources (victim_id, name, url, source_type, published_date)
    VALUES
      (v_id, 'Hengaw — Death Sentences of Karami and Hosseini Carried Out',
       'https://hengaw.net/en/news/2023/01/the-death-sentences-of-mohammad-mehdi-karmi-and-seyed-mohammad-hosseini-were-carried-out', 'HUMAN_RIGHTS_ORG', '2023-01-07'),
      (v_id, 'CNN — Karate Champion Executed in Iran',
       'https://www.cnn.com/2023/01/07/middleeast/iran-protesters-executed-intl-hnk/index.html', 'MEDIA', '2023-01-07'),
      (v_id, 'Abdorrahman Boroumand Center — Memorial',
       'https://www.iranrights.org/memorial/story/-8588/mohammad-mehdi-karami', 'HUMAN_RIGHTS_ORG', '2023-01-08'),
      (v_id, 'Wikipedia — Execution of Mohammad Mehdi Karami',
       'https://en.wikipedia.org/wiki/Execution_of_Mohammad_Mehdi_Karami', 'OTHER', '2023-01-07');

    RAISE NOTICE 'Mohammad Mahdi Karami inserted with id: %', v_id;
  END IF;

  -- ─── 2. Seyed Mohammad Hosseini ───────────────────────────────────────────
  -- Born Feb 21, 1983 — arrested Nov 3, 2022, executed Jan 7, 2023, age 39
  -- Kickboxing national champion (2003), volunteer martial arts coach
  IF EXISTS (SELECT 1 FROM victims WHERE slug = 'hosseini-seyed-mohammad-2023') THEN
    RAISE NOTICE 'Seyed Mohammad Hosseini already exists, skipping.';
  ELSE
    INSERT INTO victims (
      slug, name_latin, name_farsi, gender,
      date_of_birth, date_of_death, age_at_death,
      place_of_death, city_id,
      cause_of_death, circumstances_en, circumstances_fa,
      verification_status, data_source
    ) VALUES (
      'hosseini-seyed-mohammad-2023',
      'Seyed Mohammad Hosseini',
      'سیدمحمد حسینی',
      'male',
      '1983-02-21',
      '2023-01-07',
      39,
      'Karaj Central Prison (زندان مرکزی کرج)',
      city_karaj,
      'Execution » Hanging',
      'Seyed Mohammad Hosseini was executed on January 7, 2023, at Karaj Central Prison at the age of 39, simultaneously with Mohammad Mahdi Karami. He was arrested on November 3, 2022 — the day of the 40th-day memorial for Hadis Najafi — while on his way to the cemetery to visit his parents'' graves, a Thursday ritual he observed regularly. He was charged with Efsad-fel-arz ("Corruption on Earth" — افساد فی الارض) in connection with the alleged killing of Basij volunteer Seyed Ruhollah Ajamian. He had a documented practice of volunteering as a kickboxing and martial arts coach for teenagers, training them free of charge. He was a national kickboxing champion (2003). He denied all charges and was subjected to torture, with confessions extracted under duress. His devout nature and regular Thursday cemetery visits were widely noted as contradicting the prosecution''s portrait of him as a violent criminal. His execution was condemned internationally as a violation of international law.',
      'سیدمحمد حسینی در ۷ ژانویه ۲۰۲۳ در زندان مرکزی کرج، همزمان با محمد مهدی کرمی، در ۳۹ سالگی اعدام شد. او در روز مراسم چهلم هدیس نجفی، در حالی که برای زیارت قبر والدینش عازم قبرستان بود، دستگیر شد. قهرمان کیک‌بوکسینگ کشور (۲۰۰۳) و مربی داوطلب هنرهای رزمی برای نوجوانان بود. او زیر شکنجه قرار گرفت و تمام اتهامات را رد کرد.',
      'verified',
      'hengaw'
    ) RETURNING id INTO v_id;

    INSERT INTO sources (victim_id, name, url, source_type, published_date)
    VALUES
      (v_id, 'Hengaw — Death Sentences of Karami and Hosseini Carried Out',
       'https://hengaw.net/en/news/2023/01/the-death-sentences-of-mohammad-mehdi-karmi-and-seyed-mohammad-hosseini-were-carried-out', 'HUMAN_RIGHTS_ORG', '2023-01-07'),
      (v_id, 'CNN — Karate Champion Executed in Iran',
       'https://www.cnn.com/2023/01/07/middleeast/iran-protesters-executed-intl-hnk/index.html', 'MEDIA', '2023-01-07'),
      (v_id, 'Wikipedia — Execution of Seyyed Mohammad Hosseini',
       'https://en.wikipedia.org/wiki/Execution_of_Seyyed_Mohammad_Hosseini', 'OTHER', '2023-01-07');

    RAISE NOTICE 'Seyed Mohammad Hosseini inserted with id: %', v_id;
  END IF;

  -- ─── 3. Mohammad Ghobadlou ────────────────────────────────────────────────
  -- Born ~2000 (exact date unconfirmed), age 23 at execution
  -- Documented bipolar disorder since age 15; Supreme Court overruled his execution — ignored
  -- Arrested during 2022 WLF protests in Robat Karim, Tehran Province
  -- Executed Jan 23, 2024 in violation of Supreme Court's own annulment order
  IF EXISTS (SELECT 1 FROM victims WHERE slug = 'ghobadlou-mohammad-2024') THEN
    RAISE NOTICE 'Mohammad Ghobadlou already exists, skipping.';
  ELSE
    INSERT INTO victims (
      slug, name_latin, name_farsi, gender,
      date_of_death, age_at_death,
      place_of_death, city_id,
      cause_of_death, circumstances_en, circumstances_fa,
      verification_status, data_source
    ) VALUES (
      'ghobadlou-mohammad-2024',
      'Mohammad Ghobadlou',
      'محمد قبادلو',
      'male',
      '2024-01-23',
      23,
      'Tehran (prison, undisclosed)',
      city_tehran,
      'Execution » Hanging',
      'Mohammad Ghobadlou was executed on January 23, 2024, at the age of approximately 23. He was arrested in connection with the September 2022 Woman, Life, Freedom protests in Robat Karim (on the outskirts of Tehran Province). He was accused of intentionally driving a vehicle into police officer Farid Karampour Hassanvand, killing him, and injuring five other officers. He was charged with Moharebeh ("waging war against God" — محاربه). Ghobadlou had a documented psychiatric history: he had been under the care of a psychiatric hospital for bipolar disorder since the age of 15. Over 50 Iranian psychiatrists submitted formal letters calling for a thorough mental health evaluation, arguing that Iranian law and international standards should preclude the death penalty in his case. In a remarkable legal development, Branch 1 of Iran''s Supreme Court annulled his death sentence on August 26, 2023 and ordered a retrial — a decision that was subsequently ignored by the authorities. He was executed despite the Supreme Court''s own ruling, making his execution a direct violation of the country''s own judicial framework. UN experts condemned the execution. He was the seventh person known to be executed in connection with the 2022 uprising.',
      'محمد قبادلو در ۲۳ ژانویه ۲۰۲۴ در حدود ۲۳ سالگی اعدام شد. در جریان اعتراضات مهر ۱۴۰۱ در رباط کریم دستگیر شد. سابقه پزشکی مستند اختلال دوقطبی از ۱۵ سالگی داشت و بیش از ۵۰ روانپزشک ایرانی خواستار ارزیابی کامل بهداشت روانش شدند. دیوان عالی کشور در ۲۶ اوت ۲۰۲۳ حکم اعدام او را نقض کرد و دستور محاکمه مجدد داد — اما مقامات این حکم را نادیده گرفتند و او را به اعدام رساندند. این اعدام نقض آشکار نظام قضایی خود کشور بود.',
      'verified',
      'hengaw'
    ) RETURNING id INTO v_id;

    INSERT INTO sources (victim_id, name, url, source_type, published_date)
    VALUES
      (v_id, 'CNN — Iran Executes Protester with Mental Health Condition',
       'https://www.cnn.com/2024/01/23/middleeast/iran-executes-protester-mental-health-intl-hnk/index.html', 'MEDIA', '2024-01-23'),
      (v_id, 'TIME — Iran Hangs 23-Year-Old Despite Bipolar Disorder',
       'https://time.com/6565282/iran-executes-mohammad-ghobadlou-mahsa-amini-protesters/', 'MEDIA', '2024-01-23'),
      (v_id, 'OHCHR — UN Experts Urge Iran to Respect International Law',
       'https://www.ohchr.org/en/press-releases/2024/01/un-experts-urge-iran-respect-international-law-and-stop-horrific-executions', 'UN', '2024-01-22'),
      (v_id, 'Wikipedia — Execution of Mohammad Ghobadlou',
       'https://en.m.wikipedia.org/wiki/Execution_of_Mohammad_Ghobadlou', 'OTHER', '2024-01-23');

    RAISE NOTICE 'Mohammad Ghobadlou inserted with id: %', v_id;
  END IF;

END $$;
