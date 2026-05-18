import type { Locale } from "@/i18n/config";
import { formatNumber } from "@/lib/utils";

export function HorizontalBars({
  data,
  locale,
  color,
}: {
  /** href = optional external URL; renders the label as an anchor when set. */
  data: { label: string; count: number; href?: string }[];
  locale: Locale;
  color: string;
}) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-2">
      {data.map(({ label, count, href }) => (
        <div key={label} className="flex items-center gap-3">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-memorial-300 w-36 sm:w-44 text-end flex-shrink-0 truncate hover:text-gold-400 hover:underline transition-colors"
              title={label}
            >
              {label}
            </a>
          ) : (
            <span className="text-sm text-memorial-300 w-36 sm:w-44 text-end flex-shrink-0 truncate">
              {label}
            </span>
          )}
          <div className="flex-1 h-6 bg-memorial-800/50 rounded overflow-hidden">
            <div
              className={`h-full rounded ${color}`}
              style={{ width: `${(count / maxCount) * 100}%` }}
            />
          </div>
          <span className="text-xs text-memorial-400 w-14 text-end tabular-nums flex-shrink-0">
            {formatNumber(count, locale)}
          </span>
        </div>
      ))}
    </div>
  );
}
