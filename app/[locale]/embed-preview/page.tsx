import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/config";
import type { Metadata } from "next";
import { SITE_URL as BASE } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "de" ? "Embed-Widget — Iran Memorial" : "Embed Widget — Iran Memorial",
    description:
      "Free, copy-paste live counter widget for journalists, NGOs, and activist sites. CC BY-SA 4.0.",
    alternates: { canonical: `${BASE}/${locale}/embed-preview` },
  };
}

export default async function EmbedPreviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PreviewContent locale={locale as Locale} />;
}

function PreviewContent({ locale }: { locale: Locale }) {
  const t = useTranslations("embedPreview");

  const variants: Array<{ id: string; label: string; theme: "dark" | "light"; size: "sm" | "md" }> = [
    { id: "dark-md", label: t("variantDarkMd"), theme: "dark", size: "md" },
    { id: "light-md", label: t("variantLightMd"), theme: "light", size: "md" },
    { id: "dark-sm", label: t("variantDarkSm"), theme: "dark", size: "sm" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <header className="mb-12">
        <p className="text-xs uppercase tracking-widest text-gold-400 mb-3">
          {t("eyebrow")}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-memorial-100 mb-4">
          {t("title")}
        </h1>
        <p className="text-lg text-memorial-300 leading-relaxed max-w-2xl">
          {t("intro")}
        </p>
      </header>

      <section className="mb-12">
        <h2 className="text-sm uppercase tracking-wider text-memorial-400 mb-4">
          {t("howTitle")}
        </h2>
        <ol className="space-y-3 text-memorial-300">
          <Step n={1}>{t("step1")}</Step>
          <Step n={2}>{t("step2")}</Step>
          <Step n={3}>{t("step3")}</Step>
        </ol>
      </section>

      <section className="space-y-12">
        {variants.map((v) => {
          const src = `${BASE}/embed?theme=${v.theme}&size=${v.size}&locale=${locale}`;
          const height = v.size === "sm" ? 130 : 170;
          const snippet = `<iframe\n  src="${src}"\n  width="100%"\n  height="${height}"\n  frameborder="0"\n  loading="lazy"\n  title="Iran Memorial — Live Counter"></iframe>`;
          return (
            <article key={v.id}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold text-memorial-100">{v.label}</h2>
                <span className="text-xs text-memorial-500">
                  {v.theme} · {v.size}
                </span>
              </div>

              <div className="rounded-lg border border-memorial-800/60 bg-memorial-950 p-4 mb-4">
                <iframe
                  src={src}
                  width="100%"
                  height={height}
                  frameBorder={0}
                  loading="lazy"
                  title={`Iran Memorial — ${v.label}`}
                  className="block"
                />
              </div>

              <details className="group">
                <summary className="cursor-pointer text-sm text-gold-400 hover:text-gold-300 select-none">
                  {t("showSnippet")}
                </summary>
                <pre className="mt-3 rounded-lg border border-memorial-800/60 bg-memorial-900/40 p-4 text-xs text-memorial-300 overflow-x-auto">
{snippet}
                </pre>
              </details>
            </article>
          );
        })}
      </section>

      <section className="mt-16 rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-6">
        <h2 className="text-sm uppercase tracking-wider text-memorial-400 mb-3">
          {t("paramsTitle")}
        </h2>
        <table className="w-full text-sm">
          <thead className="text-xs text-memorial-500 text-start">
            <tr>
              <th className="text-start py-2 pe-4">{t("paramName")}</th>
              <th className="text-start py-2 pe-4">{t("paramValues")}</th>
              <th className="text-start py-2">{t("paramDefault")}</th>
            </tr>
          </thead>
          <tbody className="text-memorial-300">
            <tr className="border-t border-memorial-800/50">
              <td className="py-2 pe-4 font-mono text-xs">theme</td>
              <td className="py-2 pe-4 font-mono text-xs">dark | light</td>
              <td className="py-2 font-mono text-xs">dark</td>
            </tr>
            <tr className="border-t border-memorial-800/50">
              <td className="py-2 pe-4 font-mono text-xs">size</td>
              <td className="py-2 pe-4 font-mono text-xs">sm | md</td>
              <td className="py-2 font-mono text-xs">md</td>
            </tr>
            <tr className="border-t border-memorial-800/50">
              <td className="py-2 pe-4 font-mono text-xs">locale</td>
              <td className="py-2 pe-4 font-mono text-xs">en | de | fa | ar | fr | it | es</td>
              <td className="py-2 font-mono text-xs">en</td>
            </tr>
          </tbody>
        </table>
      </section>

      <p className="mt-8 text-sm text-memorial-400">
        {t("license")}{" "}
        <a
          href="https://creativecommons.org/licenses/by-sa/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold-400 hover:text-gold-300 underline underline-offset-2"
        >
          CC BY-SA 4.0
        </a>
        . {t("credit")}{" "}
        <Link href="/methodology" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
          {t("methodologyLink")}
        </Link>
      </p>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-gold-500/40 bg-gold-500/10 text-xs font-semibold text-gold-400">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
