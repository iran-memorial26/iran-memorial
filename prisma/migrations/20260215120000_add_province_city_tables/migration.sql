-- CreateTable: provinces
CREATE TABLE "provinces" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_fa" TEXT NOT NULL,
    "name_de" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable: cities
CREATE TABLE "cities" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_fa" TEXT,
    "name_de" TEXT,
    "province_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- AddColumn: victims.city_id
ALTER TABLE "victims" ADD COLUMN "city_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "provinces_slug_key" ON "provinces"("slug");
CREATE UNIQUE INDEX "cities_slug_key" ON "cities"("slug");
CREATE INDEX "cities_province_id_idx" ON "cities"("province_id");
CREATE INDEX "victims_city_id_idx" ON "victims"("city_id");

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "victims" ADD CONSTRAINT "victims_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- SEED: 31 Provinces (lat/lng from IranMap.tsx, names trilingual)
-- ============================================================

INSERT INTO "provinces" ("slug", "name_en", "name_fa", "name_de", "latitude", "longitude") VALUES
('tehran',              'Tehran',                       'تهران',                  'Teheran',                    35.6892, 51.3890),
('isfahan',             'Isfahan',                      'اصفهان',                 'Isfahan',                    32.6546, 51.6680),
('fars',                'Fars',                         'فارس',                   'Fars',                       29.5918, 52.5837),
('khuzestan',           'Khuzestan',                    'خوزستان',                'Chusestan',                  31.3203, 48.6693),
('kurdistan',           'Kurdistan',                    'کردستان',                'Kurdistan',                  35.3219, 46.9862),
('kermanshah',          'Kermanshah',                   'کرمانشاه',               'Kermanschah',                34.3142, 47.0650),
('west-azerbaijan',     'West Azerbaijan',              'آذربایجان غربی',         'West-Aserbaidschan',         37.5513, 45.0000),
('east-azerbaijan',     'East Azerbaijan',              'آذربایجان شرقی',         'Ost-Aserbaidschan',          38.0667, 46.3000),
('khorasan-e-razavi',   'Khorasan-e Razavi',            'خراسان رضوی',            'Razavi-Chorasan',            36.2972, 59.6057),
('mazandaran',          'Mazandaran',                   'مازندران',               'Mazandaran',                 36.5659, 53.0588),
('gilan',               'Gilan',                        'گیلان',                  'Gilan',                      37.2682, 49.5891),
('alborz',              'Alborz',                       'البرز',                  'Alborz',                     35.8325, 50.9915),
('sistan-va-baluchestan','Sistan va Baluchestan',        'سیستان و بلوچستان',      'Sistan und Belutschistan',   29.4963, 60.8629),
('lorestan',            'Lorestan',                     'لرستان',                 'Lorestan',                   33.4340, 48.3564),
('hormozgan',           'Hormozgan',                    'هرمزگان',                'Hormozgan',                  27.1865, 56.2808),
('markazi',             'Markazi',                      'مرکزی',                  'Markazi',                    34.0954, 49.6983),
('hamadan',             'Hamadan',                      'همدان',                  'Hamadan',                    34.7981, 48.5146),
('zanjan',              'Zanjan',                       'زنجان',                  'Zandschan',                  36.6736, 48.4787),
('qom',                 'Qom',                          'قم',                     'Ghom',                       34.6416, 50.8746),
('semnan',              'Semnan',                       'سمنان',                  'Semnan',                     35.5769, 53.3953),
('yazd',                'Yazd',                         'یزد',                    'Yazd',                       31.8974, 54.3569),
('ardabil',             'Ardabil',                      'اردبیل',                 'Ardabil',                    38.2498, 48.2933),
('bushehr',             'Bushehr',                      'بوشهر',                  'Buschehr',                   28.9234, 50.8203),
('chaharmahal-bakhtiari','Chaharmahal and Bakhtiari',   'چهارمحال و بختیاری',     'Tschahārmahal und Bachtiari',32.3256, 50.8645),
('ilam',                'Ilam',                         'ایلام',                  'Ilam',                       33.6374, 46.4227),
('kohgiluyeh-boyer-ahmad','Kohgiluyeh and Boyer-Ahmad', 'کهگیلویه و بویراحمد',    'Kohgiluye und Boyer-Ahmad',  30.6598, 51.6042),
('north-khorasan',      'North Khorasan',               'خراسان شمالی',           'Nord-Chorasan',              37.4712, 57.3315),
('south-khorasan',      'South Khorasan',               'خراسان جنوبی',           'Süd-Chorasan',               32.8505, 59.2164),
('qazvin',              'Qazvin',                       'قزوین',                  'Qazvin',                     36.2688, 50.0041),
('golestan',            'Golestan',                     'گلستان',                 'Golestan',                   37.2502, 55.1376),
('kerman',              'Kerman',                       'کرمان',                  'Kerman',                     30.2839, 57.0834);

-- ============================================================
-- SEED: Cities (~70 unique cities from PROVINCE_MAP + FARSI_CITY_MAP)
-- ============================================================

-- Tehran province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('tehran',      'Tehran',       'تهران',    'Teheran',  (SELECT id FROM provinces WHERE slug = 'tehran')),
('varamin',     'Varamin',      'ورامین',   NULL,       (SELECT id FROM provinces WHERE slug = 'tehran')),
('eslamshahr',  'Eslamshahr',   'اسلامشهر', NULL,       (SELECT id FROM provinces WHERE slug = 'tehran')),
('shahriar',    'Shahriar',     'شهریار',   NULL,       (SELECT id FROM provinces WHERE slug = 'tehran')),
('pakdasht',    'Pakdasht',     'پاکدشت',   NULL,       (SELECT id FROM provinces WHERE slug = 'tehran'));

-- Isfahan province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('isfahan',     'Isfahan',      'اصفهان',   'Isfahan',  (SELECT id FROM provinces WHERE slug = 'isfahan'));

-- Fars province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('shiraz',      'Shiraz',       'شیراز',    'Schiras',  (SELECT id FROM provinces WHERE slug = 'fars'));

-- Khuzestan province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('ahvaz',       'Ahvaz',        'اهواز',    NULL,       (SELECT id FROM provinces WHERE slug = 'khuzestan')),
('dezful',      'Dezful',       'دزفول',    NULL,       (SELECT id FROM provinces WHERE slug = 'khuzestan')),
('abadan',      'Abadan',       'آبادان',   NULL,       (SELECT id FROM provinces WHERE slug = 'khuzestan')),
('behbahan',    'Behbahan',     'بهبهان',   NULL,       (SELECT id FROM provinces WHERE slug = 'khuzestan')),
('izeh',        'Izeh',         'ایذه',     NULL,       (SELECT id FROM provinces WHERE slug = 'khuzestan')),
('andimeshk',   'Andimeshk',    'اندیمشک',  NULL,       (SELECT id FROM provinces WHERE slug = 'khuzestan'));

-- Kurdistan province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('sanandaj',    'Sanandaj',     'سنندج',    NULL,       (SELECT id FROM provinces WHERE slug = 'kurdistan')),
('saqqez',      'Saqqez',       'سقز',      NULL,       (SELECT id FROM provinces WHERE slug = 'kurdistan')),
('marivan',     'Marivan',      'مریوان',   NULL,       (SELECT id FROM provinces WHERE slug = 'kurdistan'));

-- Kermanshah province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('kermanshah',  'Kermanshah',   'کرمانشاه', 'Kermanschah', (SELECT id FROM provinces WHERE slug = 'kermanshah')),
('javanrud',    'Javanrud',     'جوانرود',  NULL,       (SELECT id FROM provinces WHERE slug = 'kermanshah'));

-- West Azerbaijan province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('urmia',       'Urmia',        'ارومیه',   'Urmia',    (SELECT id FROM provinces WHERE slug = 'west-azerbaijan')),
('mahabad',     'Mahabad',      'مهاباد',   NULL,       (SELECT id FROM provinces WHERE slug = 'west-azerbaijan')),
('bukan',       'Bukan',        'بوکان',    NULL,       (SELECT id FROM provinces WHERE slug = 'west-azerbaijan')),
('piranshahr',  'Piranshahr',   'پیرانشهر', NULL,       (SELECT id FROM provinces WHERE slug = 'west-azerbaijan')),
('oshnavieh',   'Oshnavieh',    'اشنویه',   NULL,       (SELECT id FROM provinces WHERE slug = 'west-azerbaijan'));

-- East Azerbaijan province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('tabriz',      'Tabriz',       'تبریز',    'Täbris',   (SELECT id FROM provinces WHERE slug = 'east-azerbaijan'));

-- Khorasan-e Razavi province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('mashhad',     'Mashhad',      'مشهد',     'Maschhad', (SELECT id FROM provinces WHERE slug = 'khorasan-e-razavi')),
('neyshabur',   'Neyshabur',    'نیشابور',  NULL,       (SELECT id FROM provinces WHERE slug = 'khorasan-e-razavi')),
('sabzevar',    'Sabzevar',     'سبزوار',   NULL,       (SELECT id FROM provinces WHERE slug = 'khorasan-e-razavi'));

-- Mazandaran province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('sari',        'Sari',         'ساری',     NULL,       (SELECT id FROM provinces WHERE slug = 'mazandaran')),
('amol',        'Amol',         'آمل',      NULL,       (SELECT id FROM provinces WHERE slug = 'mazandaran')),
('babol',       'Babol',        'بابل',     NULL,       (SELECT id FROM provinces WHERE slug = 'mazandaran')),
('nowshahr',    'Nowshahr',     'نوشهر',    NULL,       (SELECT id FROM provinces WHERE slug = 'mazandaran'));

-- Gilan province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('rasht',       'Rasht',        'رشت',      NULL,       (SELECT id FROM provinces WHERE slug = 'gilan')),
('lahijan',     'Lahijan',      'لاهیجان',  NULL,       (SELECT id FROM provinces WHERE slug = 'gilan')),
('bandar-anzali','Bandar Anzali','بندر انزلی',NULL,      (SELECT id FROM provinces WHERE slug = 'gilan'));

-- Alborz province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('karaj',       'Karaj',        'کرج',      NULL,       (SELECT id FROM provinces WHERE slug = 'alborz'));

-- Sistan va Baluchestan province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('zahedan',     'Zahedan',      'زاهدان',   NULL,       (SELECT id FROM provinces WHERE slug = 'sistan-va-baluchestan')),
('chabahar',    'Chabahar',     'چابهار',   NULL,       (SELECT id FROM provinces WHERE slug = 'sistan-va-baluchestan')),
('iranshahr',   'Iranshahr',    'ایرانشهر', NULL,       (SELECT id FROM provinces WHERE slug = 'sistan-va-baluchestan')),
('khash',       'Khash',        'خاش',      NULL,       (SELECT id FROM provinces WHERE slug = 'sistan-va-baluchestan')),
('saravan',     'Saravan',      'سراوان',   NULL,       (SELECT id FROM provinces WHERE slug = 'sistan-va-baluchestan'));

-- Lorestan province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('khorramabad', 'Khorramabad',  'خرم‌آباد',  NULL,       (SELECT id FROM provinces WHERE slug = 'lorestan'));

-- Hormozgan province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('bandar-abbas','Bandar Abbas', 'بندرعباس', NULL,       (SELECT id FROM provinces WHERE slug = 'hormozgan'));

-- Markazi province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('arak',        'Arak',         'اراک',     NULL,       (SELECT id FROM provinces WHERE slug = 'markazi')),
('saveh',       'Saveh',        'ساوه',     NULL,       (SELECT id FROM provinces WHERE slug = 'markazi'));

-- Hamadan province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('hamadan',     'Hamadan',      'همدان',    'Hamadan',  (SELECT id FROM provinces WHERE slug = 'hamadan'));

-- Zanjan province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('zanjan',      'Zanjan',       'زنجان',    'Zandschan',(SELECT id FROM provinces WHERE slug = 'zanjan'));

-- Qom province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('qom',         'Qom',          'قم',       'Ghom',     (SELECT id FROM provinces WHERE slug = 'qom'));

-- Semnan province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('semnan',      'Semnan',       'سمنان',    NULL,       (SELECT id FROM provinces WHERE slug = 'semnan'));

-- Yazd province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('yazd',        'Yazd',         'یزد',      NULL,       (SELECT id FROM provinces WHERE slug = 'yazd'));

-- Ardabil province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('ardabil',     'Ardabil',      'اردبیل',   NULL,       (SELECT id FROM provinces WHERE slug = 'ardabil'));

-- Bushehr province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('bushehr',     'Bushehr',      'بوشهر',    'Buschehr', (SELECT id FROM provinces WHERE slug = 'bushehr'));

-- Chaharmahal and Bakhtiari province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('shahrekord',  'Shahrekord',   'شهرکرد',   NULL,       (SELECT id FROM provinces WHERE slug = 'chaharmahal-bakhtiari'));

-- Ilam province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('ilam',        'Ilam',         'ایلام',    NULL,       (SELECT id FROM provinces WHERE slug = 'ilam'));

-- Kohgiluyeh and Boyer-Ahmad province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('yasuj',       'Yasuj',        'یاسوج',    NULL,       (SELECT id FROM provinces WHERE slug = 'kohgiluyeh-boyer-ahmad'));

-- North Khorasan province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('bojnurd',     'Bojnurd',      'بجنورد',   NULL,       (SELECT id FROM provinces WHERE slug = 'north-khorasan'));

-- South Khorasan province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('birjand',     'Birjand',      'بیرجند',   NULL,       (SELECT id FROM provinces WHERE slug = 'south-khorasan'));

-- Qazvin province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('qazvin',      'Qazvin',       'قزوین',    NULL,       (SELECT id FROM provinces WHERE slug = 'qazvin'));

-- Golestan province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('gorgan',      'Gorgan',       'گرگان',    NULL,       (SELECT id FROM provinces WHERE slug = 'golestan'));

-- Kerman province cities
INSERT INTO "cities" ("slug", "name_en", "name_fa", "name_de", "province_id") VALUES
('kerman',      'Kerman',       'کرمان',    NULL,       (SELECT id FROM provinces WHERE slug = 'kerman')),
('bam',         'Bam',          'بم',       NULL,       (SELECT id FROM provinces WHERE slug = 'kerman')),
('rafsanjan',   'Rafsanjan',    'رفسنجان',  NULL,       (SELECT id FROM provinces WHERE slug = 'kerman')),
('sirjan',      'Sirjan',       'سیرجان',   NULL,       (SELECT id FROM provinces WHERE slug = 'kerman')),
('jiroft',      'Jiroft',       'جیرفت',    NULL,       (SELECT id FROM provinces WHERE slug = 'kerman'));

-- ============================================================
-- BACKFILL: Map existing place_of_death/province to city_id
-- ============================================================

-- Step 1: Direct city slug match on place_of_death
UPDATE victims v SET city_id = c.id
FROM cities c
WHERE LOWER(TRIM(v.place_of_death)) = c.slug
  AND v.city_id IS NULL;

-- Step 2: Match common place_of_death values to city slugs (with spaces/hyphens)
UPDATE victims v SET city_id = c.id
FROM cities c
WHERE REPLACE(LOWER(TRIM(v.place_of_death)), ' ', '-') = c.slug
  AND v.city_id IS NULL;

-- Step 3: Match province name to province capital city (when place_of_death is NULL)
UPDATE victims v SET city_id = c.id
FROM cities c
JOIN provinces p ON c.province_id = p.id
WHERE c.slug = p.slug  -- capital city has same slug as province (tehran, isfahan, etc.)
  AND LOWER(TRIM(v.province)) = LOWER(p.name_en)
  AND v.place_of_death IS NULL
  AND v.city_id IS NULL;

-- Step 4: Match place_of_death containing city name
UPDATE victims v SET city_id = c.id
FROM cities c
WHERE v.city_id IS NULL
  AND v.place_of_death IS NOT NULL
  AND LOWER(v.place_of_death) LIKE '%' || c.slug || '%'
  AND c.slug != 'bam'  -- avoid false positives for very short slugs
  AND c.slug != 'qom'
  AND LENGTH(c.slug) >= 4;

-- Step 5: Normalize province text to match enricher convention
-- (handles legacy data where province was stored with different naming)
UPDATE victims SET province = 'Khorasan-e Razavi'
WHERE province IN ('Khorasan', 'Razavi Khorasan', 'Khorasan\Khorasan-e Razavi');

UPDATE victims SET province = 'Sistan va Baluchestan'
WHERE province IN ('Sistan and Baluchestan', 'Sistan Va Baluchestan');
