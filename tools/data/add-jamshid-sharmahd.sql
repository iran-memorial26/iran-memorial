-- Jamshid Sharmahd (جمشید شارمهد) — Executed October 28, 2024
-- German-Iranian dissident, head of Tondar (Kingdom Assembly of Iran)
-- Abducted in Dubai (UAE) in July 2020; held incommunicado in Evin Prison
-- Germany expelled Iranian diplomats after the execution
-- Sources: OHCHR, German Federal Foreign Office, Amnesty International, IHRNGO, CNN

DO $$
DECLARE
  v_id UUID;
  city_tehran INT;
BEGIN
  SELECT id INTO city_tehran FROM cities WHERE slug = 'tehran' LIMIT 1;

  IF EXISTS (SELECT 1 FROM victims WHERE slug = 'sharmahd-jamshid-2024') THEN
    RAISE NOTICE 'Jamshid Sharmahd already exists, skipping.';
  ELSE
    INSERT INTO victims (
      slug, name_latin, name_farsi, gender,
      date_of_birth, date_of_death, age_at_death,
      place_of_death, city_id,
      cause_of_death, circumstances_en, circumstances_fa,
      verification_status, data_source
    ) VALUES (
      'sharmahd-jamshid-2024',
      'Jamshid Sharmahd',
      'جمشید شارمهد',
      'male',
      '1955-03-23',
      '2024-10-28',
      69,
      'Evin Prison, Tehran (place of execution undisclosed)',
      city_tehran,
      'Execution',
      'Jamshid Sharmahd was a German-Iranian dual national and long-time U.S. resident (Los Angeles) who served as the operational head and broadcaster of the Kingdom Assembly of Iran (Anjoman-e Padeshahi-ye Iran), also known as Tondar — a small monarchist exile opposition group. He was born on March 23, 1955 in Tehran, moved to West Germany as a child, and later earned an engineering degree and founded a software company. In late July 2020, he was abducted by agents of Iran''s Ministry of Intelligence while transiting through Dubai, UAE, awaiting a connecting flight to India. He was forcibly transferred to Iran in an operation that constituted enforced disappearance under international law. During his more than four years in detention — the bulk of which were spent in prolonged solitary confinement at Evin Prison — he was denied all consular access despite his German citizenship. He suffered from Parkinson''s disease and other serious health conditions and was denied adequate medical care. His trial, held in 2023, was condemned by Amnesty International, the German government, the United States, and the European Union as having relied on confessions extracted under torture. He was executed on October 28, 2024. The German Foreign Minister Annalena Baerbock called it "state-sanctioned murder." Germany subsequently expelled Iranian diplomats. The OHCHR characterized him as a victim of arbitrary detention. His case became one of the most internationally prominent Iranian executions in recent years.',
      'جمشید شارمهد، شهروند آلمانی-ایرانی و مقیم لس‌آنجلس، رهبر عملیاتی انجمن پادشاهی ایران (تندر) بود. او در تیر ۱۳۹۹ در فرودگاه دبی توسط عوامل وزارت اطلاعات ایران ربوده شد و به ایران منتقل گردید. در طول بیش از چهار سال بازداشت، عمدتاً در سلول انفرادی زندان اوین نگه داشته شد. از بیماری پارکینسون رنج می‌برد و از مراقبت پزشکی محروم بود. دادگاه او در سال ۲۰۲۳ برگزار شد و بر اساس اعترافاتی که زیر شکنجه گرفته شده بود محکوم شد. در ۲۸ اکتبر ۲۰۲۴ اعدام شد. آلمان پس از اعدام او دیپلمات‌های ایرانی را اخراج کرد.',
      'verified',
      'ohchr'
    ) RETURNING id INTO v_id;

    INSERT INTO sources (victim_id, name, url, source_type, published_date)
    VALUES
      (v_id, 'OHCHR — Iran: Experts Deplore Death in Custody of Victim of Arbitrary Detention',
       'https://www.ohchr.org/en/press-releases/2025/02/iran-experts-deplore-death-custody-victim-arbitrary-detention', 'UN', '2025-02-01'),
      (v_id, 'German Federal Foreign Office — Statement by FM Baerbock',
       'https://www.auswaertiges-amt.de/en/newsroom/news/2682082-2682082', 'GOVERNMENT', '2024-10-28'),
      (v_id, 'EU Council — Statement by the High Representative on the Execution',
       'https://www.consilium.europa.eu/en/press/press-releases/2024/10/29/iran-statement-by-the-high-representative-on-behalf-of-the-eu-on-the-execution-of-jamshid-sharmahd/', 'GOVERNMENT', '2024-10-29'),
      (v_id, 'Center for Human Rights in Iran — State-Sanctioned Murder',
       'https://iranhumanrights.org/2024/10/irans-execution-of-iranian-german-dissident-jamshid-sharmahd-is-state-sanctioned-murder/', 'HUMAN_RIGHTS_ORG', '2024-10-28'),
      (v_id, 'CNN — Jamshid Sharmahd Execution Report',
       'https://www.cnn.com/2024/10/28/middleeast/jamshid-sharmahd-iran-executed-intl/index.html', 'MEDIA', '2024-10-28'),
      (v_id, 'Iran Human Rights (IHRNGO)',
       'https://iranhr.net/en/articles/7055/', 'HUMAN_RIGHTS_ORG', '2024-10-28'),
      (v_id, 'Wikipedia — Jamshid Sharmahd',
       'https://en.wikipedia.org/wiki/Jamshid_Sharmahd', 'OTHER', '2024-10-28');

    RAISE NOTICE 'Jamshid Sharmahd inserted with id: %', v_id;
  END IF;

END $$;
