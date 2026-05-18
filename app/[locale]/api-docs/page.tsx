import { setRequestLocale } from "next-intl/server";
import { getStats } from "@/lib/queries";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function ApiDocsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const stats = await getStats();

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12 sm:py-20">
      <div className="mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-memorial-100 tracking-tight">
          API Documentation
        </h1>
        <p className="mt-3 text-memorial-400">
          Open data API for the Iran Memorial database. All data is free to use under{" "}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            className="text-gold-400 hover:text-gold-300 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            CC BY-SA 4.0
          </a>.
        </p>
        <p className="mt-2 text-sm text-memorial-500">
          Currently documenting {stats.victimCount.toLocaleString()} victims from {stats.eventCount} major events across {stats.yearsOfRepression} years.
        </p>
      </div>

      {/* Base URL */}
      <Section title="Base URL">
        <CodeBlock>{`${SITE_URL}/api`}</CodeBlock>
      </Section>

      {/* Search API */}
      <Section title="Search Victims">
        <div className="space-y-3">
          <MethodBadge method="GET" path="/api/search" />
          <p className="text-memorial-300 text-sm">
            Full-text search across victim names (Latin and Farsi), places, and details.
            Uses PostgreSQL tsvector with trigram fallback for fuzzy matching.
          </p>
          <ParamTable
            params={[
              { name: "q", type: "string", required: true, description: "Search query (max 200 chars)" },
              { name: "limit", type: "number", required: false, description: "Max results (1–50, default: 20)" },
            ]}
          />
          <p className="text-xs text-memorial-500">Rate limit: 100 requests/minute per IP</p>
          <h4 className="text-sm font-medium text-memorial-200 mt-4">Example</h4>
          <CodeBlock>GET /api/search?q=mahsa+amini&limit=5</CodeBlock>
          <CodeBlock>{`{
  "results": [
    {
      "slug": "amini-mahsa-jina",
      "nameLatin": "Mahsa (Jina) Amini",
      "nameFarsi": "مهسا (ژینا) امینی",
      "dateOfDeath": "2022-09-16",
      "placeOfDeath": "Tehran"
    }
  ]
}`}</CodeBlock>
        </div>
      </Section>

      {/* Export API */}
      <Section title="Export Data">
        <div className="space-y-3">
          <MethodBadge method="GET" path="/api/export" />
          <p className="text-memorial-300 text-sm">
            Download the full victim database as JSON or CSV. Includes all public fields.
          </p>
          <ParamTable
            params={[
              { name: "format", type: "string", required: false, description: '"json" (default) or "csv"' },
            ]}
          />
          <p className="text-xs text-memorial-500">Rate limit: 10 requests/hour per IP</p>
          <h4 className="text-sm font-medium text-memorial-200 mt-4">Examples</h4>
          <CodeBlock>GET /api/export?format=json</CodeBlock>
          <CodeBlock>GET /api/export?format=csv</CodeBlock>
          <h4 className="text-sm font-medium text-memorial-200 mt-4">JSON Response Structure</h4>
          <CodeBlock>{`{
  "meta": {
    "total": ${stats.victimCount.toLocaleString()},
    "exported_at": "2026-02-15T12:00:00.000Z",
    "source": "Iran Memorial",
    "license": "CC BY-SA 4.0"
  },
  "victims": [
    {
      "slug": "...",
      "name_latin": "...",
      "name_farsi": "...",
      "date_of_death": "YYYY-MM-DD",
      "province": "...",
      "cause_of_death": "...",
      "circumstances_en": "...",
      ...
    }
  ]
}`}</CodeBlock>
          <h4 className="text-sm font-medium text-memorial-200 mt-4">CSV Fields</h4>
          <p className="text-xs text-memorial-400">
            slug, name_latin, name_farsi, aliases, date_of_birth, place_of_birth, gender, ethnicity,
            religion, photo_url, occupation_en, occupation_fa, education, date_of_death, age_at_death,
            place_of_death, province, cause_of_death, circumstances_en, circumstances_fa,
            event_context, responsible_forces, burial_location, verification_status, data_source
          </p>
        </div>
      </Section>

      {/* Submit API */}
      <Section title="Submit Information">
        <div className="space-y-3">
          <MethodBadge method="POST" path="/api/submit" />
          <p className="text-memorial-300 text-sm">
            Submit information about a victim for review. All submissions are manually reviewed before publication.
          </p>
          <h4 className="text-sm font-medium text-memorial-200">Request Body (JSON)</h4>
          <CodeBlock>{`{
  "nameLatin": "Full Name",        // required
  "nameFarsi": "نام کامل",         // optional
  "details": "What you know...",   // required
  "sources": "https://...",        // optional
  "submitterEmail": "...",         // optional
  "submitterName": "..."           // optional
}`}</CodeBlock>
          <p className="text-xs text-memorial-500">Rate limit: 5 submissions/hour per IP</p>
        </div>
      </Section>

      {/* Usage Notes */}
      <Section title="Usage Notes">
        <ul className="space-y-2 text-sm text-memorial-300">
          <li className="flex gap-2">
            <span className="text-gold-400 flex-shrink-0">1.</span>
            <span>All data is provided under <strong className="text-memorial-200">CC BY-SA 4.0</strong>. Attribution required.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-gold-400 flex-shrink-0">2.</span>
            <span>Please respect rate limits. For bulk access, use the export endpoint.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-gold-400 flex-shrink-0">3.</span>
            <span>Data is continuously updated as new information is verified.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-gold-400 flex-shrink-0">4.</span>
            <span>This API documents real victims. Please use the data respectfully.</span>
          </li>
        </ul>
      </Section>

      {/* Source Code */}
      <div className="mt-16 pt-8 border-t border-memorial-800">
        <p className="text-sm text-memorial-500">
          This project is open source:{" "}
          <a
            href="https://github.com/iran-memorial26/iran-memorial"
            className="text-gold-400 hover:text-gold-300 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/iran-memorial26/iran-memorial
          </a>
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-12 first:mt-0">
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-lg font-semibold text-gold-400 flex-shrink-0">{title}</h2>
        <div className="h-px flex-1 bg-memorial-800" />
      </div>
      {children}
    </div>
  );
}

function MethodBadge({ method, path }: { method: string; path: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-900/50 text-green-400 border border-green-800/50">
        {method}
      </span>
      <code className="text-sm text-memorial-200 font-mono">{path}</code>
    </div>
  );
}

function ParamTable({
  params,
}: {
  params: { name: string; type: string; required: boolean; description: string }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-memorial-500 text-start border-b border-memorial-800">
            <th className="py-2 pe-4 text-start font-medium">Parameter</th>
            <th className="py-2 pe-4 text-start font-medium">Type</th>
            <th className="py-2 pe-4 text-start font-medium">Required</th>
            <th className="py-2 text-start font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => (
            <tr key={p.name} className="border-b border-memorial-800/50">
              <td className="py-2 pe-4">
                <code className="text-gold-400 font-mono text-xs">{p.name}</code>
              </td>
              <td className="py-2 pe-4 text-memorial-400">{p.type}</td>
              <td className="py-2 pe-4 text-memorial-400">{p.required ? "Yes" : "No"}</td>
              <td className="py-2 text-memorial-300">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-memorial-900/80 border border-memorial-800/60 rounded-lg p-4 overflow-x-auto text-sm text-memorial-200 font-mono">
      {children}
    </pre>
  );
}
