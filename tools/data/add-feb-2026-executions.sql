-- Executions in Iran — February 8–17, 2026 (50 named individuals)
-- Sources:
--   NCRI: https://www.ncr-iran.org/en/news/human-rights/stop-executions-in-iran/irans-regime-executed-99-prisoners-from-february-3-to-10/
--   NCRI: https://www.ncr-iran.org/en/ncri-statements/statement-human-rights/irans-regime-executes-21-prisoners-in-mid-february-two-women-among-830-executed-under-pezeshkian/
--   IranHR: https://iranhr.net/en/articles/8597/ (Rahman Najafi)
-- Note: These are state-ordered executions documented by NCRI and IranHR.
--       Most individuals were charged with drug or homicide (Qisas) offences.
--       Ages unknown for most. Included as victims of Iran's state execution apparatus.

DO $$
DECLARE
  ncri_src_a TEXT := 'https://www.ncr-iran.org/en/news/human-rights/stop-executions-in-iran/irans-regime-executed-99-prisoners-from-february-3-to-10/';
  ncri_src_b TEXT := 'https://www.ncr-iran.org/en/ncri-statements/statement-human-rights/irans-regime-executes-21-prisoners-in-mid-february-two-women-among-830-executed-under-pezeshkian/';

  -- City IDs
  c_ahvaz INT; c_isfahan INT; c_qom INT; c_qazvin INT; c_tabriz INT;
  c_bandar_abbas INT; c_arak INT; c_borujerd INT; c_semnan INT;
  c_ardabil INT; c_nowshahr INT; c_kashan INT; c_saveh INT;
  c_dorud INT; c_neyshabur INT; c_gorgan INT; c_quchan INT;
  c_qaemshahr INT; c_sari INT; c_shiraz INT; c_sabzevar INT;
  c_yazd INT; c_lahijan INT; c_rasht INT; c_chabahar INT;
  c_damghan INT; c_sirjan INT; c_mahabad INT; c_malayer INT;
  c_jiroft INT; c_bam INT; c_birjand INT; c_ilam INT;
  c_borazjan INT; c_zanjan INT; c_aligudarz INT; c_ramhormoz INT;
  c_khaf INT;

  v_id UUID;
BEGIN
  -- Load city IDs
  SELECT id INTO c_ahvaz FROM cities WHERE slug='ahvaz';
  SELECT id INTO c_isfahan FROM cities WHERE slug='isfahan';
  SELECT id INTO c_qom FROM cities WHERE slug='qom';
  SELECT id INTO c_qazvin FROM cities WHERE slug='qazvin';
  SELECT id INTO c_tabriz FROM cities WHERE slug='tabriz';
  SELECT id INTO c_bandar_abbas FROM cities WHERE slug='bandar-abbas';
  SELECT id INTO c_arak FROM cities WHERE slug='arak';
  SELECT id INTO c_borujerd FROM cities WHERE slug='borujerd';
  SELECT id INTO c_semnan FROM cities WHERE slug='semnan';
  SELECT id INTO c_ardabil FROM cities WHERE slug='ardabil';
  SELECT id INTO c_nowshahr FROM cities WHERE slug='nowshahr';
  SELECT id INTO c_kashan FROM cities WHERE slug='kashan';
  SELECT id INTO c_saveh FROM cities WHERE slug='saveh';
  SELECT id INTO c_dorud FROM cities WHERE slug='dorud';
  SELECT id INTO c_neyshabur FROM cities WHERE slug='neyshabur';
  SELECT id INTO c_gorgan FROM cities WHERE slug='gorgan';
  SELECT id INTO c_quchan FROM cities WHERE slug='quchan';
  SELECT id INTO c_qaemshahr FROM cities WHERE slug='qaemshahr';
  SELECT id INTO c_sari FROM cities WHERE slug='sari';
  SELECT id INTO c_shiraz FROM cities WHERE slug='shiraz';
  SELECT id INTO c_sabzevar FROM cities WHERE slug='sabzevar';
  SELECT id INTO c_yazd FROM cities WHERE slug='yazd';
  SELECT id INTO c_lahijan FROM cities WHERE slug='lahijan';
  SELECT id INTO c_rasht FROM cities WHERE slug='rasht';
  SELECT id INTO c_chabahar FROM cities WHERE slug='chabahar';
  SELECT id INTO c_damghan FROM cities WHERE slug='damghan';
  SELECT id INTO c_sirjan FROM cities WHERE slug='sirjan';
  SELECT id INTO c_mahabad FROM cities WHERE slug='mahabad';
  SELECT id INTO c_malayer FROM cities WHERE slug='malayer';
  SELECT id INTO c_jiroft FROM cities WHERE slug='jiroft';
  SELECT id INTO c_bam FROM cities WHERE slug='bam';
  SELECT id INTO c_birjand FROM cities WHERE slug='birjand';
  SELECT id INTO c_ilam FROM cities WHERE slug='ilam';
  SELECT id INTO c_borazjan FROM cities WHERE slug='borazjan';
  SELECT id INTO c_zanjan FROM cities WHERE slug='zanjan';
  SELECT id INTO c_aligudarz FROM cities WHERE slug='aligudarz';
  SELECT id INTO c_ramhormoz FROM cities WHERE slug='ramhormoz';
  SELECT id INTO c_khaf FROM cities WHERE slug='khaf';

  -- Helper: insert one execution victim
  -- We use a macro-style insert to keep things DRY

  -- ═══ FEBRUARY 8, 2026 ══════════════════════════════════════════════════════

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='eyvazi-nasser-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, age_at_death, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('eyvazi-nasser-2026','Nasser Eyvazi','ناصر ایوازی','male',30,'2026-02-08',c_ahvaz,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Nasser Eyvazi';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='sajadi-amrollah-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, age_at_death, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('sajadi-amrollah-2026','Amrollah Sajadi','امراللہ سجادی','male',27,'2026-02-08',c_ahvaz,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Amrollah Sajadi';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='karyabi-hamid-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, place_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('karyabi-hamid-2026','Hamid Karyabi','حامد کاریابی','male','2026-02-08','Nain, Isfahan Province',c_isfahan,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Hamid Karyabi';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='abdi-danial-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('abdi-danial-2026','Danial Abdi','دانیال عبدی','male','2026-02-08',c_qom,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Danial Abdi';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='taghi-zadeh-parsa-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('taghi-zadeh-parsa-2026','Parsa Taghi-Zadeh','پارسا تقی‌زاده','male','2026-02-08',c_qazvin,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Parsa Taghi-Zadeh';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='bagheri-younes-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('bagheri-younes-2026','Younes Bagheri','یونس باقری','male','2026-02-08',c_tabriz,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Younes Bagheri';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='tajik-nezam-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, place_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('tajik-nezam-2026','Nezam Tajik','نظام تاجیک','male','2026-02-08','Bandar Abbas, Hormozgan Province',c_bandar_abbas,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Nezam Tajik';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='najafi-rahman-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, circumstances_en, verification_status, data_source)
    VALUES ('najafi-rahman-2026','Rahman Najafi','رحمان نجفی','male','2026-02-08',c_arak,'Execution (hanging)','Executed in Arak for drug offences. Documented by IranHR (article 8597).','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES
      (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10'),
      (v_id,'IranHR — Rahman Najafi Hanged for Drug Offences','https://iranhr.net/en/articles/8597/','NGO','2026-02-08');
    RAISE NOTICE 'Inserted: Rahman Najafi';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='qaed-rahimi-shahmir-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('qaed-rahimi-shahmir-2026','Shah-Mirza Qaed-Rahimi','شاه‌میرزا قائدرحیمی','male','2026-02-08',c_borujerd,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Shah-Mirza Qaed-Rahimi';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='khordbin-abbas-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('khordbin-abbas-2026','Abbas Khordbin','عباس خردبین','male','2026-02-08',c_semnan,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Abbas Khordbin';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='jafarian-mehdi-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('jafarian-mehdi-2026','Mehdi Jafarian','مهدی جعفریان','male','2026-02-08',c_ardabil,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Mehdi Jafarian';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='hosseini-khaled-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('hosseini-khaled-2026','Khaled Hosseini','خالد حسینی','male','2026-02-08',c_nowshahr,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Khaled Hosseini';
  END IF;

  -- ═══ FEBRUARY 9, 2026 ══════════════════════════════════════════════════════

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='kalami-seid-ali-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('kalami-seid-ali-2026','Seid-Ali Kalami','سیدعلی کلامی','male','2026-02-09',c_kashan,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Seid-Ali Kalami';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='akbari-keyvan-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('akbari-keyvan-2026','Keyvan Akbari','کیوان اکبری','male','2026-02-09',c_isfahan,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Keyvan Akbari';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='shoukhi-houshang-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('shoukhi-houshang-2026','Houshang Shoukhi','هوشنگ شوخی','male','2026-02-09',c_saveh,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Houshang Shoukhi';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='dolatabadi-shahla-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, circumstances_en, verification_status, data_source)
    VALUES ('dolatabadi-shahla-2026','Shahla Dolatabadi','شهلا دولت‌آبادی','female','2026-02-09',c_kerman,'Execution (hanging)','Shahla Dolatabadi was executed in Kerman Prison on February 9, 2026. She was one of the women executed during this wave of mass executions under President Pezeshkian.','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES
      (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10'),
      (v_id,'WNCRI — Shahla Dolatabadi Executed in Kerman','https://wncri.org/2026/02/09/shahla-dowlatabadi-executed-in-kerman-prison/','NGO','2026-02-09');
    RAISE NOTICE 'Inserted: Shahla Dolatabadi (female)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='javadi-karim-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('javadi-karim-2026','Karim Javadi','کریم جوادی','male','2026-02-09',c_zanjan,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Karim Javadi';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='rezaei-mohsen-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('rezaei-mohsen-2026','Mohsen Rezaei','محسن رضایی','male','2026-02-09',c_dorud,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Mohsen Rezaei';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='ahmadi-abedin-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('ahmadi-abedin-2026','Abedin Ahmadi','عابدین احمدی','male','2026-02-09',c_neyshabur,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Abedin Ahmadi';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='zali-tabar-mohammad-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('zali-tabar-mohammad-2026','Mohammad Zali-Tabar','محمد زالی‌تبار','male','2026-02-09',c_gorgan,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Mohammad Zali-Tabar';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='amanat-doust-rouzbeh-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('amanat-doust-rouzbeh-2026','Rouzbeh Amanat-Doust','روزبه امانت‌دوست','male','2026-02-09',c_quchan,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Rouzbeh Amanat-Doust';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='tojihi-shayan-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('tojihi-shayan-2026','Shayan Tojihi','شایان توجهی','male','2026-02-09',c_qaemshahr,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Shayan Tojihi';
  END IF;

  -- ═══ FEBRUARY 10, 2026 ═════════════════════════════════════════════════════

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='faraji-nejad-kazem-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('faraji-nejad-kazem-2026','Kazem Faraji-Nejad','کاظم فرجی‌نژاد','male','2026-02-10',c_sari,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Kazem Faraji-Nejad';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='shirzad-taha-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('shirzad-taha-2026','Taha Shirzad','طاها شیرزاد','male','2026-02-10',c_sari,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Taha Shirzad';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='pirvani-pirooz-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('pirvani-pirooz-2026','Pirooz Pirvani','پیروز پیروانی','male','2026-02-10',c_shiraz,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Pirooz Pirvani';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='aray-rajabali-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('aray-rajabali-2026','Rajabali Aray','رجبعلی آرای','male','2026-02-10',c_sabzevar,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Rajabali Aray';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='ghanbari-afshin-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('ghanbari-afshin-2026','Afshin Ghanbari','افشین قنبری','male','2026-02-10',c_yazd,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Afshin Ghanbari';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='sarfi-ayoub-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('sarfi-ayoub-2026','Ayoub Sarfi','ایوب صرفی','male','2026-02-10',c_khaf,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Ayoub Sarfi';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='niazi-mahmoud-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('niazi-mahmoud-2026','Mahmoud Niazi','محمود نیازی','male','2026-02-10',c_lahijan,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Mahmoud Niazi';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='mokhtari-yadollah-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('mokhtari-yadollah-2026','Yadollah Mokhtari','یداللہ مختاری','male','2026-02-10',c_sirjan,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Yadollah Mokhtari';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='barani-mojtaba-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('barani-mojtaba-2026','Mojtaba Barani','مجتبی برانی','male','2026-02-10',c_rasht,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Mojtaba Barani';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='bazargan-ali-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('bazargan-ali-2026','Ali Bazargan','علی بازرگان','male','2026-02-10',c_chabahar,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Ali Bazargan';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='ali-nia-mehrshad-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('ali-nia-mehrshad-2026','Mehrshad Ali-Nia','مهرشاد علی‌نیا','male','2026-02-10',c_damghan,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Mehrshad Ali-Nia';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='torkaman-amin-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('torkaman-amin-2026','Amin Torkaman','امین ترکمان','male','2026-02-10',c_malayer,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Amin Torkaman';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='zalpour-taghi-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('zalpour-taghi-2026','Taghi Zalpour','تقی زال‌پور','male','2026-02-10',c_mahabad,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Taghi Zalpour';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='jahromi-morad-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('jahromi-morad-2026','Morad Jahromi','مراد جهرومی','male','2026-02-10',c_jiroft,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Morad Jahromi';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='najjar-javad-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('najjar-javad-2026','Javad Najjar','جواد نجار','male','2026-02-10',c_ahvaz,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Javad Najjar';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='maleki-sina-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('maleki-sina-2026','Sina Maleki','سینا ملکی','male','2026-02-10',c_borazjan,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Sina Maleki';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='jafari-mohammadkaram-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('jafari-mohammadkaram-2026','Mohammad-Karam Jafari','محمدکرم جعفری','male','2026-02-10',c_ilam,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Mohammad-Karam Jafari';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='saljoghi-fariborz-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('saljoghi-fariborz-2026','Fariborz Saljoghi','فریبرز سالجوقی','male','2026-02-10',c_bam,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Fariborz Saljoghi';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='hassani-gholam-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('hassani-gholam-2026','Gholam Hassani','غلام حسنی','male','2026-02-10',c_birjand,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Executions Feb 3-10, 2026',ncri_src_a,'NGO','2026-02-10');
    RAISE NOTICE 'Inserted: Gholam Hassani';
  END IF;

  -- ═══ FEBRUARY 13, 2026 ═════════════════════════════════════════════════════

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='kheirollahpour-younes-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('kheirollahpour-younes-2026','Younes Kheirollahpour','یونس خیراللہ‌پور','male','2026-02-13',c_aligudarz,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Mid-February Executions 2026',ncri_src_b,'NGO','2026-02-17');
    RAISE NOTICE 'Inserted: Younes Kheirollahpour';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='valizadeh-mokhtar-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, circumstances_en, verification_status, data_source)
    VALUES ('valizadeh-mokhtar-2026','Mokhtar Valizadeh','مختار ولی‌زاده','male','2026-02-13',c_shiraz,'Execution (hanging)','Executed in Adelabad Prison, Shiraz for homicide (Qisas).','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Mid-February Executions 2026',ncri_src_b,'NGO','2026-02-17');
    RAISE NOTICE 'Inserted: Mokhtar Valizadeh';
  END IF;

  -- ═══ FEBRUARY 15, 2026 ═════════════════════════════════════════════════════

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='kord-ali-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('kord-ali-2026','Ali Kord','علی کرد','male','2026-02-15',c_ramhormoz,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Mid-February Executions 2026',ncri_src_b,'NGO','2026-02-17');
    RAISE NOTICE 'Inserted: Ali Kord';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='bamari-abbas-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('bamari-abbas-2026','Abbas Bamari','عباس بامری','male','2026-02-15',c_birjand,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Mid-February Executions 2026',ncri_src_b,'NGO','2026-02-17');
    RAISE NOTICE 'Inserted: Abbas Bamari';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='najafi-esmat-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, circumstances_en, verification_status, data_source)
    VALUES ('najafi-esmat-2026','Esmat Najafi','عصمت نجفی','female','2026-02-15',c_qom,'Execution (hanging)','Esmat Najafi was executed in Qom Prison on February 15, 2026, for homicide. She was one of two women executed in the mid-February wave of executions under President Pezeshkian.','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Mid-February Executions 2026',ncri_src_b,'NGO','2026-02-17');
    RAISE NOTICE 'Inserted: Esmat Najafi (female)';
  END IF;

  -- ═══ FEBRUARY 17, 2026 ═════════════════════════════════════════════════════

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='babaei-heydar-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('babaei-heydar-2026','Heydar Babaei','حیدر بابایی','male','2026-02-17',c_isfahan,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Mid-February Executions 2026',ncri_src_b,'NGO','2026-02-17');
    RAISE NOTICE 'Inserted: Heydar Babaei';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM victims WHERE slug='vasimollahi-burhan-2026') THEN
    INSERT INTO victims (slug, name_latin, name_farsi, gender, date_of_death, city_id, cause_of_death, verification_status, data_source)
    VALUES ('vasimollahi-burhan-2026','Burhan Vasimollahi','برهان واصمواللهی','male','2026-02-17',c_isfahan,'Execution (hanging)','unverified','ncri') RETURNING id INTO v_id;
    INSERT INTO sources (victim_id, name, url, source_type, published_date) VALUES (v_id,'NCRI — Mid-February Executions 2026',ncri_src_b,'NGO','2026-02-17');
    RAISE NOTICE 'Inserted: Burhan Vasimollahi';
  END IF;

END $$;
