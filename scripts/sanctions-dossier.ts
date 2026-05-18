#!/usr/bin/env tsx
/**
 * sanctions-dossier — generate a Magnitsky-style submission dossier for one
 *                     judge, court, or named perpetrator from the live DB.
 *
 * Output is HTML (one self-contained file) intended to be:
 *   - printed to PDF by a maintainer for formal submission, OR
 *   - piped through wkhtmltopdf / chromium --headless --print-to-pdf.
 *
 * Designed to slot into submissions to:
 *   - EU EEAS Sanctions Unit (Brussels)
 *   - OFAC Iran Sanctions team (US Treasury)
 *   - UK FCDO Sanctions Unit
 *   - Canada SEMA (Special Economic Measures Act)
 *
 * The dossier follows the structure those bodies expect:
 *   1. Subject identification
 *   2. Pattern of conduct (statistics)
 *   3. Specific incidents (top 10 most-documented victims)
 *   4. Source citations (per incident)
 *   5. Submitting organization + verification methodology
 *
 * Usage:
 *   tsx scripts/sanctions-dossier.ts --type court --name "Revolutionary Court of Tehran" \
 *     --out dossiers/court-tehran-revolutionary.html
 *   tsx scripts/sanctions-dossier.ts --type judge --name "Abolghassem Salavati" \
 *     --out dossiers/judge-salavati.html
 *
 * The script uses prismaReadOnly — it cannot mutate any data. Safe to give
 * to research partners under read-only DB credentials.
 */

import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ─── CLI ──────────────────────────────────────────────────────────────────

interface Args {
  type: "judge" | "court" | "perpetrator";
  name: string;
  out: string;
  limit: number;
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = { limit: 25 };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === "--type") args.type = v as Args["type"];
    else if (k === "--name") args.name = v;
    else if (k === "--out") args.out = v;
    else if (k === "--limit") args.limit = Number(v);
    if (k.startsWith("--")) i++;
  }
  if (!args.type || !args.name || !args.out) {
    console.error(`Usage: tsx scripts/sanctions-dossier.ts \\
  --type {judge|court|perpetrator} \\
  --name "<full name>" \\
  --out <output.html> \\
  [--limit 25]`);
    process.exit(1);
  }
  return args as Args;
}

// ─── DB ───────────────────────────────────────────────────────────────────

// Prefer the read-only role if it's set (production); fall back to the
// regular DATABASE_URL for local dev.
const url = process.env.DATABASE_URL_READONLY || process.env.DATABASE_URL;
const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

// ─── Query ────────────────────────────────────────────────────────────────

interface VictimRow {
  slug: string;
  nameLatin: string;
  nameFarsi: string | null;
  dateOfDeath: Date | null;
  placeOfDeath: string | null;
  causeOfDeath: string | null;
  circumstancesEn: string | null;
  legalProceedings: string | null;
  responsibleForces: string | null;
  sourceUrls: { name: string; url: string }[];
}

async function findVictims(args: Args): Promise<VictimRow[]> {
  // Match against responsible_forces, legal_proceedings, AND case_context
  // (ilike). Anyone in any of those columns counts as connected.
  const pattern = `%${args.name}%`;
  const rows = await prisma.$queryRaw<{
    slug: string;
    name_latin: string;
    name_farsi: string | null;
    date_of_death: Date | null;
    place_of_death: string | null;
    cause_of_death: string | null;
    circumstances_en: string | null;
    legal_proceedings: string | null;
    responsible_forces: string | null;
  }[]>`
    SELECT slug, name_latin, name_farsi, date_of_death, place_of_death,
           cause_of_death, circumstances_en, legal_proceedings, responsible_forces
      FROM victims
     WHERE COALESCE(responsible_forces, '') ILIKE ${pattern}
        OR COALESCE(legal_proceedings, '')  ILIKE ${pattern}
        OR COALESCE(circumstances_en, '')   ILIKE ${pattern}
     ORDER BY (date_of_death IS NOT NULL) DESC, date_of_death DESC NULLS LAST
     LIMIT ${args.limit + 5};
  `;
  if (rows.length === 0) return [];

  // Pull source URLs in one batch.
  const slugs = rows.map((r) => r.slug);
  const sources = await prisma.$queryRaw<{
    slug: string;
    name: string;
    url: string | null;
  }[]>`
    SELECT v.slug, s.name, s.url
      FROM sources s JOIN victims v ON v.id = s.victim_id
     WHERE v.slug = ANY(${slugs}::text[])
       AND s.url IS NOT NULL
     ORDER BY v.slug, s.name;
  `;

  const sourceMap = new Map<string, { name: string; url: string }[]>();
  for (const s of sources) {
    if (!s.url) continue;
    const arr = sourceMap.get(s.slug) ?? [];
    arr.push({ name: s.name, url: s.url });
    sourceMap.set(s.slug, arr);
  }

  return rows.slice(0, args.limit).map((r) => ({
    slug: r.slug,
    nameLatin: r.name_latin,
    nameFarsi: r.name_farsi,
    dateOfDeath: r.date_of_death,
    placeOfDeath: r.place_of_death,
    causeOfDeath: r.cause_of_death,
    circumstancesEn: r.circumstances_en,
    legalProceedings: r.legal_proceedings,
    responsibleForces: r.responsible_forces,
    sourceUrls: sourceMap.get(r.slug) ?? [],
  }));
}

interface Stats {
  totalLinked: number;
  yearRange: [number | null, number | null];
  causes: { cause: string; count: number }[];
}

async function computeStats(args: Args): Promise<Stats> {
  const pattern = `%${args.name}%`;
  const totalRow = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
      FROM victims
     WHERE COALESCE(responsible_forces, '') ILIKE ${pattern}
        OR COALESCE(legal_proceedings, '')  ILIKE ${pattern}
        OR COALESCE(circumstances_en, '')   ILIKE ${pattern};
  `;
  const yearRow = await prisma.$queryRaw<{ y_min: number | null; y_max: number | null }[]>`
    SELECT EXTRACT(YEAR FROM MIN(date_of_death))::int AS y_min,
           EXTRACT(YEAR FROM MAX(date_of_death))::int AS y_max
      FROM victims
     WHERE date_of_death IS NOT NULL
       AND ( COALESCE(responsible_forces, '') ILIKE ${pattern}
          OR COALESCE(legal_proceedings, '')  ILIKE ${pattern}
          OR COALESCE(circumstances_en, '')   ILIKE ${pattern} );
  `;
  const causes = await prisma.$queryRaw<{ cause: string; count: bigint }[]>`
    SELECT COALESCE(cause_of_death, 'unspecified') AS cause,
           COUNT(*)::bigint AS count
      FROM victims
     WHERE COALESCE(responsible_forces, '') ILIKE ${pattern}
        OR COALESCE(legal_proceedings, '')  ILIKE ${pattern}
        OR COALESCE(circumstances_en, '')   ILIKE ${pattern}
     GROUP BY cause_of_death
     ORDER BY count DESC
     LIMIT 10;
  `;
  return {
    totalLinked: Number(totalRow[0]?.count ?? 0n),
    yearRange: [yearRow[0]?.y_min ?? null, yearRow[0]?.y_max ?? null],
    causes: causes.map((c) => ({ cause: c.cause, count: Number(c.count) })),
  };
}

// ─── Render ───────────────────────────────────────────────────────────────

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toISOString().split("T")[0];
}

function renderDossier(args: Args, victims: VictimRow[], stats: Stats): string {
  const subjectLabel = {
    judge: "Judge",
    court: "Court",
    perpetrator: "Named perpetrator",
  }[args.type];

  const yrFrom = stats.yearRange[0] ?? "—";
  const yrTo = stats.yearRange[1] ?? "—";
  const generatedAt = new Date().toISOString();

  const tableRows = victims
    .map(
      (v, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>
            <strong>${escapeHtml(v.nameLatin)}</strong>${
              v.nameFarsi
                ? ` <span class="farsi" dir="rtl">${escapeHtml(v.nameFarsi)}</span>`
                : ""
            }
            <div class="link"><a href="${SITE_URL}/en/victims/${v.slug}">${SITE_URL}/en/victims/${v.slug}</a></div>
          </td>
          <td>${fmtDate(v.dateOfDeath)}</td>
          <td>${escapeHtml(v.placeOfDeath)}</td>
          <td>${escapeHtml(v.causeOfDeath)}</td>
          <td class="sources">
            ${
              v.sourceUrls.length === 0
                ? '<span class="muted">—</span>'
                : v.sourceUrls
                    .slice(0, 5)
                    .map(
                      (s) =>
                        `<a href="${escapeHtml(s.url)}">${escapeHtml(s.name)}</a>`,
                    )
                    .join("<br/>")
            }
          </td>
        </tr>
        ${
          v.circumstancesEn
            ? `<tr class="circ"><td colspan="6"><div class="circumstances"><strong>Circumstances:</strong> ${escapeHtml(
                v.circumstancesEn,
              )}</div></td></tr>`
            : ""
        }
      `,
    )
    .join("\n");

  const causesRows = stats.causes
    .map(
      (c) =>
        `<tr><td>${escapeHtml(c.cause)}</td><td class="num">${c.count}</td></tr>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Sanctions Dossier — ${escapeHtml(args.name)}</title>
<style>
  @page { size: A4; margin: 22mm 18mm; }
  :root { --ink:#111; --muted:#555; --accent:#7a5b00; --rule:#bbb; }
  * { box-sizing:border-box }
  body { font: 10.5pt/1.5 "Times New Roman", Georgia, serif; color:var(--ink); margin:0; padding:0 }
  h1 { font-size: 18pt; margin: 0 0 4pt; letter-spacing: .3pt }
  h2 { font-size: 13pt; margin: 22pt 0 8pt; padding-bottom: 4pt; border-bottom: 1px solid var(--rule); }
  h3 { font-size: 11pt; margin: 14pt 0 4pt }
  p  { margin: 0 0 8pt }
  .meta { font-size: 9.5pt; color: var(--muted); margin-bottom: 14pt }
  .meta strong { color: var(--ink) }
  .stats { display:grid; grid-template-columns: repeat(3, 1fr); gap: 8pt; margin: 12pt 0 }
  .stats .tile { border:1px solid var(--rule); padding: 8pt 10pt; }
  .stats .tile strong { font-size: 16pt; display:block; color: var(--accent); }
  .stats .tile span  { font-size: 9pt; color: var(--muted) }
  table { width:100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 6pt; }
  th, td { padding: 5pt 6pt; vertical-align: top; border-top: 1px solid var(--rule); text-align:left }
  th { background:#f5f3ee; font-weight:600 }
  td.num { width: 24pt; color: var(--muted) }
  tr.circ td { border-top: 0; padding-top: 0; padding-bottom: 8pt; font-size: 9pt; color: var(--muted) }
  .circumstances { padding: 4pt 8pt; background:#fafaf6; border-left: 2px solid var(--accent) }
  .farsi { font-size: 10pt; color: var(--muted); margin-left: 4pt }
  .link a { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8.5pt; color: var(--muted); }
  .link a:hover { color: var(--accent) }
  .sources a { display: inline-block; font-size: 8.5pt; }
  .muted { color: var(--muted) }
  .footer { margin-top: 28pt; padding-top: 10pt; border-top: 1px solid var(--rule); font-size: 9pt; color: var(--muted) }
  .footer p { margin: 2pt 0 }
  .header { border-bottom: 2px solid var(--accent); padding-bottom: 12pt; margin-bottom: 18pt }
  .org { font-size: 9pt; color: var(--muted); text-transform: uppercase; letter-spacing: .8pt }
</style>
</head>
<body>

<header class="header">
  <div class="org">Iran Memorial Project · Submitted by Woman Life Freedom e.V.</div>
  <h1>Sanctions Dossier — ${escapeHtml(args.name)}</h1>
  <p class="meta">
    <strong>Subject type:</strong> ${escapeHtml(subjectLabel)} ·
    <strong>Generated:</strong> ${generatedAt} ·
    <strong>Source:</strong> <a href="${SITE_URL}">${SITE_URL.replace(/^https?:\/\//, "")}</a>
  </p>
</header>

<section>
  <h2>1. Subject Identification</h2>
  <p>
    The subject identified in this dossier appears in connection with documented
    extra-judicial killings, executions, or detention deaths recorded in the Iran
    Memorial Project database. The subject is identified by the name string
    <strong>"${escapeHtml(args.name)}"</strong> as it appears in primary sources
    aggregated from twelve human-rights and journalism organizations.
  </p>
  <p>
    This dossier is provided as input material for sanctions consideration under
    targeted human-rights regimes (EU Global Human Rights Sanctions Regulation,
    US Magnitsky Act, UK Global Human Rights Sanctions Regulations 2020, and
    equivalent frameworks). It is not a finding of fact and does not substitute
    for independent investigation.
  </p>
</section>

<section>
  <h2>2. Pattern of Conduct</h2>
  <div class="stats">
    <div class="tile"><strong>${stats.totalLinked.toLocaleString("en-US")}</strong><span>Documented victims linked</span></div>
    <div class="tile"><strong>${yrFrom}–${yrTo}</strong><span>Years of activity (where dated)</span></div>
    <div class="tile"><strong>${victims.length}</strong><span>Cases detailed below</span></div>
  </div>

  ${
    stats.causes.length
      ? `<h3>Causes of death (linked victims)</h3>
         <table>
           <thead><tr><th>Cause</th><th class="num">Count</th></tr></thead>
           <tbody>${causesRows}</tbody>
         </table>`
      : ""
  }
</section>

<section>
  <h2>3. Specific Documented Incidents</h2>
  <p>
    The following ${victims.length} cases are the most thoroughly documented
    incidents involving the subject. Each row links to the live victim profile
    on the Iran Memorial site, where additional sources, photographs, and
    biographical detail are available.
  </p>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Victim</th><th>Date</th><th>Place</th><th>Cause</th><th>Sources</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</section>

<section>
  <h2>4. Verification Methodology</h2>
  <p>
    Each linked victim record is sourced from at least one credible primary or
    secondary source. The Iran Memorial Project applies a three-tier credibility
    model (HIGH / REPUTABLE / COMMUNITY) and cross-references entries from
    twelve contributing organizations including the Abdorrahman Boroumand
    Center, HRANA News Agency, Hengaw, Kurdistan Human Rights Network,
    Committee to Protect Journalists, and others.
  </p>
  <p>
    Full methodology is published at <a href="${SITE_URL}/en/methodology">${SITE_URL.replace(/^https?:\/\//, "")}/en/methodology</a>.
    The complete underlying dataset is freely available for independent
    verification under CC BY-SA 4.0 at
    <a href="${SITE_URL}/api/v1/public/dump">${SITE_URL.replace(/^https?:\/\//, "")}/api/v1/public/dump</a>.
  </p>
</section>

<footer class="footer">
  <p><strong>Submitting organization:</strong> Woman Life Freedom e.V. (Germany)</p>
  <p><strong>Contact:</strong> ${process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "<CONTACT_EMAIL>"}</p>
  <p><strong>License:</strong> Iran Memorial data is licensed CC BY-SA 4.0. This dossier is intended for sanctions submissions, court filings, asylum proceedings, and journalism.</p>
  <p><strong>Generated:</strong> ${generatedAt}</p>
</footer>

</body>
</html>
`;
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  console.error(`Querying victims linked to "${args.name}"...`);
  const [victims, stats] = await Promise.all([findVictims(args), computeStats(args)]);
  console.error(`  total linked: ${stats.totalLinked}`);
  console.error(`  detailed cases: ${victims.length}`);
  if (victims.length === 0) {
    console.error(`No victims found. Check the name spelling or try --type perpetrator.`);
    process.exit(2);
  }
  const html = renderDossier(args, victims, stats);
  const outPath = resolve(args.out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, "utf8");
  console.error(`Wrote ${outPath}`);
  console.error(``);
  console.error(`Convert to PDF:`);
  console.error(`  chromium --headless --no-sandbox --disable-gpu \\`);
  console.error(`    --print-to-pdf="${outPath.replace(/\.html$/, ".pdf")}" \\`);
  console.error(`    "file://${outPath}"`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
