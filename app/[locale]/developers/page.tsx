"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { SITE_URL } from "@/lib/site-url";
import { CONTACT_EMAIL } from "@/lib/contact";

// ReDoc only loads when the user expands the "Full API reference" section,
// so the developers landing stays light. SSR-disabled because ReDoc uses window.
const RedocStandalone = dynamic(() => import("redoc").then((mod) => mod.RedocStandalone), {
  ssr: false,
});

// schema.org/Dataset — makes the archive findable in Google Dataset Search,
// crawlable for academic citation aggregators (OpenAlex, CORE, OpenAIRE) and
// linkable from NGO knowledge graphs. Critical step toward the FAIR-data
// gold-standard goal. Values are server-side constants — no user data flows
// through, but we still escape script-breakout sequences as defence in depth.
const DATASET_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "Iran Memorial Victim Archive",
  alternateName: "آرشیو قربانیان یادبود ایران",
  description:
    "Open archive of 37,000+ documented victims of the Islamic Republic of Iran (1979–present), cross-referenced against 15+ verified human-rights data sources.",
  url: SITE_URL,
  // No sameAs to source repo — OPSEC on IRI-critical projects, maintainer
  // identity stays unsurfaced. See docs/SECURITY.md.
  keywords: [
    "Iran",
    "human rights",
    "memorial",
    "executions",
    "political prisoners",
    "Islamic Republic",
    "1988 massacre",
    "Woman Life Freedom",
  ],
  license: "https://creativecommons.org/licenses/by-sa/4.0/",
  isAccessibleForFree: true,
  creator: {
    "@type": "Organization",
    name: "Iran Memorial",
    url: SITE_URL,
  },
  distribution: [
    {
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: `${SITE_URL}/api/v1/victims`,
    },
    {
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: `${SITE_URL}/api/v1/public/dump`,
    },
  ],
  temporalCoverage: "1979-01-01/..",
};

function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");
}

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "mcp", label: "MCP for AI agents" },
  { id: "rest", label: "REST API" },
  { id: "bulk", label: "Bulk dataset" },
  { id: "auth", label: "Authentication" },
  { id: "rate-limits", label: "Rate limits" },
  { id: "license", label: "License & attribution" },
  { id: "api-reference", label: "Full API reference" },
];

export default function DevelopersPage() {
  const t = useTranslations("developers");

  const datasetHtml = { __html: safeJsonLd(DATASET_JSON_LD) };

  return (
    <div className="min-h-screen bg-memorial-950 text-memorial-100">
      {/* schema.org Dataset — values are server-side constants, escaped via
          safeJsonLd above to neutralise any script-breakout sequence. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={datasetHtml} />
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
        {/* Sidebar */}
        <aside className="hidden lg:block sticky top-24 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
          <p className="text-xs uppercase tracking-wider text-memorial-500 mb-3 font-semibold">
            On this page
          </p>
          <nav>
            <ul className="space-y-1">
              {NAV.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="block px-3 py-1.5 rounded text-sm text-memorial-300 hover:text-gold-400 hover:bg-memorial-900 transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main */}
        <main className="min-w-0 max-w-3xl">
          {/* Hero */}
          <section id="overview" className="scroll-mt-24 mb-16">
            <h1 className="text-4xl font-bold mb-3">{t("title")}</h1>
            <p className="text-memorial-300 text-lg leading-relaxed mb-8">
              {t("description")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <PathCard
                href="#mcp"
                badge="AI agents"
                title="MCP"
                desc="Plug an LLM directly into the database. Public, no auth."
              />
              <PathCard
                href="#rest"
                badge="Apps & dashboards"
                title="REST API"
                desc="JSON endpoints, Bearer auth, 1000 req/h."
              />
              <PathCard
                href="#bulk"
                badge="Journalism & research"
                title="Bulk dump"
                desc="Single ~30 MB JSON of all victims, CC BY-SA 4.0."
              />
            </div>
          </section>

          {/* MCP */}
          <Section id="mcp" title={t("mcpTitle")} pill="public · read-only">
            <p className="mb-6">{t("mcpIntro")}</p>

            <h3 className="text-lg font-semibold mb-3 text-memorial-100">Tools</h3>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm border border-memorial-800 rounded">
                <thead className="bg-memorial-800/50 text-memorial-200">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Tool</th>
                    <th className="text-left px-3 py-2 font-medium">Purpose</th>
                    <th className="text-left px-3 py-2 font-medium">Limit</th>
                  </tr>
                </thead>
                <tbody className="text-memorial-300">
                  {[
                    ["search_victims", "Full-text search by name / place / details", "60/min"],
                    ["get_victim", "Full profile by slug — names, dates, charges, sources, photo", "120/min"],
                    ["get_executions", "Judicial executions, filterable by method + year", "30/min"],
                    ["get_death_row", "People currently sentenced to death — advocacy CTA", "30/min"],
                    ["get_statistics", "Aggregate counts: victims, sources, death-row size", "30/min"],
                  ].map(([tool, purpose, limit]) => (
                    <tr key={tool} className="border-t border-memorial-800">
                      <td className="px-3 py-2 font-mono text-gold-300 whitespace-nowrap">{tool}</td>
                      <td className="px-3 py-2">{purpose}</td>
                      <td className="px-3 py-2 text-memorial-400 whitespace-nowrap">{limit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-semibold mb-2 text-memorial-100">HTTP — same data, no MCP client</h3>
            <p className="text-memorial-400 text-sm mb-3">CORS-enabled, JSON only.</p>
            <Code>
{`GET ${SITE_URL}/api/mcp/search?q=mahsa&limit=10
GET ${SITE_URL}/api/mcp/victims/{slug}
GET ${SITE_URL}/api/mcp/executions?method=hanging&year=2026
GET ${SITE_URL}/api/mcp/death-row?limit=50
GET ${SITE_URL}/api/mcp/statistics`}
            </Code>

            <h3 className="text-lg font-semibold mt-8 mb-2 text-memorial-100">Local stdio server</h3>
            <p className="text-memorial-400 text-sm mb-3">
              Bundled in{" "}
              <a
                href="https://github.com/iran-memorial26/iran-memorial/tree/main/tools/mcp"
                className="text-gold-400 hover:text-gold-300 font-mono"
                target="_blank"
                rel="noreferrer"
              >
                tools/mcp/
              </a>
              . For Claude Desktop, add this to{" "}
              <code className="font-mono text-gold-300 text-sm">claude_desktop_config.json</code>:
            </p>
            <Code>
{`{
  "mcpServers": {
    "iran-memorial": {
      "command": "node",
      "args": ["/absolute/path/to/iran-memorial/tools/mcp/dist/index.js"]
    }
  }
}`}
            </Code>
          </Section>

          {/* REST */}
          <Section id="rest" title="REST API" pill="bearer auth · v1">
            <p className="mb-4">
              5 read endpoints under{" "}
              <code className="font-mono text-gold-300 text-sm">/api/v1</code>. Authenticated by an
              admin-issued API key. Response shape and parameters are in the{" "}
              <a href="#api-reference" className="text-gold-400 hover:text-gold-300">
                full reference
              </a>{" "}
              below.
            </p>

            <h3 className="text-lg font-semibold mb-2 text-memorial-100">Endpoints</h3>
            <Code>
{`GET ${SITE_URL}/api/v1/victims
GET ${SITE_URL}/api/v1/victims/{slug}
GET ${SITE_URL}/api/v1/events
GET ${SITE_URL}/api/v1/sources
GET ${SITE_URL}/api/v1/statistics`}
            </Code>

            <h3 className="text-lg font-semibold mt-6 mb-2 text-memorial-100">Example request</h3>
            <Code>
{`curl -H "Authorization: Bearer iran_mem_..." \\
     "${SITE_URL}/api/v1/victims?page=1&limit=50"`}
            </Code>
          </Section>

          {/* Bulk */}
          <Section id="bulk" title="Bulk dataset" pill="public · CC BY-SA 4.0">
            <p className="mb-4">
              Single JSON document with every victim — names, dates, places, causes, sources,
              verification status. ~30 MB, refreshed weekly when the enricher pipeline runs.
              Cached on Cloudflare for an hour, so this won&rsquo;t hit our DB on repeat fetches.
            </p>
            <Code>{`curl ${SITE_URL}/api/v1/public/dump > iran-memorial.json`}</Code>
            <p className="text-memorial-400 text-sm mt-3">
              For journalists, researchers, and advocacy orgs. Attribution required.
            </p>
          </Section>

          {/* Auth */}
          <Section id="auth" title={t("quickStart")}>
            <ol className="list-decimal list-inside space-y-3 text-memorial-200 mb-6">
              <li>{t("step1", { contactEmail: CONTACT_EMAIL })}</li>
              <li>{t("step2")}</li>
              <li>{t("step3", { url: SITE_URL })}</li>
            </ol>
            <p className="text-memorial-400 text-sm">
              {t("contact")}{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-gold-400 hover:text-gold-300"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </Section>

          {/* Rate limits */}
          <Section id="rate-limits" title="Rate limits">
            <table className="w-full text-sm border border-memorial-800 rounded">
              <thead className="bg-memorial-800/50 text-memorial-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Surface</th>
                  <th className="text-left px-3 py-2 font-medium">Limit</th>
                  <th className="text-left px-3 py-2 font-medium">Keyed by</th>
                </tr>
              </thead>
              <tbody className="text-memorial-300">
                <tr className="border-t border-memorial-800">
                  <td className="px-3 py-2 font-mono">/api/mcp/*</td>
                  <td className="px-3 py-2">30–120 req/min</td>
                  <td className="px-3 py-2">IP</td>
                </tr>
                <tr className="border-t border-memorial-800">
                  <td className="px-3 py-2 font-mono">/api/v1/*</td>
                  <td className="px-3 py-2">1000 req/h</td>
                  <td className="px-3 py-2">API key</td>
                </tr>
                <tr className="border-t border-memorial-800">
                  <td className="px-3 py-2 font-mono">/api/v1/public/dump</td>
                  <td className="px-3 py-2">CDN-cached 1 h</td>
                  <td className="px-3 py-2">—</td>
                </tr>
              </tbody>
            </table>
            <p className="text-memorial-400 text-sm mt-3">
              Exceeding a limit returns <code className="font-mono text-gold-300">HTTP 429</code>{" "}
              with a <code className="font-mono text-gold-300">Retry-After</code> header.
            </p>
          </Section>

          {/* License */}
          <Section id="license" title={t("license").split(":")[0] || "License"}>
            <p className="mb-2">
              All data is licensed{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                className="text-gold-400 hover:text-gold-300"
                target="_blank"
                rel="noreferrer"
              >
                CC BY-SA 4.0
              </a>
              . Attribution required, share-alike for derivatives.
            </p>
            <p className="text-memorial-400 text-sm">
              Cite as: <em>Iran Memorial — {SITE_URL.replace(/^https?:\/\//, "")}</em>
            </p>
          </Section>

          {/* Full API Reference */}
          <Section id="api-reference" title="Full API reference">
            <p className="text-memorial-400 text-sm mb-4">
              Generated from{" "}
              <a
                href="/openapi.yaml"
                className="text-gold-400 hover:text-gold-300 font-mono"
              >
                /openapi.yaml
              </a>
              . Schemas, parameters, response examples for every v1 endpoint.
            </p>
            <details className="rounded-lg overflow-hidden border border-memorial-800 bg-memorial-950 group">
              <summary className="px-4 py-3 cursor-pointer text-memorial-200 hover:bg-memorial-900 group-open:border-b group-open:border-memorial-800">
                Open interactive reference (ReDoc)
              </summary>
              <div className="bg-memorial-950">
                <RedocStandalone
                  specUrl="/openapi.yaml"
                  options={{
                    theme: {
                      colors: {
                        primary: { main: "#d4af37" },
                        success: { main: "#10b981" },
                        error: { main: "#ef4444" },
                      },
                      typography: { fontSize: "14px", fontFamily: "Inter, sans-serif" },
                      sidebar: { backgroundColor: "#0a0a0f", textColor: "#e5e5e7" },
                    },
                    scrollYOffset: 80,
                  }}
                />
              </div>
            </details>
          </Section>
        </main>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  pill,
  children,
}: {
  id: string;
  title: string;
  pill?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 mb-16">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {pill && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gold-700/20 text-gold-300 border border-gold-700/40">
            {pill}
          </span>
        )}
      </div>
      <div className="text-memorial-200 leading-relaxed">{children}</div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-memorial-950 border border-memorial-800 rounded-lg p-4 text-xs text-memorial-200 overflow-x-auto">
      {children}
    </pre>
  );
}

function PathCard({
  href,
  badge,
  title,
  desc,
}: {
  href: string;
  badge: string;
  title: string;
  desc: string;
}) {
  return (
    <a
      href={href}
      className="block bg-memorial-900 hover:bg-memorial-800/70 border border-memorial-800 hover:border-gold-700/40 rounded-lg p-5 transition-colors"
    >
      <p className="text-xs uppercase tracking-wider text-gold-400 mb-2 font-semibold">
        {badge}
      </p>
      <h3 className="text-xl font-semibold text-memorial-100 mb-1">{title}</h3>
      <p className="text-sm text-memorial-300 leading-snug">{desc}</p>
    </a>
  );
}
