"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ContrastToggle } from "./ContrastToggle";
import type { Locale } from "@/i18n/config";
import { useState } from "react";

export function Header({ locale }: { locale: Locale }) {
  const t = useTranslations("common");
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Primary IA: 5 surfaces. /executions, /death-row, /imprisoned, /anonymous-victims,
  // /statistics, /developers, /about, /accountability remain reachable via direct URL
  // and footer — they are status-slices of /victims or secondary surfaces, not top-level.
  const navItems = [
    { href: "/victims", label: t("victims") },
    { href: "/events", label: t("events") },
    { href: "/timeline", label: t("timeline") },
    { href: "/map", label: t("map") },
    { href: "/methodology", label: t("methodology") },
  ];

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-memorial-800 bg-memorial-950/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <span className="text-gold-500 candle-flicker text-xl">🕯</span>
            <span className="text-lg font-semibold tracking-wide text-memorial-100">
              {t("siteName")}
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive(item.href)
                    ? "text-gold-400 bg-memorial-800"
                    : "text-memorial-300 hover:text-memorial-100 hover:bg-memorial-800/50"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* Submit CTA — persistent invitation to contribute */}
            <Link
              href="/submit"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-gold-500/30 bg-gold-500/10 px-3 py-1.5 text-sm font-medium text-gold-400 hover:bg-gold-500/20 transition-colors"
            >
              <span className="text-xs">🕯</span>
              {t("submit")}
            </Link>

            <ContrastToggle locale={locale} />
            <LanguageSwitcher locale={locale} />

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-memorial-400 hover:text-memorial-100"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {menuOpen && (
          <nav className="md:hidden pb-4 border-t border-memorial-800 pt-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 text-sm rounded-md ${
                  isActive(item.href)
                    ? "text-gold-400 bg-memorial-800"
                    : "text-memorial-300 hover:text-memorial-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/submit"
              onClick={() => setMenuOpen(false)}
              className="mt-2 flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-gold-500/30 bg-gold-500/10 text-gold-400"
            >
              <span className="text-xs">🕯</span>
              {t("submit")}
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
