"use client";

import { useEffect, useState } from "react";

/**
 * A11y toggle that boosts text/border contrast site-wide and removes the
 * decorative gradients + low-opacity overlays that make the memorial dark
 * theme hard to read for older relatives, screen-glare users, and people
 * with reduced visual acuity.
 *
 * Implementation:
 *   - Persists choice in localStorage["contrast"] = "high" | "default"
 *   - Sets data-contrast="high" on <html> when active
 *   - CSS rules in globals.css scope all overrides under
 *     `:root[data-contrast="high"] ...`
 *   - SSR-safe: initial state is "default" so server + first client paint
 *     match. localStorage hydrates after mount; an FOUC of a few ms is
 *     acceptable on a memorial site (better than rendering wrong contrast
 *     on first paint for someone who relies on it).
 */

const LABELS: Record<string, { on: string; off: string; aria: string }> = {
  en: { on: "High contrast", off: "Default contrast", aria: "Toggle high-contrast mode" },
  de: { on: "Hoher Kontrast", off: "Standard-Kontrast", aria: "Hoher Kontrast umschalten" },
  fa: { on: "کنتراست بالا", off: "کنتراست پیش‌فرض", aria: "تغییر حالت کنتراست بالا" },
  ar: { on: "تباين عالٍ", off: "التباين الافتراضي", aria: "تبديل وضع التباين العالي" },
  fr: { on: "Contraste élevé", off: "Contraste par défaut", aria: "Basculer le mode contraste élevé" },
  it: { on: "Contrasto alto", off: "Contrasto predefinito", aria: "Attiva/disattiva contrasto alto" },
  es: { on: "Alto contraste", off: "Contraste predeterminado", aria: "Alternar modo de alto contraste" },
  he: { on: "ניגודיות גבוהה", off: "ניגודיות ברירת מחדל", aria: "החלף מצב ניגודיות גבוהה" },
  ru: { on: "Высокий контраст", off: "Обычный контраст", aria: "Переключить высокий контраст" },
  tr: { on: "Yüksek kontrast", off: "Varsayılan kontrast", aria: "Yüksek kontrast modunu değiştir" },
  ckb: { on: "کۆنترستی بەرز", off: "کۆنترستی بنەڕەت", aria: "گۆڕینی کۆنترستی بەرز" },
  hi: { on: "उच्च कंट्रास्ट", off: "डिफ़ॉल्ट कंट्रास्ट", aria: "उच्च कंट्रास्ट टॉगल करें" },
  ur: { on: "اعلیٰ کنٹراسٹ", off: "ڈیفالٹ کنٹراسٹ", aria: "اعلیٰ کنٹراسٹ موڈ ٹوگل کریں" },
  sv: { on: "Hög kontrast", off: "Standardkontrast", aria: "Växla högkontrastläge" },
  nl: { on: "Hoog contrast", off: "Standaard contrast", aria: "Hoog contrast omschakelen" },
  zh: { on: "高对比度", off: "默认对比度", aria: "切换高对比度模式" },
};

export function ContrastToggle({ locale }: { locale: string }) {
  const [high, setHigh] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Defensive read: localStorage can throw under "Block all cookies"
    // browser settings, in jsdom-less test environments, and in some
    // iOS private-browsing modes. Silent fallback to default contrast.
    try {
      const saved =
        typeof window !== "undefined" && window.localStorage
          ? window.localStorage.getItem("contrast")
          : null;
      if (saved === "high") {
        setHigh(true);
        document.documentElement.setAttribute("data-contrast", "high");
      }
    } catch {
      /* localStorage unavailable — render in default contrast */
    }
  }, []);

  function toggle() {
    const next = !high;
    setHigh(next);
    if (next) {
      document.documentElement.setAttribute("data-contrast", "high");
    } else {
      document.documentElement.removeAttribute("data-contrast");
    }
    try {
      window.localStorage?.setItem("contrast", next ? "high" : "default");
    } catch {
      /* localStorage unavailable — toggle still works for the session */
    }
  }

  const labels = LABELS[locale] || LABELS.en;

  // Avoid SSR/client text mismatch: render a neutral placeholder until
  // localStorage has been read.
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label={labels.aria}
        className="text-memorial-500 hover:text-memorial-200 transition-colors p-1.5"
        title={labels.aria}
      >
        <ContrastIcon active={false} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={high}
      aria-label={labels.aria}
      className={`transition-colors p-1.5 ${high ? "text-gold-400" : "text-memorial-500 hover:text-memorial-200"}`}
      title={high ? labels.on : labels.off}
    >
      <ContrastIcon active={high} />
    </button>
  );
}

function ContrastIcon({ active }: { active: boolean }) {
  // Standard "half-filled circle" contrast glyph — universally read as
  // "contrast / appearance" by users of OS-level accessibility tools.
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3 V21 A9 9 0 0 0 12 3 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
