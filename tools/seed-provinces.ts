/**
 * Seed province + city data into the database.
 * Usage: npx tsx tools/seed-provinces.ts
 *
 * Populates the provinces and cities tables with all 31 Iranian provinces
 * and their major cities, enabling DB-driven map and filtering.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ProvinceData {
  slug: string;
  nameEn: string;
  nameFa: string;
  nameDe: string;
  latitude: number;
  longitude: number;
  cities: { slug: string; nameEn: string; nameFa?: string; nameDe?: string }[];
}

const PROVINCES: ProvinceData[] = [
  { slug: "tehran", nameEn: "Tehran", nameFa: "تهران", nameDe: "Teheran", latitude: 35.6892, longitude: 51.389, cities: [
    { slug: "tehran-city", nameEn: "Tehran", nameFa: "تهران", nameDe: "Teheran" },
    { slug: "karaj", nameEn: "Karaj", nameFa: "کرج" },
    { slug: "eslamshahr", nameEn: "Eslamshahr", nameFa: "اسلامشهر" },
    { slug: "shahriar", nameEn: "Shahriar", nameFa: "شهریار" },
  ]},
  { slug: "isfahan", nameEn: "Isfahan", nameFa: "اصفهان", nameDe: "Isfahan", latitude: 32.6546, longitude: 51.6680, cities: [
    { slug: "isfahan-city", nameEn: "Isfahan", nameFa: "اصفهان" },
    { slug: "najafabad", nameEn: "Najafabad", nameFa: "نجف‌آباد" },
    { slug: "shahinshahr", nameEn: "Shahinshahr", nameFa: "شاهین‌شهر" },
  ]},
  { slug: "fars", nameEn: "Fars", nameFa: "فارس", nameDe: "Fars", latitude: 29.5926, longitude: 52.5836, cities: [
    { slug: "shiraz", nameEn: "Shiraz", nameFa: "شیراز" },
    { slug: "marvdasht", nameEn: "Marvdasht", nameFa: "مرودشت" },
  ]},
  { slug: "razavi-khorasan", nameEn: "Razavi Khorasan", nameFa: "خراسان رضوی", nameDe: "Razavi-Chorasan", latitude: 36.2972, longitude: 59.6067, cities: [
    { slug: "mashhad", nameEn: "Mashhad", nameFa: "مشهد" },
    { slug: "neyshabur", nameEn: "Neyshabur", nameFa: "نیشابور" },
  ]},
  { slug: "khuzestan", nameEn: "Khuzestan", nameFa: "خوزستان", nameDe: "Chuzestan", latitude: 31.3203, longitude: 48.6693, cities: [
    { slug: "ahvaz", nameEn: "Ahvaz", nameFa: "اهواز" },
    { slug: "abadan", nameEn: "Abadan", nameFa: "آبادان" },
    { slug: "dezful", nameEn: "Dezful", nameFa: "دزفول" },
  ]},
  { slug: "alborz", nameEn: "Alborz", nameFa: "البرز", nameDe: "Alborz", latitude: 35.8400, longitude: 50.9391, cities: [
    { slug: "karaj-alborz", nameEn: "Karaj", nameFa: "کرج" },
  ]},
  { slug: "east-azerbaijan", nameEn: "East Azerbaijan", nameFa: "آذربایجان شرقی", nameDe: "Ost-Aserbaidschan", latitude: 38.0650, longitude: 46.2919, cities: [
    { slug: "tabriz", nameEn: "Tabriz", nameFa: "تبریز" },
    { slug: "maragheh", nameEn: "Maragheh", nameFa: "مراغه" },
  ]},
  { slug: "west-azerbaijan", nameEn: "West Azerbaijan", nameFa: "آذربایجان غربی", nameDe: "West-Aserbaidschan", latitude: 37.5513, longitude: 45.0761, cities: [
    { slug: "urmia", nameEn: "Urmia", nameFa: "ارومیه" },
    { slug: "mahabad", nameEn: "Mahabad", nameFa: "مهاباد" },
  ]},
  { slug: "kermanshah", nameEn: "Kermanshah", nameFa: "کرمانشاه", nameDe: "Kermanschah", latitude: 34.3142, longitude: 47.0650, cities: [
    { slug: "kermanshah-city", nameEn: "Kermanshah", nameFa: "کرمانشاه" },
    { slug: "javanrud", nameEn: "Javanrud", nameFa: "جوانرود" },
  ]},
  { slug: "mazandaran", nameEn: "Mazandaran", nameFa: "مازندران", nameDe: "Mazandaran", latitude: 36.5659, longitude: 53.0586, cities: [
    { slug: "sari", nameEn: "Sari", nameFa: "ساری" },
    { slug: "amol", nameEn: "Amol", nameFa: "آمل" },
    { slug: "babol", nameEn: "Babol", nameFa: "بابل" },
  ]},
  { slug: "kerman", nameEn: "Kerman", nameFa: "کرمان", nameDe: "Kerman", latitude: 30.2839, longitude: 57.0834, cities: [
    { slug: "kerman-city", nameEn: "Kerman", nameFa: "کرمان" },
  ]},
  { slug: "sistan-baluchestan", nameEn: "Sistan and Baluchestan", nameFa: "سیستان و بلوچستان", nameDe: "Sistan und Belutschistan", latitude: 27.5293, longitude: 60.5821, cities: [
    { slug: "zahedan", nameEn: "Zahedan", nameFa: "زاهدان" },
    { slug: "chabahar", nameEn: "Chabahar", nameFa: "چابهار" },
    { slug: "iranshahr", nameEn: "Iranshahr", nameFa: "ایرانشهر" },
  ]},
  { slug: "kurdistan", nameEn: "Kurdistan", nameFa: "کردستان", nameDe: "Kurdistan", latitude: 35.3219, longitude: 46.9862, cities: [
    { slug: "sanandaj", nameEn: "Sanandaj", nameFa: "سنندج" },
    { slug: "saqqez", nameEn: "Saqqez", nameFa: "سقز" },
    { slug: "marivan", nameEn: "Marivan", nameFa: "مریوان" },
  ]},
  { slug: "hamadan", nameEn: "Hamadan", nameFa: "همدان", nameDe: "Hamadan", latitude: 34.7989, longitude: 48.5146, cities: [
    { slug: "hamadan-city", nameEn: "Hamadan", nameFa: "همدان" },
  ]},
  { slug: "lorestan", nameEn: "Lorestan", nameFa: "لرستان", nameDe: "Lorestan", latitude: 33.4373, longitude: 48.3610, cities: [
    { slug: "khorramabad", nameEn: "Khorramabad", nameFa: "خرم‌آباد" },
  ]},
  { slug: "hormozgan", nameEn: "Hormozgan", nameFa: "هرمزگان", nameDe: "Hormozgan", latitude: 27.1832, longitude: 56.2764, cities: [
    { slug: "bandar-abbas", nameEn: "Bandar Abbas", nameFa: "بندرعباس" },
  ]},
  { slug: "ilam", nameEn: "Ilam", nameFa: "ایلام", nameDe: "Ilam", latitude: 33.6374, longitude: 46.4227, cities: [
    { slug: "ilam-city", nameEn: "Ilam", nameFa: "ایلام" },
  ]},
  { slug: "ardabil", nameEn: "Ardabil", nameFa: "اردبیل", nameDe: "Ardabil", latitude: 38.2498, longitude: 48.2933, cities: [
    { slug: "ardabil-city", nameEn: "Ardabil", nameFa: "اردبیل" },
  ]},
  { slug: "bushehr", nameEn: "Bushehr", nameFa: "بوشهر", nameDe: "Buschehr", latitude: 28.9234, longitude: 50.8203, cities: [
    { slug: "bushehr-city", nameEn: "Bushehr", nameFa: "بوشهر" },
  ]},
  { slug: "zanjan", nameEn: "Zanjan", nameFa: "زنجان", nameDe: "Zandschan", latitude: 36.6736, longitude: 48.4787, cities: [
    { slug: "zanjan-city", nameEn: "Zanjan", nameFa: "زنجان" },
  ]},
  { slug: "semnan", nameEn: "Semnan", nameFa: "سمنان", nameDe: "Semnan", latitude: 35.5729, longitude: 53.3971, cities: [
    { slug: "semnan-city", nameEn: "Semnan", nameFa: "سمنان" },
  ]},
  { slug: "yazd", nameEn: "Yazd", nameFa: "یزد", nameDe: "Yazd", latitude: 31.8974, longitude: 54.3569, cities: [
    { slug: "yazd-city", nameEn: "Yazd", nameFa: "یزد" },
  ]},
  { slug: "qom", nameEn: "Qom", nameFa: "قم", nameDe: "Ghom", latitude: 34.6401, longitude: 50.8764, cities: [
    { slug: "qom-city", nameEn: "Qom", nameFa: "قم" },
  ]},
  { slug: "qazvin", nameEn: "Qazvin", nameFa: "قزوین", nameDe: "Qazvin", latitude: 36.2688, longitude: 50.0041, cities: [
    { slug: "qazvin-city", nameEn: "Qazvin", nameFa: "قزوین" },
  ]},
  { slug: "golestan", nameEn: "Golestan", nameFa: "گلستان", nameDe: "Golestan", latitude: 37.2531, longitude: 55.1375, cities: [
    { slug: "gorgan", nameEn: "Gorgan", nameFa: "گرگان" },
  ]},
  { slug: "markazi", nameEn: "Markazi", nameFa: "مرکزی", nameDe: "Markazi", latitude: 34.0861, longitude: 49.6985, cities: [
    { slug: "arak", nameEn: "Arak", nameFa: "اراک" },
  ]},
  { slug: "north-khorasan", nameEn: "North Khorasan", nameFa: "خراسان شمالی", nameDe: "Nord-Chorasan", latitude: 37.4710, longitude: 57.3315, cities: [
    { slug: "bojnurd", nameEn: "Bojnurd", nameFa: "بجنورد" },
  ]},
  { slug: "south-khorasan", nameEn: "South Khorasan", nameFa: "خراسان جنوبی", nameDe: "Süd-Chorasan", latitude: 32.8505, longitude: 59.2218, cities: [
    { slug: "birjand", nameEn: "Birjand", nameFa: "بیرجند" },
  ]},
  { slug: "chaharmahal-bakhtiari", nameEn: "Chaharmahal and Bakhtiari", nameFa: "چهارمحال و بختیاری", nameDe: "Tschahar Mahal und Bachtiari", latitude: 32.3256, longitude: 50.8644, cities: [
    { slug: "shahrekord", nameEn: "Shahrekord", nameFa: "شهرکرد" },
  ]},
  { slug: "kohgiluyeh-boyerahmad", nameEn: "Kohgiluyeh and Boyer-Ahmad", nameFa: "کهگیلویه و بویراحمد", nameDe: "Kohgiluye und Boyer Ahmad", latitude: 30.7243, longitude: 51.5372, cities: [
    { slug: "yasuj", nameEn: "Yasuj", nameFa: "یاسوج" },
  ]},
  { slug: "gilan", nameEn: "Gilan", nameFa: "گیلان", nameDe: "Gilan", latitude: 37.2809, longitude: 49.5924, cities: [
    { slug: "rasht", nameEn: "Rasht", nameFa: "رشت" },
    { slug: "lahijan", nameEn: "Lahijan", nameFa: "لاهیجان" },
  ]},
];

async function main() {
  console.log("Seeding provinces and cities...");

  for (const prov of PROVINCES) {
    const province = await prisma.province.upsert({
      where: { slug: prov.slug },
      update: {
        nameEn: prov.nameEn,
        nameFa: prov.nameFa,
        nameDe: prov.nameDe,
        latitude: prov.latitude,
        longitude: prov.longitude,
      },
      create: {
        slug: prov.slug,
        nameEn: prov.nameEn,
        nameFa: prov.nameFa,
        nameDe: prov.nameDe,
        latitude: prov.latitude,
        longitude: prov.longitude,
      },
    });

    for (const city of prov.cities) {
      await prisma.city.upsert({
        where: { slug: city.slug },
        update: {
          nameEn: city.nameEn,
          nameFa: city.nameFa || null,
          nameDe: city.nameDe || null,
          provinceId: province.id,
        },
        create: {
          slug: city.slug,
          nameEn: city.nameEn,
          nameFa: city.nameFa || null,
          nameDe: city.nameDe || null,
          provinceId: province.id,
        },
      });
    }

    console.log(`  ✓ ${prov.nameEn} (${prov.cities.length} cities)`);
  }

  const [provCount, cityCount] = await Promise.all([
    prisma.province.count(),
    prisma.city.count(),
  ]);
  console.log(`\nDone: ${provCount} provinces, ${cityCount} cities`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
