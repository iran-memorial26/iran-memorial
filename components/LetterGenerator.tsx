"use client";

import { useState } from "react";
import type { Locale } from "@/i18n/config";
import { SITE_URL } from "@/lib/site-url";
import { ENABLE_TWITTER_INTEGRATION } from "@/lib/features";

type CaseType = "deathRow" | "executed";

interface VictimMinimal {
  nameLatin: string;
  nameFarsi: string | null;
  causeOfDeath: string | null;
  placeOfDeath: string | null;
  ageAtDeath: number | null;
  responsibleForces: string | null;
  legalProceedings: string | null;
  slug: string;
}

interface Props {
  victim: VictimMinimal;
  locale: Locale;
  /** "deathRow" → urgent action template (life can still be saved).
   *  "executed" → memorial / accountability letter template. */
  caseType: CaseType;
}

interface CopyEntry {
  ctaButton: string;
  modalTitle: string;
  modalIntro: string;
  copyBtn: string;
  copiedBtn: string;
  emailBtn: string;
  printBtn: string;
  twitterBtn: string;
  closeBtn: string;
  langSelectLabel: string;
  letterSubject: (n: VictimMinimal) => string;
  letterBody: (n: VictimMinimal) => string;
  tweetBody: (n: VictimMinimal, url: string) => string;
}

const COPY: Record<CaseType, Record<string, CopyEntry>> = {
  deathRow: {
    de: {
      ctaButton: "Brief schreiben — jetzt",
      modalTitle: "Brief gegen die Hinrichtung",
      modalIntro:
        "Ein Brief kann ein Leben retten. Vorlage unten — kopiere, drucke oder versende sie an Amnesty, UN oder iranische Botschaften.",
      copyBtn: "Text kopieren",
      copiedBtn: "✓ Kopiert",
      emailBtn: "Per E-Mail senden",
      printBtn: "Drucken",
      twitterBtn: "Auf X teilen",
      closeBtn: "Schließen",
      langSelectLabel: "Sprache",
      letterSubject: (n) => `Stop the Execution of ${n.nameLatin}`,
      letterBody: (n) => `Sehr geehrte Damen und Herren,

ich schreibe Ihnen heute aus tiefer Sorge um das Leben von ${n.nameLatin}${n.nameFarsi ? ` (${n.nameFarsi})` : ""}, ${n.ageAtDeath ? `${n.ageAtDeath} Jahre alt, ` : ""}der/die im Iran zum Tode verurteilt wurde${n.placeOfDeath ? ` und in ${n.placeOfDeath} inhaftiert ist` : ""}.

${n.responsibleForces ? `Verantwortlich für das Urteil: ${n.responsibleForces}.` : ""}
${n.legalProceedings ? `Verfahren: ${n.legalProceedings}` : ""}

Berichte zahlreicher Menschenrechtsorganisationen — darunter Amnesty International, Iran Human Rights und HRANA — belegen, dass Verurteilungen in solchen Verfahren regelmäßig auf erzwungenen Geständnissen beruhen, ohne fairen Anwaltsbeistand zustande kommen und gegen den Internationalen Pakt über bürgerliche und politische Rechte (ICCPR) verstoßen, dem auch der Iran beigetreten ist.

Ich fordere die iranischen Behörden auf:
1. Die Hinrichtung von ${n.nameLatin} unverzüglich zu stoppen.
2. Das Urteil aufzuheben und ein faires Verfahren mit unabhängiger Verteidigung zu ermöglichen.
3. Die internationalen Menschenrechtsstandards einzuhalten.

Ich bitte Sie, diesen Fall öffentlich zu machen, alle diplomatischen und politischen Mittel auszuschöpfen, und dem iranischen Regime klarzumachen: die Welt schaut hin.

Hochachtungsvoll,
[Ihr Name]
[Stadt, Datum]

Quelle: ${SITE_URL}/de/victims/${n.slug}`,
      tweetBody: (n, url) =>
        `🕯 Stoppt die Hinrichtung von ${n.nameLatin}${n.ageAtDeath ? ` (${n.ageAtDeath})` : ""}. Im Iran zum Tode verurteilt nach unfairem Verfahren mit erzwungenen Geständnissen.\n\nIhre/seine Geschichte: ${url}\n\n#StopExecutionsInIran`,
    },
    en: {
      ctaButton: "Write a Letter — Now",
      modalTitle: "Letter to Stop the Execution",
      modalIntro:
        "A letter can save a life. Template below — copy, print, or send it to Amnesty, the UN, or Iranian embassies.",
      copyBtn: "Copy text",
      copiedBtn: "✓ Copied",
      emailBtn: "Send by email",
      printBtn: "Print",
      twitterBtn: "Share on X",
      closeBtn: "Close",
      langSelectLabel: "Language",
      letterSubject: (n) => `Stop the Execution of ${n.nameLatin}`,
      letterBody: (n) => `To whom it may concern,

I am writing to express grave concern for the life of ${n.nameLatin}${n.nameFarsi ? ` (${n.nameFarsi})` : ""}, ${n.ageAtDeath ? `${n.ageAtDeath} years old, ` : ""}who has been sentenced to death in Iran${n.placeOfDeath ? ` and is currently held in ${n.placeOfDeath}` : ""}.

${n.responsibleForces ? `Responsible authority: ${n.responsibleForces}.` : ""}
${n.legalProceedings ? `Legal proceedings: ${n.legalProceedings}` : ""}

Reports from international human rights organizations — including Amnesty International, Iran Human Rights, and HRANA — show that convictions in such cases routinely rely on forced confessions, lack independent legal representation, and violate the International Covenant on Civil and Political Rights (ICCPR) to which Iran is a state party.

I urge the Iranian authorities to:
1. Halt the execution of ${n.nameLatin} immediately.
2. Quash the sentence and provide a fair retrial with independent counsel.
3. Comply with international human rights standards.

I ask you to publicize this case, exhaust all diplomatic and political means, and make clear to the Iranian regime that the world is watching.

Sincerely,
[Your name]
[City, date]

Source: ${SITE_URL}/en/victims/${n.slug}`,
      tweetBody: (n, url) =>
        `🕯 Stop the execution of ${n.nameLatin}${n.ageAtDeath ? ` (${n.ageAtDeath})` : ""}. Sentenced to death in Iran on the basis of forced confessions and an unfair trial.\n\nTheir story: ${url}\n\n#StopExecutionsInIran`,
    },
    fa: {
      ctaButton: "نامه بنویسید — همین حالا",
      modalTitle: "نامه برای توقف اعدام",
      modalIntro:
        "یک نامه می‌تواند یک زندگی را نجات دهد. متن آماده زیر — کپی، چاپ یا برای عفو بین‌الملل، سازمان ملل یا سفارت‌های ایران ارسال کنید.",
      copyBtn: "کپی متن",
      copiedBtn: "✓ کپی شد",
      emailBtn: "ارسال با ایمیل",
      printBtn: "چاپ",
      twitterBtn: "به اشتراک در X",
      closeBtn: "بستن",
      langSelectLabel: "زبان",
      letterSubject: (n) => `توقف اعدام ${n.nameLatin}`,
      letterBody: (n) => `با سلام،

این نامه را با نگرانی عمیق درباره جان ${n.nameLatin}${n.nameFarsi ? ` (${n.nameFarsi})` : ""}${n.ageAtDeath ? ` (${n.ageAtDeath} ساله)` : ""} می‌نویسم که در ایران به اعدام محکوم شده است${n.placeOfDeath ? ` و در ${n.placeOfDeath} زندانی است` : ""}.

${n.responsibleForces ? `مرجع مسئول: ${n.responsibleForces}.` : ""}
${n.legalProceedings ? `روند قضایی: ${n.legalProceedings}` : ""}

گزارش‌های سازمان‌های بین‌المللی حقوق بشر — از جمله عفو بین‌الملل، سازمان حقوق بشر ایران و هرانا — نشان می‌دهد که محکومیت‌ها در چنین پرونده‌هایی معمولاً بر اعترافات اجباری متکی است، فاقد وکیل مستقل است و خلاف میثاق بین‌المللی حقوق مدنی و سیاسی (ICCPR) که ایران آن را امضا کرده است.

از مقامات ایرانی می‌خواهم:
۱. اعدام ${n.nameLatin} را فوراً متوقف کنند.
۲. حکم را لغو و دادگاه عادلانه با وکیل مستقل برگزار کنند.
۳. به استانداردهای بین‌المللی حقوق بشر پایبند باشند.

از شما می‌خواهم این پرونده را منتشر کنید، از تمام ابزارهای دیپلماتیک و سیاسی استفاده کنید و به جمهوری اسلامی نشان دهید که جهان نظاره‌گر است.

با احترام،
[نام شما]
[شهر، تاریخ]

منبع: ${SITE_URL}/fa/victims/${n.slug}`,
      tweetBody: (n, url) =>
        `🕯 اعدام ${n.nameLatin}${n.ageAtDeath ? ` (${n.ageAtDeath})` : ""} را متوقف کنید. در ایران بر اساس اعتراف اجباری به اعدام محکوم شد.\n\nداستان: ${url}\n\n#StopExecutionsInIran`,
    },
  },
  executed: {
    de: {
      ctaButton: "Stimme erheben",
      modalTitle: "Erinnerungsbrief & Forderung nach Rechenschaft",
      modalIntro:
        "Diese Person wurde bereits hingerichtet. Aber ihr Name darf nicht vergessen werden. Vorlage für Briefe an Behörden, internationale Gremien oder eigene Veröffentlichung.",
      copyBtn: "Text kopieren",
      copiedBtn: "✓ Kopiert",
      emailBtn: "Per E-Mail senden",
      printBtn: "Drucken",
      twitterBtn: "Auf X teilen",
      closeBtn: "Schließen",
      langSelectLabel: "Sprache",
      letterSubject: (n) => `Hinrichtung von ${n.nameLatin} — Forderung nach Rechenschaft`,
      letterBody: (n) => `Sehr geehrte Damen und Herren,

mit diesem Schreiben gedenke ich ${n.nameLatin}${n.nameFarsi ? ` (${n.nameFarsi})` : ""}${n.ageAtDeath ? `, ${n.ageAtDeath} Jahre alt,` : ""} der/die durch das iranische Regime hingerichtet wurde${n.placeOfDeath ? ` (${n.placeOfDeath})` : ""}.

${n.responsibleForces ? `Verantwortlich: ${n.responsibleForces}.` : ""}
${n.legalProceedings ? `Verfahren: ${n.legalProceedings}` : ""}

Diese Hinrichtung war ein unrechtmäßiger Akt staatlicher Gewalt — auf Grundlage erzwungener Geständnisse, ohne unabhängige Verteidigung, im Widerspruch zum Internationalen Pakt über bürgerliche und politische Rechte (ICCPR).

Ich fordere:
1. Die internationale Gemeinschaft, diesen Fall zu dokumentieren und das iranische Regime zur Rechenschaft zu ziehen.
2. Die zuständigen Richter und Funktionäre auf internationale Sanktionslisten zu setzen (z. B. EU Global Human Rights Sanctions Regime).
3. Den Stopp aller weiteren politisch motivierten Hinrichtungen im Iran.

${n.nameLatin} darf nicht vergessen werden.

Hochachtungsvoll,
[Ihr Name]
[Stadt, Datum]

Quelle: ${SITE_URL}/de/victims/${n.slug}`,
      tweetBody: (n, url) =>
        `🕯 ${n.nameLatin}${n.ageAtDeath ? ` (${n.ageAtDeath})` : ""} wurde vom iranischen Regime hingerichtet. Wir vergessen nicht.\n\nIhre/seine Geschichte: ${url}\n\n#IranExecutes #StopExecutionsInIran`,
    },
    en: {
      ctaButton: "Raise Your Voice",
      modalTitle: "Memorial Letter & Demand for Accountability",
      modalIntro:
        "This person has already been executed. Their name must not be forgotten. Template for letters to authorities, international bodies, or your own publication.",
      copyBtn: "Copy text",
      copiedBtn: "✓ Copied",
      emailBtn: "Send by email",
      printBtn: "Print",
      twitterBtn: "Share on X",
      closeBtn: "Close",
      langSelectLabel: "Language",
      letterSubject: (n) => `Execution of ${n.nameLatin} — Demand for Accountability`,
      letterBody: (n) => `To whom it may concern,

I write in memory of ${n.nameLatin}${n.nameFarsi ? ` (${n.nameFarsi})` : ""}${n.ageAtDeath ? `, ${n.ageAtDeath} years old,` : ""} who was executed by the Islamic Republic of Iran${n.placeOfDeath ? ` (${n.placeOfDeath})` : ""}.

${n.responsibleForces ? `Responsible authority: ${n.responsibleForces}.` : ""}
${n.legalProceedings ? `Legal proceedings: ${n.legalProceedings}` : ""}

This execution was an unlawful act of state violence — based on forced confessions, without independent defense counsel, in violation of the International Covenant on Civil and Political Rights (ICCPR).

I demand:
1. The international community must document this case and hold the Iranian regime accountable.
2. The responsible judges and officials must be placed on international sanctions lists (e.g. EU Global Human Rights Sanctions Regime).
3. An immediate halt to further politically motivated executions in Iran.

${n.nameLatin} must not be forgotten.

Sincerely,
[Your name]
[City, date]

Source: ${SITE_URL}/en/victims/${n.slug}`,
      tweetBody: (n, url) =>
        `🕯 ${n.nameLatin}${n.ageAtDeath ? ` (${n.ageAtDeath})` : ""} was executed by the Iranian regime. We do not forget.\n\nTheir story: ${url}\n\n#IranExecutes #StopExecutionsInIran`,
    },
    fa: {
      ctaButton: "صدای خود را بلند کنید",
      modalTitle: "نامه یادبود و درخواست پاسخگویی",
      modalIntro:
        "این شخص اعدام شده است. نام او نباید فراموش شود. متن آماده برای نامه به مقامات، نهادهای بین‌المللی یا انتشار شخصی.",
      copyBtn: "کپی متن",
      copiedBtn: "✓ کپی شد",
      emailBtn: "ارسال با ایمیل",
      printBtn: "چاپ",
      twitterBtn: "به اشتراک در X",
      closeBtn: "بستن",
      langSelectLabel: "زبان",
      letterSubject: (n) => `اعدام ${n.nameLatin} — درخواست پاسخگویی`,
      letterBody: (n) => `با سلام،

این نامه را به یاد ${n.nameLatin}${n.nameFarsi ? ` (${n.nameFarsi})` : ""}${n.ageAtDeath ? ` (${n.ageAtDeath} ساله)` : ""} می‌نویسم که توسط جمهوری اسلامی ایران اعدام شد${n.placeOfDeath ? ` (${n.placeOfDeath})` : ""}.

${n.responsibleForces ? `مرجع مسئول: ${n.responsibleForces}.` : ""}
${n.legalProceedings ? `روند قضایی: ${n.legalProceedings}` : ""}

این اعدام عملی غیرقانونی از خشونت دولتی بود — بر اساس اعترافات اجباری، بدون وکیل مستقل، خلاف میثاق بین‌المللی حقوق مدنی و سیاسی (ICCPR).

من می‌خواهم:
۱. جامعه بین‌المللی این پرونده را مستند کند و جمهوری اسلامی را پاسخگو سازد.
۲. قضات و مسئولان مربوطه به فهرست‌های تحریم بین‌المللی اضافه شوند (مانند رژیم تحریم‌های جهانی حقوق بشر اتحادیه اروپا).
۳. توقف فوری همه اعدام‌های سیاسی در ایران.

نام ${n.nameLatin} را فراموش نخواهیم کرد.

با احترام،
[نام شما]
[شهر، تاریخ]

منبع: ${SITE_URL}/fa/victims/${n.slug}`,
      tweetBody: (n, url) =>
        `🕯 ${n.nameLatin}${n.ageAtDeath ? ` (${n.ageAtDeath})` : ""} توسط رژیم ایران اعدام شد. فراموش نمی‌کنیم.\n\nداستان: ${url}\n\n#IranExecutes #StopExecutionsInIran`,
    },
  },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function LetterGenerator({ victim, locale, caseType }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [letterLang, setLetterLang] = useState<string>(
    locale === "fa" ? "fa" : locale === "de" ? "de" : "en",
  );

  const copyTable = COPY[caseType];
  const ui = copyTable[locale] || copyTable.en;
  const letterCopy = copyTable[letterLang] || copyTable.en;
  const subject = letterCopy.letterSubject(victim);
  const body = letterCopy.letterBody(victim);
  const profileUrl = `${SITE_URL}/${locale}/victims/${victim.slug}`;
  const tweet = letterCopy.tweetBody(victim, profileUrl);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  // Print via Blob URL — safer than document.write (no live HTML injection
  // path; the browser renders the static blob document directly).
  const handlePrint = () => {
    const dir = letterLang === "fa" || letterLang === "ar" ? "rtl" : "ltr";
    const html = `<!DOCTYPE html><html dir="${dir}" lang="${letterLang}"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title><style>body{font-family:Georgia,serif;padding:48px;line-height:1.6;max-width:680px;color:#111;background:#fff;white-space:pre-wrap;}h1{font-size:18px;margin:0 0 24px;}</style></head><body><h1>${escapeHtml(subject)}</h1>${escapeHtml(body)}<script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const mailtoHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;

  if (!open) {
    const cls =
      caseType === "deathRow"
        ? "border-blood-400/40 bg-blood-400/15 text-blood-200 hover:bg-blood-400/25"
        : "border-gold-500/40 bg-gold-500/10 text-gold-300 hover:bg-gold-500/20";
    return (
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border ${cls} text-sm font-medium transition-colors`}
        type="button"
      >
        ✉️ {ui.ctaButton}
      </button>
    );
  }

  const dir = letterLang === "fa" || letterLang === "ar" ? "rtl" : "ltr";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-memorial-950/80 backdrop-blur-sm p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative max-w-3xl w-full max-h-[90vh] overflow-y-auto rounded-xl border border-memorial-700 bg-memorial-900 p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-2">
          <h2 className="text-xl font-bold text-memorial-100">{ui.modalTitle}</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-memorial-500 hover:text-memorial-200 text-2xl leading-none -mt-1"
            aria-label={ui.closeBtn}
            type="button"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-memorial-400 mb-4">{ui.modalIntro}</p>

        <div className="flex items-center gap-3 mb-4 text-xs">
          <span className="text-memorial-500">{ui.langSelectLabel}:</span>
          {["de", "en", "fa"].map((l) => (
            <button
              key={l}
              onClick={() => setLetterLang(l)}
              className={`px-2.5 py-1 rounded-md border text-xs ${
                letterLang === l
                  ? "border-gold-500/40 bg-gold-500/15 text-gold-300"
                  : "border-memorial-700 text-memorial-400 hover:bg-memorial-800"
              }`}
              type="button"
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <div
          className="rounded-lg border border-memorial-700 bg-memorial-950 p-4 mb-4 max-h-72 overflow-y-auto"
          dir={dir}
        >
          <div className="text-xs text-memorial-500 mb-2 font-mono">Subject: {subject}</div>
          <pre className="text-sm text-memorial-200 whitespace-pre-wrap font-sans leading-relaxed">{body}</pre>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gold-500/30 bg-gold-500/10 text-gold-300 text-sm hover:bg-gold-500/20 transition-colors"
            type="button"
          >
            {copied ? ui.copiedBtn : ui.copyBtn}
          </button>
          <a
            href={mailtoHref}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-memorial-700 text-memorial-300 text-sm hover:bg-memorial-800 transition-colors"
          >
            ✉️ {ui.emailBtn}
          </a>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-memorial-700 text-memorial-300 text-sm hover:bg-memorial-800 transition-colors"
            type="button"
          >
            🖨 {ui.printBtn}
          </button>
          {ENABLE_TWITTER_INTEGRATION && (
            <a
              href={tweetHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-memorial-700 text-memorial-300 text-sm hover:bg-memorial-800 transition-colors"
            >
              𝕏 {ui.twitterBtn}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
