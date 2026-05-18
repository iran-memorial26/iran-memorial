/**
 * extract-fields-regex.ts — Pattern-based field extraction (no API needed)
 *
 * Extracts gender, responsible_forces, event_context, occupation, education,
 * and family_info from circumstances_en using regex patterns.
 * Only fills fields that are currently null/empty.
 *
 * Usage:
 *   npx tsx tools/extract-fields-regex.ts                    # Full run
 *   npx tsx tools/extract-fields-regex.ts --dry-run           # Preview only
 *   npx tsx tools/extract-fields-regex.ts --limit 10          # First 10
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const DATA_DIR = join(PROJECT_ROOT, "data", "victims");
const PROGRESS_FILE = join(PROJECT_ROOT, ".extract-progress.json");

const dryRun = process.argv.includes("--dry-run");
const limitIdx = process.argv.indexOf("--limit");
const limit = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1], 10) : null;

const prisma = new PrismaClient();

// --- Gender from pronouns ---
function extractGender(text: string): "male" | "female" | null {
  const malePatterns = /\b(he|him|his|himself)\b/gi;
  const femalePatterns = /\b(she|her|hers|herself)\b/gi;
  const maleCount = (text.match(malePatterns) || []).length;
  const femaleCount = (text.match(femalePatterns) || []).length;
  // Need clear majority (at least 2 occurrences and 3:1 ratio)
  if (maleCount >= 2 && maleCount > femaleCount * 3) return "male";
  if (femaleCount >= 2 && femaleCount > maleCount * 3) return "female";
  return null;
}

// --- Responsible forces ---
const FORCE_PATTERNS: [RegExp, string][] = [
  [/\bIRGC\b|Islamic Revolutionary Guard Corps/i, "IRGC"],
  [/\bBasij\b/i, "Basij"],
  [/\bIntelligence Ministry\b|Ministry of Intelligence|VEVAK|MOIS/i, "Intelligence Ministry"],
  [/\bSEPAH\b|Sepah-e Pasdaran/i, "IRGC"],
  [/\bRevolutionary Court/i, "Revolutionary Court"],
  [/\bKomiteh\b|Revolutionary Committee/i, "Revolutionary Committee"],
  [/\bArmy of the Guardians/i, "IRGC"],
  [/\bsecurity forces\b/i, "Security forces"],
  [/\bpolice\b/i, "Police"],
  [/\bPrison authorities\b/i, "Prison authorities"],
  [/\bEvin Prison\b/i, "Prison authorities (Evin)"],
  [/\bGohardasht\b/i, "Prison authorities (Gohardasht)"],
];

function extractResponsibleForces(text: string): string | null {
  const found: string[] = [];
  for (const [pattern, label] of FORCE_PATTERNS) {
    if (pattern.test(text) && !found.includes(label)) {
      found.push(label);
    }
  }
  if (found.length === 0) return null;
  return found.join(", ");
}

// --- Event context ---
const EVENT_PATTERNS: [RegExp, string][] = [
  [/1988 (prison )?massacres?|mass(acre|[ -])?executions? (of|in) 1988/i, "1988 prison massacres"],
  [/1988 mass execution/i, "1988 prison massacres"],
  [/November 2019|Aban 1398|November protests|Bloody November/i, "2019 November protests"],
  [/Woman,? Life,? Freedom|Mahsa (Jina )?Amini|September 2022 protests/i, "Woman Life Freedom movement 2022"],
  [/Green Movement|2009 (election |post-election )?protests?|June 2009/i, "Green Movement 2009"],
  [/1999 student protests?|18 Tir|July 1999/i, "1999 student protests"],
  [/Iran[- ]Iraq [Ww]ar/i, "Iran-Iraq War"],
  [/Kurdish (insurgency|uprising|resistance)|Kurdistan Democratic Party|KDPI|Komala/i, "Kurdish resistance"],
  [/chain murders|serial murders|Forouhar/i, "Chain murders 1998"],
  [/Mojahedin|MEK|MKO|PMOI|Mujahedin-e Khalq/i, "Mojahedin-e Khalq"],
  [/Tudeh Party/i, "Tudeh Party persecution"],
  [/Fedai(yan|in)|OIPFG/i, "Fedaiyan persecution"],
  [/1981.{0,20}(execut|massacre|purge)|reign of terror/i, "1981-85 reign of terror"],
  [/revolution(ary)?.{0,20}(1979|1357)/i, "1979 Revolution"],
];

function extractEventContext(text: string): string | null {
  const found: string[] = [];
  for (const [pattern, label] of EVENT_PATTERNS) {
    if (pattern.test(text) && !found.includes(label)) {
      found.push(label);
    }
  }
  if (found.length === 0) return null;
  return found.join("; ");
}

// --- Occupation ---
const OCCUPATION_PATTERNS: [RegExp, string][] = [
  [/\bwas a (\w+(?:\s\w+)?) by (profession|trade)/i, ""],
  [/\b(?:worked as|was employed as|profession was) (?:a |an )?(.+?)(?:\.|,| in | at | and )/i, ""],
  [/\boccupation:\s*(.+?)(?:\.|,|$)/i, ""],
];

const OCCUPATION_KEYWORDS: [RegExp, string][] = [
  [/\bteacher\b/i, "teacher"],
  [/\bengineer\b/i, "engineer"],
  [/\bdoctor\b|\bphysician\b/i, "physician"],
  [/\bnurse\b|\bnursing\b/i, "nurse"],
  [/\bfarmer\b|\bagricultur/i, "farmer"],
  [/\bstudent\b/i, "student"],
  [/\bworker\b|\blabor(?:er)?\b/i, "worker"],
  [/\bshopkeeper\b|\bmerchant\b|\btrader\b/i, "merchant"],
  [/\blawyer\b|\battorney\b/i, "lawyer"],
  [/\bcleric\b|\bmullah\b|\bmolla\b/i, "cleric"],
  [/\bmilitary\b|\bsoldier\b|\bofficer\b/i, "military"],
  [/\bjournalist\b|\breporter\b|\bwriter\b/i, "journalist"],
  [/\bpastor\b|\bpriest\b|\bbishop\b/i, "religious leader"],
  [/\bcarpenter\b/i, "carpenter"],
  [/\bdriver\b/i, "driver"],
  [/\belectrician\b/i, "electrician"],
  [/\bbaker\b/i, "baker"],
  [/\bbutcher\b/i, "butcher"],
  [/\baccountant\b/i, "accountant"],
  [/\bprofessor\b|\blecturer\b/i, "professor"],
  [/\bpharmacist\b/i, "pharmacist"],
  [/\bdentist\b/i, "dentist"],
  [/\bpilot\b/i, "pilot"],
  [/\barchitect\b/i, "architect"],
  [/\bcivil servant\b|\bgovernment employee\b/i, "civil servant"],
  [/\bhousewife\b|\bhomemaker\b/i, "homemaker"],
];

function extractOccupation(text: string): string | null {
  // Try specific patterns first
  for (const [pattern] of OCCUPATION_PATTERNS) {
    const m = text.match(pattern);
    if (m && m[1] && m[1].length < 50) {
      return m[1].trim().toLowerCase();
    }
  }
  // Fall back to keyword matching
  for (const [pattern, label] of OCCUPATION_KEYWORDS) {
    if (pattern.test(text)) {
      return label;
    }
  }
  return null;
}

// --- Education ---
function extractEducation(text: string): string | null {
  // "student of X", "studied X", "X student"
  const patterns: RegExp[] = [
    /(?:student of|studied|studying) ([A-Za-z\s]+?)(?:\.|,| at | in )/i,
    /([A-Za-z]+) student/i,
    /(?:degree|diploma) in ([A-Za-z\s]+?)(?:\.|,| from )/i,
    /university student/i,
    /high school/i,
    /elementary school/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      if (m[1] && m[1].length < 50) {
        return m[1].trim().toLowerCase() + " student";
      }
      return m[0].trim().toLowerCase();
    }
  }
  return null;
}

// --- Family info ---
interface FamilyInfo {
  marital_status?: string;
  children?: number;
  notes?: string;
}

function extractFamilyInfo(text: string): FamilyInfo | null {
  const info: FamilyInfo = {};
  let found = false;

  // Marital status
  if (/\bmarried\b/i.test(text)) {
    info.marital_status = "married";
    found = true;
  } else if (/\bsingle\b/i.test(text) && /\b(unmarried|was single|remained single)\b/i.test(text)) {
    info.marital_status = "single";
    found = true;
  } else if (/\bwidow(?:ed)?\b/i.test(text)) {
    info.marital_status = "widowed";
    found = true;
  }

  // Children
  const childPatterns = [
    /father of (\w+|\d+) children/i,
    /mother of (\w+|\d+) children/i,
    /had (\w+|\d+) children/i,
    /(\w+|\d+) children/i,
    /survived by.+?(\w+|\d+) (children|sons?|daughters?)/i,
  ];

  const wordToNum: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };

  for (const p of childPatterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const num = parseInt(m[1]) || wordToNum[m[1].toLowerCase()];
      if (num && num > 0 && num <= 20) {
        info.children = num;
        found = true;
        break;
      }
    }
  }

  // Family notes
  const familyNotes: string[] = [];
  const wifeMatch = text.match(/survived by (?:his|her) (wife|husband|spouse).+?(?:\.|$)/im);
  if (wifeMatch) {
    familyNotes.push(wifeMatch[0].trim().slice(0, 100));
    found = true;
  }

  if (familyNotes.length > 0) {
    info.notes = familyNotes.join("; ");
  }

  return found ? info : null;
}

// --- Ethnicity ---
const ETHNICITY_PATTERNS: [RegExp, string][] = [
  [/\bKurdish\b/i, "Kurdish"],
  [/\bBaluch(?:i)?\b/i, "Baluch"],
  [/\bArab\b/i, "Arab"],
  [/\bAzerbaijani\b|\bAzeri\b|\bTurkish\b/i, "Azerbaijani"],
  [/\bTurkmen\b/i, "Turkmen"],
  [/\bLor\b|\bLuri\b/i, "Lor"],
  [/\bGilaki\b/i, "Gilaki"],
  [/\bArmenian\b/i, "Armenian"],
  [/\bAssyrian\b/i, "Assyrian"],
];

function extractEthnicity(text: string): string | null {
  for (const [pattern, label] of ETHNICITY_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

// --- Religion ---
const RELIGION_PATTERNS: [RegExp, string][] = [
  [/\bBaha['']?i\b/i, "Baha'i"],
  [/\bSunni\b/i, "Sunni"],
  [/\bChristian\b/i, "Christian"],
  [/\bJewish\b|\bJew\b/i, "Jewish"],
  [/\bZoroastrian\b/i, "Zoroastrian"],
  [/\bSufi\b|\bDervish\b|\bGonabadi\b/i, "Sufi"],
  [/\bProtestant\b|\bEvangelical\b/i, "Protestant Christian"],
  [/\bCatholic\b/i, "Catholic"],
  [/\bYarsan\b|\bAhl-e Haqq\b/i, "Yarsan"],
];

function extractReligion(text: string): string | null {
  for (const [pattern, label] of RELIGION_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

// --- YAML Update (same as extract-fields.ts) ---
function findYamlPath(slug: string): string | null {
  const match = slug.match(/(\d{4})$/);
  if (!match) return null;
  const year = match[1];
  const path = join(DATA_DIR, year, `${slug}.yaml`);
  return existsSync(path) ? path : null;
}

function updateYaml(
  yamlPath: string,
  fields: {
    gender?: string | null;
    responsible_forces?: string | null;
    event_context?: string | null;
    occupation?: string | null;
    education?: string | null;
    family_info?: FamilyInfo | null;
    ethnicity?: string | null;
    religion?: string | null;
  },
  existing: any
): boolean {
  let content = readFileSync(yamlPath, "utf-8");
  let modified = false;

  function setField(yamlKey: string, value: string | null | undefined) {
    if (!value) return;
    const regex = new RegExp(`^(${yamlKey}:)\\s*null\\s*$`, "m");
    if (regex.test(content)) {
      const needsQuotes = /[:#{}[\],&*?|>!%@`]/.test(value) || value.includes("'");
      const formatted = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : `"${value}"`;
      content = content.replace(regex, `$1 ${formatted}`);
      modified = true;
    }
  }

  if ((!existing.gender || existing.gender === "unknown") && fields.gender) {
    const genderRegex = /^(gender:)\s*null\s*$/m;
    if (genderRegex.test(content)) {
      content = content.replace(genderRegex, `$1 ${fields.gender}`);
      modified = true;
    }
  }

  if (!existing.ethnicity && fields.ethnicity) setField("ethnicity", fields.ethnicity);
  if (
    (!existing.religion || existing.religion === "Presumed Muslim") &&
    fields.religion &&
    fields.religion !== "Presumed Muslim" &&
    fields.religion !== "Islam"
  ) {
    const religionRegex = /^(religion:)\s*(?:null|"Presumed Muslim"|Presumed Muslim)\s*$/m;
    if (religionRegex.test(content)) {
      content = content.replace(religionRegex, `$1 "${fields.religion.replace(/"/g, '\\"')}"`);
      modified = true;
    }
  }

  if (!existing.eventContext && fields.event_context) setField("event_context", fields.event_context);
  if (!existing.responsibleForces && fields.responsible_forces) setField("responsible_forces", fields.responsible_forces);

  // Life section fields
  const lifeFields: string[] = [];
  if (!existing.occupationEn && fields.occupation) {
    lifeFields.push(`occupation: "${fields.occupation.replace(/"/g, '\\"')}"`);
  }
  if (!existing.education && fields.education) {
    lifeFields.push(`education: "${fields.education.replace(/"/g, '\\"')}"`);
  }
  if (!existing.familyInfo && fields.family_info) {
    lifeFields.push("family:");
    if (fields.family_info.marital_status) {
      lifeFields.push(`  marital_status: "${fields.family_info.marital_status}"`);
    }
    if (fields.family_info.children != null) {
      lifeFields.push(`  children: ${fields.family_info.children}`);
    }
    if (fields.family_info.notes) {
      lifeFields.push(`  notes: "${fields.family_info.notes.replace(/"/g, '\\"')}"`);
    }
  }

  if (lifeFields.length > 0) {
    if (!content.includes("# --- LIFE ---")) {
      const deathIdx = content.indexOf("# --- DEATH ---");
      if (deathIdx !== -1) {
        const lifeBlock = `# --- LIFE ---\n${lifeFields.join("\n")}\n\n`;
        content = content.slice(0, deathIdx) + lifeBlock + content.slice(deathIdx);
        modified = true;
      }
    } else {
      const lifeIdx = content.indexOf("# --- LIFE ---");
      const afterLife = content.indexOf("\n", lifeIdx) + 1;
      const nextSection = content.indexOf("\n# ---", afterLife);
      const insertAt = nextSection !== -1 ? nextSection : content.length;
      const existingLifeSection = content.slice(afterLife, insertAt);
      const newFields = lifeFields.filter((line) => {
        const key = line.split(":")[0].trim();
        return !existingLifeSection.includes(`${key}:`);
      });
      if (newFields.length > 0) {
        content = content.slice(0, insertAt) + "\n" + newFields.join("\n") + content.slice(insertAt);
        modified = true;
      }
    }
  }

  if (modified) {
    writeFileSync(yamlPath, content, "utf-8");
  }
  return modified;
}

// --- Main ---
async function main() {
  console.log(`🔍 Regex-based Field Extraction${dryRun ? " (DRY RUN)" : ""}`);
  if (limit != null) console.log(`   Limit: ${limit}`);
  console.log();

  // Load existing progress to skip already-processed victims
  let processedIds = new Set<string>();
  if (existsSync(PROGRESS_FILE)) {
    try {
      const data = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
      processedIds = new Set(data.processedIds);
      console.log(`Progress file: ${processedIds.size} already processed (AI extraction).`);
    } catch {}
  }

  const victims = await prisma.victim.findMany({
    where: {
      dataSource: "boroumand-import",
      circumstancesEn: { not: null },
    },
    select: {
      id: true,
      slug: true,
      circumstancesEn: true,
      placeOfBirth: true,
      dateOfBirth: true,
      gender: true,
      ethnicity: true,
      religion: true,
      occupationEn: true,
      education: true,
      familyInfo: true,
      personalityEn: true,
      beliefsEn: true,
      quotes: true,
      responsibleForces: true,
      eventContext: true,
    },
    orderBy: { slug: "asc" },
  });

  // Filter: substantial text, at least one empty field, NOT already processed by AI
  const candidates = victims.filter((v) => {
    if (!v.circumstancesEn || v.circumstancesEn.length < 200) return false;
    if (processedIds.has(v.id)) return false;
    return (
      !v.gender || v.gender === "unknown" ||
      !v.ethnicity ||
      !v.religion || v.religion === "Presumed Muslim" ||
      !v.occupationEn ||
      !v.education ||
      !v.familyInfo ||
      !v.responsibleForces ||
      !v.eventContext
    );
  });

  const toProcess = limit != null ? candidates.slice(0, limit) : candidates;
  console.log(`Total with text: ${victims.length}`);
  console.log(`Candidates: ${candidates.length}`);
  console.log(`Processing: ${toProcess.length}\n`);

  let totalFieldsUpdated = 0;
  let totalYamlUpdated = 0;
  let processed = 0;
  const fieldCounts: Record<string, number> = {};

  for (const victim of toProcess) {
    const text = victim.circumstancesEn!;
    const updates: Record<string, any> = {};
    const extracted: Record<string, any> = {};

    // Gender
    if (!victim.gender || victim.gender === "unknown") {
      const g = extractGender(text);
      if (g) { updates.gender = g; extracted.gender = g; }
    }

    // Ethnicity
    if (!victim.ethnicity) {
      const e = extractEthnicity(text);
      if (e) { updates.ethnicity = e; extracted.ethnicity = e; }
    }

    // Religion
    if ((!victim.religion || victim.religion === "Presumed Muslim") ) {
      const r = extractReligion(text);
      if (r) { updates.religion = r; extracted.religion = r; }
    }

    // Responsible forces
    if (!victim.responsibleForces) {
      const rf = extractResponsibleForces(text);
      if (rf) { updates.responsibleForces = rf; extracted.responsible_forces = rf; }
    }

    // Event context
    if (!victim.eventContext) {
      const ec = extractEventContext(text);
      if (ec) { updates.eventContext = ec; extracted.event_context = ec; }
    }

    // Occupation
    if (!victim.occupationEn) {
      const occ = extractOccupation(text);
      if (occ) { updates.occupationEn = occ; extracted.occupation = occ; }
    }

    // Education
    if (!victim.education) {
      const edu = extractEducation(text);
      if (edu) { updates.education = edu; extracted.education = edu; }
    }

    // Family info
    if (!victim.familyInfo) {
      const fam = extractFamilyInfo(text);
      if (fam) { updates.familyInfo = fam; extracted.family_info = fam; }
    }

    const fieldCount = Object.keys(updates).length;
    if (fieldCount === 0) {
      processed++;
      continue;
    }

    // Track field counts
    for (const key of Object.keys(updates)) {
      fieldCounts[key] = (fieldCounts[key] || 0) + 1;
    }

    if (dryRun) {
      if (processed < 20) {
        console.log(`  ${victim.slug}: ${JSON.stringify(extracted)}`);
      }
      totalFieldsUpdated += fieldCount;
      processed++;
      continue;
    }

    // Update DB
    await prisma.victim.update({
      where: { id: victim.id },
      data: updates,
    });
    totalFieldsUpdated += fieldCount;

    // Update YAML
    const yamlPath = findYamlPath(victim.slug);
    if (yamlPath) {
      const yamlUpdated = updateYaml(yamlPath, extracted, victim);
      if (yamlUpdated) totalYamlUpdated++;
    }

    // Mark as processed in progress file
    processedIds.add(victim.id);

    processed++;

    if (processed % 200 === 0) {
      console.log(`  [${processed}/${toProcess.length}] ${totalFieldsUpdated} fields, ${totalYamlUpdated} YAMLs`);
    }
  }

  // Save updated progress
  if (!dryRun) {
    writeFileSync(
      PROGRESS_FILE,
      JSON.stringify({
        processedIds: [...processedIds],
        lastUpdated: new Date().toISOString(),
      })
    );
  }

  console.log(`\n✓ Done: ${processed} victims processed`);
  console.log(`  Fields updated: ${totalFieldsUpdated}`);
  console.log(`  YAMLs updated: ${totalYamlUpdated}`);
  console.log(`\n  By field:`);
  for (const [key, count] of Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${key}: ${count}`);
  }
}

main()
  .catch((e) => { console.error("Failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
