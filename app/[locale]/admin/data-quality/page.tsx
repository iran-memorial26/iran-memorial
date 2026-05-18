"use client";

import { useState, useEffect, useCallback } from "react";
import { Link } from "@/i18n/navigation";

// ─── Types ──────────────────────────────────────────────────────────────────

type FieldStats = { field: string; missing: number; total: number; pct: number };
type CachedDuplicate = {
  id: string;
  slug1: string;
  name1: string;
  slug2: string;
  name2: string;
  similarity: number;
  status: string;
  scannedAt: string;
};
type QualityData = {
  total: number;
  fieldStats: FieldStats[];
  verificationBreakdown: { status: string; count: number }[];
  byDataSource: { source: string; count: number; verified: number }[];
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DataQualityPage() {
  const [data, setData] = useState<QualityData | null>(null);
  const [duplicates, setDuplicates] = useState<CachedDuplicate[]>([]);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch main quality data
  useEffect(() => {
    fetch("/api/admin/data-quality")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  // Fetch cached duplicates
  const loadDuplicates = useCallback(() => {
    fetch("/api/admin/duplicate-scan")
      .then((r) => r.json())
      .then((d) => {
        setDuplicates(d.candidates || []);
        setLastScanned(d.lastScanned);
      });
  }, []);

  useEffect(() => {
    loadDuplicates();
  }, [loadDuplicates]);

  const runScan = async () => {
    setScanning(true);
    setScanMessage(null);
    try {
      const res = await fetch("/api/admin/duplicate-scan", { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        setScanMessage(`Scan complete — found ${d.found} pairs`);
        loadDuplicates();
      } else {
        setScanMessage(`Error: ${d.error}`);
      }
    } catch {
      setScanMessage("Network error");
    } finally {
      setScanning(false);
    }
  };

  const dismiss = async (id: string) => {
    await fetch("/api/admin/duplicate-scan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "dismissed" }),
    });
    setDuplicates((prev) => prev.filter((d) => d.id !== id));
  };

  const confirm = async (id: string) => {
    await fetch("/api/admin/duplicate-scan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "confirmed" }),
    });
    setDuplicates((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "confirmed" } : d))
    );
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-memorial-950 text-memorial-100 p-6 flex items-center justify-center">
        <p className="text-memorial-400 animate-pulse">Loading data quality stats…</p>
      </div>
    );
  }

  const { total, fieldStats, verificationBreakdown, byDataSource } = data;
  const verified = verificationBreakdown.find((v) => v.status === "verified")?.count ?? 0;
  const withPhoto = total - (fieldStats.find((f) => f.field === "photo_url")?.missing ?? total);
  const withDate = total - (fieldStats.find((f) => f.field === "date_of_death")?.missing ?? total);
  const withCircumstances =
    total - (fieldStats.find((f) => f.field === "circumstances_en")?.missing ?? total);

  const pendingDuplicates = duplicates.filter((d) => d.status !== "dismissed");
  const confirmedCount = duplicates.filter((d) => d.status === "confirmed").length;

  return (
    <div className="min-h-screen bg-memorial-950 text-memorial-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Data Quality</h1>
            <p className="text-memorial-400 mt-1">{total.toLocaleString()} total victims</p>
          </div>
          <Link href="/admin" className="text-sm text-memorial-400 hover:text-memorial-200">
            ← Back to Admin
          </Link>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <StatCard
            value={`${Math.round((verified / total) * 100)}%`}
            label="Verified"
            sub={`${verified.toLocaleString()} records`}
            color="text-green-400"
          />
          <StatCard
            value={`${Math.round((withPhoto / total) * 100)}%`}
            label="With Photo"
            sub={`${withPhoto.toLocaleString()} records`}
            color="text-blue-400"
          />
          <StatCard
            value={`${Math.round((withDate / total) * 100)}%`}
            label="With Date of Death"
            sub={`${withDate.toLocaleString()} records`}
            color="text-gold-400"
          />
          <StatCard
            value={`${Math.round((withCircumstances / total) * 100)}%`}
            label="With Circumstances"
            sub={`${withCircumstances.toLocaleString()} records`}
            color="text-purple-400"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* Missing Fields */}
          <section className="bg-memorial-900/50 rounded-xl border border-memorial-800 p-6">
            <h2 className="text-lg font-semibold mb-5">Missing Fields</h2>
            <div className="space-y-3">
              {fieldStats.map((f) => (
                <div key={f.field}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-memorial-300 font-mono">{f.field}</span>
                    <span className="text-memorial-400">
                      {f.missing.toLocaleString()} missing ({f.pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-memorial-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500/60 rounded-full transition-all"
                      style={{ width: `${f.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Verification Breakdown + Data Sources */}
          <div className="space-y-6">
            <section className="bg-memorial-900/50 rounded-xl border border-memorial-800 p-6">
              <h2 className="text-lg font-semibold mb-4">Verification Status</h2>
              <div className="space-y-2">
                {verificationBreakdown.map((v) => {
                  const pct = Math.round((v.count / total) * 100);
                  const color =
                    v.status === "verified"
                      ? "bg-green-500/60"
                      : v.status === "disputed"
                      ? "bg-yellow-500/60"
                      : "bg-memorial-600";
                  return (
                    <div key={v.status}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize text-memorial-300">{v.status}</span>
                        <span className="text-memorial-400">
                          {v.count.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-memorial-800 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-memorial-900/50 rounded-xl border border-memorial-800 p-6">
              <h2 className="text-lg font-semibold mb-4">Top Data Sources</h2>
              <div className="space-y-1.5">
                {byDataSource.slice(0, 8).map((s) => (
                  <div key={s.source} className="flex justify-between text-sm">
                    <span className="text-memorial-300 font-mono truncate max-w-[200px]">
                      {s.source || "unknown"}
                    </span>
                    <span className="text-memorial-400 ml-2 shrink-0">
                      {s.count.toLocaleString()}
                      {s.verified > 0 && (
                        <span className="text-green-400 ml-1">({s.verified} ✓)</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Potential Duplicates */}
        <section className="bg-memorial-900/50 rounded-xl border border-memorial-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Potential Duplicates
              <span className="ml-2 text-sm font-normal text-memorial-400">
                ({pendingDuplicates.length} pairs
                {confirmedCount > 0 && `, ${confirmedCount} confirmed`})
              </span>
            </h2>
            <div className="flex items-center gap-3">
              {lastScanned && (
                <span className="text-xs text-memorial-500">
                  Last scan: {new Date(lastScanned).toLocaleString()}
                </span>
              )}
              <button
                onClick={runScan}
                disabled={scanning}
                className="px-3 py-1.5 text-sm bg-memorial-800 hover:bg-memorial-700 border border-memorial-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scanning ? "Scanning… (may take ~1 min)" : "Run Scan"}
              </button>
            </div>
          </div>

          {scanMessage && (
            <p className={`text-sm mb-4 ${scanMessage.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
              {scanMessage}
            </p>
          )}

          {pendingDuplicates.length === 0 ? (
            <p className="text-memorial-400 text-sm">
              {lastScanned
                ? "No potential duplicates found. Run scan to refresh."
                : "No scan run yet. Click 'Run Scan' to detect potential duplicates."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-memorial-800">
                    <th className="pb-2 text-memorial-400 font-medium">Victim A</th>
                    <th className="pb-2 text-memorial-400 font-medium">Victim B</th>
                    <th className="pb-2 text-memorial-400 font-medium text-right">Similarity</th>
                    <th className="pb-2 text-memorial-400 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDuplicates.map((d) => (
                    <tr
                      key={d.id}
                      className={`border-b border-memorial-800/50 hover:bg-memorial-800/20 ${
                        d.status === "confirmed" ? "bg-yellow-900/10" : ""
                      }`}
                    >
                      <td className="py-2 pr-4">
                        <Link
                          href={`/victims/${d.slug1}`}
                          className="text-gold-400 hover:text-gold-300"
                          target="_blank"
                        >
                          {d.name1}
                        </Link>
                        <span className="text-memorial-500 text-xs ml-2 font-mono">{d.slug1}</span>
                      </td>
                      <td className="py-2 pr-4">
                        <Link
                          href={`/victims/${d.slug2}`}
                          className="text-gold-400 hover:text-gold-300"
                          target="_blank"
                        >
                          {d.name2}
                        </Link>
                        <span className="text-memorial-500 text-xs ml-2 font-mono">{d.slug2}</span>
                      </td>
                      <td className="py-2 text-right">
                        <span
                          className={`font-mono font-semibold ${
                            d.similarity > 0.95
                              ? "text-red-400"
                              : d.similarity > 0.9
                              ? "text-yellow-400"
                              : "text-memorial-300"
                          }`}
                        >
                          {(d.similarity * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {d.status === "confirmed" ? (
                            <span className="text-xs text-yellow-400 font-medium">⚠ Confirmed</span>
                          ) : (
                            <button
                              onClick={() => confirm(d.id)}
                              className="text-xs text-yellow-400 hover:text-yellow-300 underline"
                            >
                              Confirm
                            </button>
                          )}
                          <Link
                            href={`/admin/victims/${d.slug1}/edit`}
                            className="text-xs text-blue-400 hover:text-blue-300 underline"
                          >
                            Edit A
                          </Link>
                          <button
                            onClick={() => dismiss(d.id)}
                            className="text-xs text-memorial-500 hover:text-memorial-300 underline"
                          >
                            Dismiss
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  value,
  label,
  sub,
  color = "text-gold-400",
}: {
  value: string;
  label: string;
  sub: string;
  color?: string;
}) {
  return (
    <div className="bg-memorial-900/50 rounded-xl border border-memorial-800 p-5">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm font-medium text-memorial-200 mt-1">{label}</div>
      <div className="text-xs text-memorial-500 mt-0.5">{sub}</div>
    </div>
  );
}
