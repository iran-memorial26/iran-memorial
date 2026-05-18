import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/config";

export function Footer({ locale }: { locale: Locale }) {
  const t = useTranslations("footer");
  const tc = useTranslations("common");

  return (
    <footer className="border-t border-memorial-800 bg-memorial-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-12">
        {/* Navigation Grid — 4 columns on lg: Browse, By Status, Trust, Contribute. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8 mb-10">
          {/* Browse */}
          <div>
            <h3 className="text-xs font-semibold text-memorial-400 uppercase tracking-wider mb-3">
              {t("browse")}
            </h3>
            <ul className="space-y-2">
              {[
                { href: "/victims", label: tc("victims") },
                { href: "/events", label: tc("events") },
                { href: "/timeline", label: tc("timeline") },
                { href: "/map", label: tc("map") },
                { href: "/statistics", label: tc("statistics") },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-memorial-500 hover:text-memorial-200 transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* By Status — slices of /victims with dedicated curation */}
          <div>
            <h3 className="text-xs font-semibold text-memorial-400 uppercase tracking-wider mb-3">
              {tc("victims")}
            </h3>
            <ul className="space-y-2">
              {[
                { href: "/executions", label: tc("executions") },
                { href: "/imprisoned", label: tc("imprisoned") },
                { href: "/death-row", label: tc("deathRow") },
                { href: "/anonymous-victims", label: tc("anonymousVictims") },
                { href: "/accountability", label: tc("accountability") },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-memorial-500 hover:text-memorial-200 transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Trust & Transparency */}
          <div>
            <h3 className="text-xs font-semibold text-memorial-400 uppercase tracking-wider mb-3">
              {tc("methodology")}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/methodology" className="text-sm text-memorial-500 hover:text-memorial-200 transition-colors">
                  {tc("methodology")}
                </Link>
              </li>
              <li>
                <Link href="/sources" className="text-sm text-memorial-500 hover:text-memorial-200 transition-colors">
                  {tc("sources")}
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-sm text-memorial-500 hover:text-memorial-200 transition-colors">
                  {tc("about")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contribute */}
          <div>
            <h3 className="text-xs font-semibold text-memorial-400 uppercase tracking-wider mb-3">
              {t("contribute")}
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/submit" className="text-sm text-memorial-500 hover:text-memorial-200 transition-colors">
                  {tc("submit")}
                </Link>
              </li>
              <li>
                <Link href="/developers" className="text-sm text-memorial-500 hover:text-memorial-200 transition-colors">
                  {tc("developers")}
                </Link>
              </li>
              <li>
                <Link href="/embed-preview" className="text-sm text-memorial-500 hover:text-memorial-200 transition-colors">
                  {tc("embed")}
                </Link>
              </li>
              <li>
                <a
                  href="/feed.xml"
                  className="text-sm text-memorial-500 hover:text-memorial-200 transition-colors inline-flex items-center gap-1"
                >
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor" aria-hidden>
                    <path d="M4 4v3a13 13 0 0 1 13 13h3A16 16 0 0 0 4 4zm0 6v3a7 7 0 0 1 7 7h3a10 10 0 0 0-10-10zm2 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                  </svg>
                  RSS
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/iran-memorial26/iran-memorial"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-memorial-500 hover:text-memorial-200 transition-colors"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Remembrance line — full width above bottom rule */}
        <div className="mb-8 text-center">
          <span className="text-3xl candle-flicker">🕯</span>
          <p className="text-sm text-memorial-400 italic mt-2">
            {t("remembrance")}
          </p>
        </div>

        {/* Bottom line */}
        <div className="border-t border-memorial-800/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-memorial-600">
          <span>{t("copyright")}</span>
          <span>{t("madeWith")}</span>
        </div>
      </div>
    </footer>
  );
}
