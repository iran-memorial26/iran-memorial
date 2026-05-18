"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, localeAbbreviations, localeNames, type Locale } from "@/i18n/config";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();

  function handleLocaleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newLocale = e.target.value as Locale;
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <select
      value={locale}
      onChange={handleLocaleChange}
      className="bg-memorial-800 text-memorial-100 border border-memorial-700 rounded px-2 py-1.5 text-sm font-medium tracking-wide hover:bg-memorial-700 focus:outline-none focus:ring-2 focus:ring-gold-500 transition-colors cursor-pointer"
      aria-label="Select language"
    >
      {locales.map((l) => (
        // title gives the native language name on hover for clarity; the
        // visible label stays a compact 2-letter ISO 639-1 code.
        <option key={l} value={l} title={localeNames[l]}>
          {localeAbbreviations[l]}
        </option>
      ))}
    </select>
  );
}
