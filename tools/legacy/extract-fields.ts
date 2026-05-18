/**
 * extract-fields.ts — Extract structured biographical fields from circumstances_en
 *
 * Uses Claude Haiku with tool use to extract structured data from the
 * free-text circumstances field of Boroumand-imported victims. Only fills
 * fields that are currently null/empty — never overwrites existing data.
 * Updates both the PostgreSQL database and the corresponding YAML files.
 *
 * Usage:
 *   npx tsx tools/extract-fields.ts                    # Full run
 *   npx tsx tools/extract-fields.ts --dry-run           # Preview extraction for first 5
 *   npx tsx tools/extract-fields.ts --limit 100         # Process first 100
 *   npx tsx tools/extract-fields.ts --resume            # Resume from last progress
 *   npx tsx tools/extract-fields.ts --dry-run --limit 3 # Quick test
 *
 * Requires: ANTHROPIC_API_KEY environment variable
 */

import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");
const DATA_DIR = join(PROJECT_ROOT, "data", "victims");
const PROGRESS_FILE = join(PROJECT_ROOT, ".extract-progress.json");

// --- CLI Args ---
const dryRun = process.argv.includes("--dry-run");
const resume = process.argv.includes("--resume");
const limitIdx = process.argv.indexOf("--limit");
const limit = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1], 10) : null;

// --- Clients ---
const prisma = new PrismaClient();
const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// --- Constants ---
const BATCH_SIZE = 5; // parallel requests
const BATCH_DELAY_MS = 500; // pause between batches
const MODEL = "claude-haiku-4-5-20251001";

// --- Types ---
interface ExtractedFields {
  place_of_birth?: string | null;
  date_of_birth?: string | null; // ISO date string
  gender?: string | null;
  ethnicity?: string | null;
  religion?: string | null;
  occupation?: string | null;
  education?: string | null;
  family_info?: { marital_status?: string; children?: number | null; notes?: string } | null;
  personality?: string | null;
  beliefs?: string | null;
  quotes?: string[] | null;
  responsible_forces?: string | null;
  event_context?: string | null;
}

interface VictimRow {
  id: string;
  slug: string;
  circumstancesEn: string;
  placeOfBirth: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  ethnicity: string | null;
  religion: string | null;
  occupationEn: string | null;
  education: string | null;
  familyInfo: any;
  personalityEn: string | null;
  beliefsEn: string | null;
  quotes: string[];
  responsibleForces: string | null;
  eventContext: string | null;
}

// --- Claude Tool Definition ---
const extractionTool: Anthropic.Tool = {
  name: "save_extracted_fields",
  description:
    "Save the structured biographical fields extracted from the victim's circumstances text. Only include fields that are explicitly mentioned in the text. Do not guess or infer.",
  input_schema: {
    type: "object" as const,
    properties: {
      place_of_birth: {
        type: "string",
        description: 'Birth city/region. Example: "Kanisur, Kurdistan". Omit if not mentioned.',
      },
      date_of_birth: {
        type: "string",
        description: "Birth date in YYYY-MM-DD format. Use YYYY-01-01 if only year is known. Omit if not mentioned.",
      },
      gender: {
        type: "string",
        enum: ["male", "female"],
        description: "Infer from pronouns (he/him → male, she/her → female). Omit if unclear.",
      },
      ethnicity: {
        type: "string",
        description:
          'Ethnic group if explicitly mentioned. Examples: "Kurdish", "Baluch", "Arab", "Azerbaijani". Omit if not mentioned.',
      },
      religion: {
        type: "string",
        description:
          "Religion ONLY if specifically named (e.g. \"Baha'i\", \"Sunni\", \"Christian\"). Do NOT return \"Presumed Muslim\" or \"Islam\" — those are already in the database. Omit if not mentioned or only generically Muslim.",
      },
      occupation: {
        type: "string",
        description:
          'Job or occupation. Examples: "farmer", "nursing student", "teacher", "shopkeeper". Omit if not mentioned.',
      },
      education: {
        type: "string",
        description:
          'Education level or field. Examples: "high school diploma", "mechanical engineering student", "university student". Omit if not mentioned.',
      },
      family_info: {
        type: "object",
        description: "Family information if mentioned. Omit if not mentioned.",
        properties: {
          marital_status: {
            type: "string",
            description: '"single", "married", "widowed", etc.',
          },
          children: {
            type: "integer",
            description: "Number of children if mentioned.",
          },
          notes: {
            type: "string",
            description: 'Other family details. Example: "father of three", "mother was a teacher".',
          },
        },
      },
      personality: {
        type: "string",
        description:
          'How the person was described by family/friends. Example: "described as brave and kind-hearted". Omit if not mentioned.',
      },
      beliefs: {
        type: "string",
        description:
          'Political beliefs or activism. Example: "member of PJAK", "civil rights activist". Omit if not mentioned.',
      },
      quotes: {
        type: "array",
        items: { type: "string" },
        description:
          "Direct quotes attributed to the victim. Only include exact quotes from the text. Omit if none found.",
      },
      responsible_forces: {
        type: "string",
        description:
          'Forces responsible for the death. Examples: "IRGC", "Intelligence Ministry", "Basij". Omit if not mentioned.',
      },
      event_context: {
        type: "string",
        description:
          'Historical event or protest context. Examples: "2019 November protests", "1988 prison massacres". Omit if not mentioned.',
      },
    },
  },
};

const SYSTEM_PROMPT = `You are a precise data extraction assistant for a human rights memorial database.

Your task: Extract structured biographical fields from a victim's "circumstances" text.

RULES:
1. ONLY extract information that is EXPLICITLY stated in the text. Never guess or infer.
2. Ignore boilerplate legal analysis, organizational history, and Boroumand Foundation commentary — focus on facts about the individual person.
3. For gender: infer from pronouns (he/him/his → male, she/her → female). This is the ONLY inference allowed.
4. For religion: only extract if a specific denomination is named (e.g. "Baha'i", "Sunni Muslim", "Christian"). Do NOT extract generic "Muslim" or "Presumed Muslim".
5. For family_info: look for phrases like "married", "single", "father of X children", "survived by his wife and two daughters".
6. For quotes: only include direct quotations attributed to the victim themselves, enclosed in quotation marks in the source text.
7. For responsible_forces: extract the specific organization or unit (e.g. "IRGC", "Intelligence Ministry", "Basij"), not generic "Iranian authorities".
8. Call the save_extracted_fields tool with your findings. Use null for any field not explicitly mentioned.`;

// --- Progress tracking ---
function loadProgress(): Set<string> {
  if (!resume || !existsSync(PROGRESS_FILE)) return new Set();
  try {
    const data = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
    console.log(`Resuming: ${data.processedIds.length} already processed.`);
    return new Set(data.processedIds);
  } catch {
    return new Set();
  }
}

function saveProgress(processedIds: Set<string>) {
  writeFileSync(
    PROGRESS_FILE,
    JSON.stringify({
      processedIds: [...processedIds],
      lastUpdated: new Date().toISOString(),
    })
  );
}

// --- Claude API call ---
async function extractFields(circumstancesText: string, retries = 0): Promise<ExtractedFields | null> {
  const MAX_RETRIES = 5;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [extractionTool],
      tool_choice: { type: "tool" as const, name: "save_extracted_fields" },
      messages: [
        {
          role: "user",
          content: `Extract biographical fields from this victim's circumstances text:\n\n${circumstancesText}`,
        },
      ],
    });

    // Find the tool use block in the response
    const toolBlock = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (toolBlock?.input) {
      return toolBlock.input as ExtractedFields;
    }
    return null;
  } catch (e: any) {
    if (e.status === 429) {
      if (retries >= MAX_RETRIES) {
        console.log(`  Rate limited ${MAX_RETRIES}x — skipping entry, will retry on next --resume`);
        return null;
      }
      const waitSec = 30 * (retries + 1); // progressive: 30s, 60s, 90s...
      console.log(`  Rate limited, waiting ${waitSec}s (retry ${retries + 1}/${MAX_RETRIES})...`);
      await sleep(waitSec * 1000);
      return extractFields(circumstancesText, retries + 1);
    }
    throw e;
  }
}

// --- DB Update ---
async function updateDatabase(victimId: string, fields: ExtractedFields, existing: VictimRow) {
  const updateData: Record<string, any> = {};

  // Only fill null/empty fields
  if (!existing.placeOfBirth && fields.place_of_birth) {
    updateData.placeOfBirth = fields.place_of_birth;
  }
  if (!existing.dateOfBirth && fields.date_of_birth) {
    try {
      updateData.dateOfBirth = new Date(fields.date_of_birth);
    } catch {
      /* invalid date, skip */
    }
  }
  if ((!existing.gender || existing.gender === "unknown") && fields.gender) {
    updateData.gender = fields.gender;
  }
  if (!existing.ethnicity && fields.ethnicity) {
    updateData.ethnicity = fields.ethnicity;
  }
  if (
    (!existing.religion || existing.religion === "Presumed Muslim") &&
    fields.religion &&
    fields.religion !== "Presumed Muslim" &&
    fields.religion !== "Islam"
  ) {
    updateData.religion = fields.religion;
  }
  if (!existing.occupationEn && fields.occupation) {
    updateData.occupationEn = fields.occupation;
  }
  if (!existing.education && fields.education) {
    updateData.education = fields.education;
  }
  if (!existing.familyInfo && fields.family_info) {
    updateData.familyInfo = fields.family_info;
  }
  if (!existing.personalityEn && fields.personality) {
    updateData.personalityEn = fields.personality;
  }
  if (!existing.beliefsEn && fields.beliefs) {
    updateData.beliefsEn = fields.beliefs;
  }
  if ((!existing.quotes || existing.quotes.length === 0) && fields.quotes && fields.quotes.length > 0) {
    updateData.quotes = fields.quotes;
  }
  if (!existing.responsibleForces && fields.responsible_forces) {
    updateData.responsibleForces = fields.responsible_forces;
  }
  if (!existing.eventContext && fields.event_context) {
    updateData.eventContext = fields.event_context;
  }

  if (Object.keys(updateData).length === 0) return 0;

  await prisma.victim.update({
    where: { id: victimId },
    data: updateData,
  });

  return Object.keys(updateData).length;
}

// --- YAML Update ---
function findYamlPath(slug: string): string | null {
  // Slug format: lastname-firstname-YYYY or similar
  // YAML path: data/victims/{year}/slug.yaml
  const match = slug.match(/(\d{4})$/);
  if (!match) return null;
  const year = match[1];
  const path = join(DATA_DIR, year, `${slug}.yaml`);
  return existsSync(path) ? path : null;
}

function updateYaml(yamlPath: string, fields: ExtractedFields, existing: VictimRow) {
  let content = readFileSync(yamlPath, "utf-8");
  let modified = false;

  // Helper: replace a "key: null" line with the actual value
  function setField(yamlKey: string, value: string | null | undefined) {
    if (!value) return;
    const regex = new RegExp(`^(${yamlKey}:)\\s*null\\s*$`, "m");
    if (regex.test(content)) {
      // Use quotes for values that might contain special YAML chars
      const needsQuotes = /[:#{}[\],&*?|>!%@`]/.test(value) || value.includes("'");
      const formatted = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : `"${value}"`;
      content = content.replace(regex, `$1 ${formatted}`);
      modified = true;
    }
  }

  // Replace existing null fields
  if (!existing.dateOfBirth && fields.date_of_birth) {
    setField("date_of_birth", fields.date_of_birth);
  }
  if (!existing.placeOfBirth && fields.place_of_birth) {
    setField("place_of_birth", fields.place_of_birth);
  }
  if ((!existing.gender || existing.gender === "unknown") && fields.gender) {
    // gender might be "null" or missing entirely
    const genderRegex = /^(gender:)\s*null\s*$/m;
    if (genderRegex.test(content)) {
      content = content.replace(genderRegex, `$1 ${fields.gender}`);
      modified = true;
    }
  }
  if (!existing.ethnicity && fields.ethnicity) {
    setField("ethnicity", fields.ethnicity);
  }
  if (
    (!existing.religion || existing.religion === "Presumed Muslim") &&
    fields.religion &&
    fields.religion !== "Presumed Muslim" &&
    fields.religion !== "Islam"
  ) {
    // Replace the current religion value (could be "Presumed Muslim" or null)
    const religionRegex = /^(religion:)\s*(?:null|"Presumed Muslim"|Presumed Muslim)\s*$/m;
    if (religionRegex.test(content)) {
      content = content.replace(religionRegex, `$1 "${fields.religion.replace(/"/g, '\\"')}"`);
      modified = true;
    }
  }

  // Insert life section if we have life-related fields and no existing section
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
  if (!existing.personalityEn && fields.personality) {
    lifeFields.push(`personality: "${fields.personality.replace(/"/g, '\\"')}"`);
  }
  if (!existing.beliefsEn && fields.beliefs) {
    lifeFields.push(`beliefs: "${fields.beliefs.replace(/"/g, '\\"')}"`);
  }
  if ((!existing.quotes || existing.quotes.length === 0) && fields.quotes && fields.quotes.length > 0) {
    lifeFields.push("quotes:");
    for (const q of fields.quotes) {
      lifeFields.push(`  - "${q.replace(/"/g, '\\"')}"`);
    }
  }

  if (lifeFields.length > 0) {
    // Check if there's already a LIFE section
    if (!content.includes("# --- LIFE ---")) {
      // Insert before DEATH section
      const deathIdx = content.indexOf("# --- DEATH ---");
      if (deathIdx !== -1) {
        const lifeBlock = `# --- LIFE ---\n${lifeFields.join("\n")}\n\n`;
        content = content.slice(0, deathIdx) + lifeBlock + content.slice(deathIdx);
        modified = true;
      }
    } else {
      // Life section exists — insert fields after it
      const lifeIdx = content.indexOf("# --- LIFE ---");
      const afterLife = content.indexOf("\n", lifeIdx) + 1;
      // Find the next section marker
      const nextSection = content.indexOf("\n# ---", afterLife);
      const insertAt = nextSection !== -1 ? nextSection : content.length;

      // Check which fields are already present
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

  // Add event_context and responsible_forces to DEATH section
  if (!existing.eventContext && fields.event_context) {
    const ecRegex = /^(event_context:)\s*null\s*$/m;
    if (ecRegex.test(content)) {
      content = content.replace(ecRegex, `$1 "${fields.event_context.replace(/"/g, '\\"')}"`);
      modified = true;
    }
  }
  if (!existing.responsibleForces && fields.responsible_forces) {
    const rfRegex = /^(responsible_forces:)\s*null\s*$/m;
    if (rfRegex.test(content)) {
      content = content.replace(rfRegex, `$1 "${fields.responsible_forces.replace(/"/g, '\\"')}"`);
      modified = true;
    }
  }

  if (modified) {
    writeFileSync(yamlPath, content, "utf-8");
  }

  return modified;
}

// --- Helpers ---
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Main ---
async function main() {
  console.log(`🔍 Boroumand Field Extraction${dryRun ? " (DRY RUN)" : ""}`);
  if (limit != null) console.log(`   Limit: ${limit} victims`);
  if (resume) console.log(`   Resuming from progress file`);
  console.log();

  // Load progress
  const processedIds = loadProgress();

  // Fetch victims with circumstances_en that have data worth extracting
  // Only Boroumand-imported victims with substantial text
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

  // Filter: only victims with substantial text (>200 chars) and at least one empty field
  const candidates = victims.filter((v) => {
    if (!v.circumstancesEn || v.circumstancesEn.length < 200) return false;
    if (processedIds.has(v.id)) return false;
    // Check if there's at least one empty field worth filling
    return (
      !v.placeOfBirth ||
      !v.dateOfBirth ||
      !v.gender ||
      v.gender === "unknown" ||
      !v.ethnicity ||
      !v.religion ||
      v.religion === "Presumed Muslim" ||
      !v.occupationEn ||
      !v.education ||
      !v.familyInfo ||
      !v.personalityEn ||
      !v.beliefsEn ||
      !v.quotes ||
      v.quotes.length === 0 ||
      !v.responsibleForces ||
      !v.eventContext
    );
  });

  const toProcess = limit != null ? candidates.slice(0, limit) : candidates;
  console.log(`Total Boroumand victims with text: ${victims.length}`);
  console.log(`Candidates (empty fields + >200 chars): ${candidates.length}`);
  console.log(`Processing: ${toProcess.length}\n`);

  if (toProcess.length === 0) {
    console.log("✓ Nothing to process.");
    return;
  }

  let totalFieldsUpdated = 0;
  let totalYamlUpdated = 0;
  let totalErrors = 0;
  let processed = 0;
  const startTime = Date.now();

  // Process in batches
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (victim, idx) => {
        // Stagger requests: each 1s apart within the batch
        if (idx > 0) await sleep(idx * 1000);
        const fields = await extractFields(victim.circumstancesEn!);
        if (!fields) return { victim, fieldsUpdated: 0, yamlUpdated: false };

        if (dryRun) {
          // Just log what would be extracted
          const nonNull = Object.entries(fields).filter(
            ([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0)
          );
          if (nonNull.length > 0) {
            console.log(`  ${victim.slug}:`);
            for (const [key, val] of nonNull) {
              const display = typeof val === "object" ? JSON.stringify(val) : val;
              console.log(`    ${key}: ${display}`);
            }
          }
          return { victim, fieldsUpdated: nonNull.length, yamlUpdated: false };
        }

        // Update DB
        const fieldsUpdated = await updateDatabase(victim.id, fields, victim as VictimRow);

        // Update YAML
        const yamlPath = findYamlPath(victim.slug);
        let yamlUpdated = false;
        if (yamlPath) {
          yamlUpdated = updateYaml(yamlPath, fields, victim as VictimRow);
        }

        return { victim, fieldsUpdated, yamlUpdated };
      })
    );

    for (const result of results) {
      processed++;
      if (result.status === "fulfilled") {
        const { victim, fieldsUpdated, yamlUpdated } = result.value;
        totalFieldsUpdated += fieldsUpdated;
        if (yamlUpdated) totalYamlUpdated++;
        processedIds.add(victim.id);
      } else {
        totalErrors++;
        console.error(`  ✗ Error:`, result.reason?.message?.slice(0, 100));
      }
    }

    // Progress report every 50 victims
    if (processed % 50 === 0 || i + BATCH_SIZE >= toProcess.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (processed / ((Date.now() - startTime) / 1000)).toFixed(1);
      console.log(
        `  [${processed}/${toProcess.length}] ${totalFieldsUpdated} fields, ${totalYamlUpdated} YAMLs, ${totalErrors} errors (${elapsed}s, ${rate}/s)`
      );
    }

    // Save progress periodically
    if (!dryRun && processed % 100 === 0) {
      saveProgress(processedIds);
    }

    // Delay between batches
    if (i + BATCH_SIZE < toProcess.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // Final progress save
  if (!dryRun) {
    saveProgress(processedIds);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✓ Extraction complete in ${totalTime}s`);
  console.log(`  Processed: ${processed}`);
  console.log(`  DB fields updated: ${totalFieldsUpdated}`);
  console.log(`  YAML files updated: ${totalYamlUpdated}`);
  console.log(`  Errors: ${totalErrors}`);
}

main()
  .catch((e) => {
    console.error("Extraction failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
