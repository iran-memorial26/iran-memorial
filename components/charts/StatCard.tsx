export function StatCard({
  value,
  label,
  highlight,
}: {
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-4 sm:p-6 text-center">
      <div
        className={`text-2xl sm:text-3xl font-bold tabular-nums ${
          highlight ? "text-gold-400" : "text-memorial-100"
        }`}
      >
        {value}
      </div>
      <div className="text-xs sm:text-sm text-memorial-500 mt-1">{label}</div>
    </div>
  );
}
