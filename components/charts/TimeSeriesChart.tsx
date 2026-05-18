"use client";

import { formatNumber } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

type DataPoint = { date: string; count: number };

type Props = {
  data: DataPoint[];
  locale: Locale;
  color?: string;
};

export function TimeSeriesChart({ data, locale, color = "bg-gold-500" }: Props) {
  if (data.length === 0) {
    return <p className="text-memorial-400 text-sm">No data available</p>;
  }

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <div className="space-y-2">
      {/* Chart Area */}
      <div className="relative h-64 flex items-end gap-1">
        {data.map((point) => {
          const heightPercent = maxCount > 0 ? (point.count / maxCount) * 100 : 0;
          return (
            <div key={point.date} className="flex-1 group relative" style={{ height: "100%" }}>
              {/* Bar */}
              <div
                className={`${color} rounded-t transition-all hover:opacity-80 relative`}
                style={{ height: `${heightPercent}%` }}
              >
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-memorial-800 px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none z-10">
                  <div className="font-medium">{point.date}</div>
                  <div className="text-memorial-300">
                    {formatNumber(point.count, locale)} requests
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* X-Axis Labels */}
      <div className="flex justify-between text-xs text-memorial-400">
        <span>{data[0]?.date}</span>
        <span>{data[Math.floor(data.length / 2)]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}
