/**
 * Internet Archive Export Tool
 *
 * Exports Iran Memorial data in formats suitable for archival on archive.org:
 * - JSON-LD dataset (schema.org compatible)
 * - Dublin Core metadata XML
 * - URL list for Wayback Machine crawling
 *
 * Usage: npx tsx tools/archive-export.ts [--output-dir <dir>]
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";

const prisma = new PrismaClient();

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const LOCALES = ["en", "de", "fa"] as const;

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { outputDir: string } {
  const args = process.argv.slice(2);
  let outputDir = path.resolve(process.cwd(), "data/archive");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output-dir" && args[i + 1]) {
      outputDir = path.resolve(args[i + 1]);
      i++;
    }
  }

  return { outputDir };
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

interface VictimRow {
  id: string;
  slug: string;
  name_latin: string;
  name_farsi: string | null;
  aliases: string[];
  date_of_birth: Date | null;
  place_of_birth: string | null;
  gender: string | null;
  ethnicity: string | null;
  religion: string | null;
  photo_url: string | null;
  occupation_en: string | null;
  occupation_fa: string | null;
  occupation_de: string | null;
  education: string | null;
  date_of_death: Date | null;
  age_at_death: number | null;
  place_of_death: string | null;
  province: string | null;
  cause_of_death: string | null;
  circumstances_en: string | null;
  circumstances_fa: string | null;
  circumstances_de: string | null;
  event_context: string | null;
  responsible_forces: string | null;
  burial_location: string | null;
  verification_status: string;
  data_source: string | null;
  created_at: Date;
  updated_at: Date;
  city_name_en: string | null;
  city_name_fa: string | null;
  province_name_en: string | null;
  province_name_fa: string | null;
}

async function fetchAllVictims(): Promise<VictimRow[]> {
  return prisma.$queryRaw<VictimRow[]>`
    SELECT
      v.id, v.slug, v.name_latin, v.name_farsi, v.aliases,
      v.date_of_birth, v.place_of_birth, v.gender, v.ethnicity, v.religion, v.photo_url,
      v.occupation_en, v.occupation_fa, v.occupation_de, v.education,
      v.date_of_death, v.age_at_death, v.place_of_death, v.province,
      v.cause_of_death, v.circumstances_en, v.circumstances_fa, v.circumstances_de,
      v.event_context, v.responsible_forces,
      v.burial_location, v.verification_status, v.data_source,
      v.created_at, v.updated_at,
      c.name_en AS city_name_en, c.name_fa AS city_name_fa,
      p.name_en AS province_name_en, p.name_fa AS province_name_fa
    FROM victims v
    LEFT JOIN cities c ON v.city_id = c.id
    LEFT JOIN provinces p ON c.province_id = p.id
    ORDER BY v.date_of_death DESC NULLS LAST
  `;
}

async function fetchStats(): Promise<{ victimCount: number; sourceCount: number }> {
  const [victimCount, sourceCount] = await Promise.all([
    prisma.victim.count(),
    prisma.source.count(),
  ]);
  return { victimCount, sourceCount };
}

// ---------------------------------------------------------------------------
// JSON-LD generation (schema.org compatible)
// ---------------------------------------------------------------------------

function formatDate(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toISOString().split("T")[0];
}

function victimToJsonLd(v: VictimRow): Record<string, unknown> {
  const person: Record<string, unknown> = {
    "@type": "Person",
    "@id": `${BASE_URL}/en/victims/${v.slug}`,
    name: v.name_latin,
    url: `${BASE_URL}/en/victims/${v.slug}`,
  };

  if (v.name_farsi) {
    person.alternateName = v.name_farsi;
  }
  if (v.aliases && v.aliases.length > 0) {
    // alternateName can be an array in schema.org
    person.alternateName = v.name_farsi
      ? [v.name_farsi, ...v.aliases]
      : v.aliases;
  }
  if (v.date_of_birth) {
    person.birthDate = formatDate(v.date_of_birth);
  }
  if (v.place_of_birth) {
    person.birthPlace = {
      "@type": "Place",
      name: v.place_of_birth,
    };
  }
  if (v.gender) {
    person.gender = v.gender;
  }
  if (v.occupation_en) {
    person.jobTitle = v.occupation_en;
  }
  if (v.education) {
    person.hasCredential = v.education;
  }
  if (v.photo_url) {
    person.image = v.photo_url;
  }

  // Death information as structured data
  if (v.date_of_death) {
    person.deathDate = formatDate(v.date_of_death);
  }
  if (v.place_of_death || v.city_name_en || v.province_name_en) {
    const deathPlace: Record<string, unknown> = { "@type": "Place" };
    const placeParts: string[] = [];
    if (v.city_name_en) placeParts.push(v.city_name_en);
    if (v.province_name_en) placeParts.push(v.province_name_en);
    if (placeParts.length > 0) {
      deathPlace.name = placeParts.join(", ");
      deathPlace.address = {
        "@type": "PostalAddress",
        addressCountry: "IR",
        addressRegion: v.province_name_en || v.province || undefined,
      };
    } else if (v.place_of_death) {
      deathPlace.name = v.place_of_death;
    }
    person.deathPlace = deathPlace;
  }

  // Additional structured information
  if (v.cause_of_death) {
    person["schema:causeOfDeath"] = v.cause_of_death;
  }
  if (v.circumstances_en) {
    person.description = v.circumstances_en;
  }
  if (v.age_at_death != null) {
    person["schema:ageAtDeath"] = v.age_at_death;
  }
  if (v.responsible_forces) {
    person["schema:responsibleForces"] = v.responsible_forces;
  }
  if (v.burial_location) {
    person["schema:burialLocation"] = v.burial_location;
  }
  if (v.ethnicity) {
    person["schema:ethnicity"] = v.ethnicity;
  }
  if (v.religion) {
    person["schema:religion"] = v.religion;
  }

  return person;
}

function buildJsonLdDataset(
  victims: VictimRow[],
  stats: { victimCount: number; sourceCount: number }
): Record<string, unknown> {
  const now = new Date().toISOString();

  return {
    "@context": {
      "@vocab": "https://schema.org/",
      schema: "https://schema.org/",
      dcterms: "http://purl.org/dc/terms/",
    },
    "@type": "Dataset",
    "@id": `${BASE_URL}/api/archive`,
    name: "Iran Memorial — Victims of the Islamic Republic of Iran (1979-present)",
    alternateName: [
      "Iran Memorial Dataset",
      "Datenbank der Opfer der Islamischen Republik Iran",
    ],
    description:
      "A comprehensive dataset documenting victims of the Islamic Republic of Iran since 1979. " +
      "Includes biographical information, circumstances of death, geographic data, and source documentation. " +
      "Compiled from multiple human rights organizations, news agencies, and community contributions.",
    url: BASE_URL,
    identifier: `${BASE_URL}/api/archive`,
    license: "https://creativecommons.org/licenses/by-sa/4.0/",
    "dcterms:rights": "CC BY-SA 4.0",
    creator: {
      "@type": "Organization",
      name: "Woman, Life, Freedom e.V. (WLF e.V.)",
      url: process.env.NEXT_PUBLIC_ORG_URL ?? "",
    },
    publisher: {
      "@type": "Organization",
      name: "Iran Memorial Project",
      url: BASE_URL,
    },
    datePublished: now.split("T")[0],
    dateModified: now,
    temporalCoverage: "1979/..",
    spatialCoverage: {
      "@type": "Place",
      name: "Iran",
      geo: {
        "@type": "GeoCoordinates",
        latitude: 32.4279,
        longitude: 53.688,
      },
    },
    inLanguage: ["en", "fa", "de"],
    keywords: [
      "Iran",
      "human rights",
      "victims",
      "Islamic Republic",
      "memorial",
      "documentation",
      "1988 massacre",
      "Woman Life Freedom",
      "political prisoners",
    ],
    measurementTechnique:
      "Cross-referenced from multiple independent sources including human rights organizations (HRANA, Amnesty International, IHR, Boroumand Center), news agencies, witness testimonies, and court documents.",
    variableMeasured: [
      {
        "@type": "PropertyValue",
        name: "Total Victims",
        value: stats.victimCount,
      },
      {
        "@type": "PropertyValue",
        name: "Total Sources",
        value: stats.sourceCount,
      },
    ],
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/ld+json",
        contentUrl: `${BASE_URL}/api/archive`,
        name: "JSON-LD Dataset",
      },
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: `${BASE_URL}/api/export?format=json`,
        name: "JSON Export",
      },
      {
        "@type": "DataDownload",
        encodingFormat: "text/csv",
        contentUrl: `${BASE_URL}/api/export?format=csv`,
        name: "CSV Export",
      },
    ],
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: victims.length,
      itemListElement: victims.map((v, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: victimToJsonLd(v),
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Dublin Core metadata XML
// ---------------------------------------------------------------------------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildDublinCoreXml(stats: { victimCount: number; sourceCount: number }): string {
  const now = new Date().toISOString().split("T")[0];

  return `<?xml version="1.0" encoding="UTF-8"?>
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"
          xmlns:dcterms="http://purl.org/dc/terms/"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <dc:title>Iran Memorial -- Victims of the Islamic Republic of Iran (1979-present)</dc:title>
  <dc:title xml:lang="de">Iran Memorial -- Opfer der Islamischen Republik Iran (1979-heute)</dc:title>
  <dc:title xml:lang="fa">${escapeXml("یادبود ایران — قربانیان جمهوری اسلامی ایران (۱۳۵۷ تا امروز)")}</dc:title>

  <dc:creator>Woman, Life, Freedom e.V. (WLF e.V.)</dc:creator>
  <dc:publisher>Iran Memorial Project</dc:publisher>

  <dc:subject>Human Rights</dc:subject>
  <dc:subject>Iran</dc:subject>
  <dc:subject>Islamic Republic of Iran</dc:subject>
  <dc:subject>Victims</dc:subject>
  <dc:subject>Memorial</dc:subject>
  <dc:subject>Political Prisoners</dc:subject>
  <dc:subject>1988 Massacre</dc:subject>
  <dc:subject>Woman Life Freedom</dc:subject>

  <dc:description>A comprehensive dataset documenting ${stats.victimCount} victims of the Islamic Republic of Iran since 1979. Includes biographical information, circumstances of death, geographic data, and source documentation from ${stats.sourceCount} sources. Compiled from multiple human rights organizations including HRANA, Amnesty International, IHR, and the Boroumand Center.</dc:description>
  <dc:description xml:lang="de">Ein umfassender Datensatz, der ${stats.victimCount} Opfer der Islamischen Republik Iran seit 1979 dokumentiert. Enthält biografische Informationen, Todesumstände, geografische Daten und Quellenverweise.</dc:description>

  <dc:date>${now}</dc:date>
  <dcterms:created>${now}</dcterms:created>
  <dcterms:modified>${now}</dcterms:modified>
  <dcterms:temporal>1979/..</dcterms:temporal>
  <dcterms:spatial>Iran</dcterms:spatial>

  <dc:type>Dataset</dc:type>
  <dc:format>application/ld+json</dc:format>

  <dc:language>en</dc:language>
  <dc:language>fa</dc:language>
  <dc:language>de</dc:language>

  <dc:rights>Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)</dc:rights>
  <dcterms:license>https://creativecommons.org/licenses/by-sa/4.0/</dcterms:license>

  <dc:source>${escapeXml(BASE_URL)}</dc:source>
  <dc:identifier>${escapeXml(BASE_URL)}/api/archive</dc:identifier>

  <dcterms:audience>Researchers</dcterms:audience>
  <dcterms:audience>Journalists</dcterms:audience>
  <dcterms:audience>Human Rights Organizations</dcterms:audience>
  <dcterms:audience>Archivists</dcterms:audience>

  <dcterms:accrualPeriodicity>Irregular</dcterms:accrualPeriodicity>
  <dcterms:accrualMethod>Community contributions and automated enrichment</dcterms:accrualMethod>

</metadata>
`;
}

// ---------------------------------------------------------------------------
// URL list for Wayback Machine crawling
// ---------------------------------------------------------------------------

function buildUrlList(victims: VictimRow[]): string {
  const urls: string[] = [];

  // Homepage in all locales
  for (const locale of LOCALES) {
    urls.push(`${BASE_URL}/${locale}`);
    urls.push(`${BASE_URL}/${locale}/victims`);
    urls.push(`${BASE_URL}/${locale}/events`);
    urls.push(`${BASE_URL}/${locale}/timeline`);
    urls.push(`${BASE_URL}/${locale}/statistics`);
    urls.push(`${BASE_URL}/${locale}/map`);
    urls.push(`${BASE_URL}/${locale}/about`);
    urls.push(`${BASE_URL}/${locale}/submit`);
  }

  // API endpoints
  urls.push(`${BASE_URL}/api/export?format=json`);
  urls.push(`${BASE_URL}/api/export?format=csv`);

  // Victim pages in all locales
  for (const v of victims) {
    for (const locale of LOCALES) {
      urls.push(`${BASE_URL}/${locale}/victims/${v.slug}`);
    }
  }

  return urls.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { outputDir } = parseArgs();

  console.log("Iran Memorial -- Internet Archive Export Tool");
  console.log("=============================================\n");

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Output directory: ${outputDir}\n`);

  // Fetch data
  console.log("Fetching victim data...");
  const [victims, stats] = await Promise.all([fetchAllVictims(), fetchStats()]);
  console.log(`  Found ${victims.length} victims, ${stats.sourceCount} sources\n`);

  // 1. JSON-LD dataset
  console.log("Generating JSON-LD dataset...");
  const jsonLd = buildJsonLdDataset(victims, stats);
  const jsonLdPath = path.join(outputDir, "iran-memorial-dataset.json");
  fs.writeFileSync(jsonLdPath, JSON.stringify(jsonLd, null, 2), "utf-8");
  const jsonLdSize = (fs.statSync(jsonLdPath).size / 1024 / 1024).toFixed(1);
  console.log(`  Written: ${jsonLdPath} (${jsonLdSize} MB)\n`);

  // 2. Dublin Core metadata XML
  console.log("Generating Dublin Core metadata...");
  const dcXml = buildDublinCoreXml(stats);
  const dcXmlPath = path.join(outputDir, "iran-memorial-metadata.xml");
  fs.writeFileSync(dcXmlPath, dcXml, "utf-8");
  console.log(`  Written: ${dcXmlPath}\n`);

  // 3. URL list for Wayback Machine
  console.log("Generating URL list...");
  const urlList = buildUrlList(victims);
  const urlListPath = path.join(outputDir, "iran-memorial-urls.txt");
  fs.writeFileSync(urlListPath, urlList, "utf-8");
  const totalUrls = urlList.trim().split("\n").length;
  console.log(`  Written: ${urlListPath} (${totalUrls.toLocaleString()} URLs)\n`);

  console.log("Export complete!");
  console.log("================");
  console.log(`  Dataset:  ${jsonLdPath}`);
  console.log(`  Metadata: ${dcXmlPath}`);
  console.log(`  URLs:     ${urlListPath}`);
  console.log(`\nTo upload to Internet Archive:`);
  console.log(`  1. Create an account at https://archive.org`);
  console.log(`  2. Use the ia CLI tool: pip install internetarchive`);
  console.log(`  3. ia upload iran-memorial-dataset ${outputDir}/ --metadata="collection:opensource"`);
}

main()
  .catch((err) => {
    console.error("Export failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
