"use client";

import type { Locale } from "@/i18n/config";
import { ENABLE_TWITTER_INTEGRATION } from "@/lib/features";

export function ShareButtons({ url, name, locale }: { url: string; name: string; locale: Locale }) {
  const tweetText = locale === "de" ? `Gedenkseite für ${name}` : locale === "fa" ? `صفحه یادبود ${name}` : `Memorial page for ${name}`;

  return (
    <div className="flex items-center gap-3 mt-6 mb-8 pt-4 border-t border-memorial-800">
      <span className="text-xs text-memorial-500">
        {locale === "de" ? "Teilen:" : locale === "fa" ? "اشتراک‌گذاری:" : "Share:"}
      </span>
      <button
        onClick={() => {
          navigator.clipboard.writeText(url);
        }}
        className="text-xs text-memorial-400 hover:text-memorial-200 border border-memorial-700 hover:border-memorial-500 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
      >
        {locale === "de" ? "Link kopieren" : locale === "fa" ? "کپی لینک" : "Copy link"}
      </button>
      {ENABLE_TWITTER_INTEGRATION && (
        <a
          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(tweetText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-memorial-400 hover:text-memorial-200 border border-memorial-700 hover:border-memorial-500 px-3 py-1.5 rounded-md transition-colors"
        >
          X / Twitter
        </a>
      )}
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-memorial-400 hover:text-memorial-200 border border-memorial-700 hover:border-memorial-500 px-3 py-1.5 rounded-md transition-colors"
      >
        Facebook
      </a>
    </div>
  );
}
