"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";

type VictimForm = {
  nameLatin: string;
  nameFarsi: string;
  causeOfDeath: string;
  placeOfDeath: string;
  ageAtDeath: string;
  dateOfDeath: string;
  dateOfBirth: string;
  verificationStatus: string;
  circumstancesEn: string;
  circumstancesFa: string;
  dataSource: string;
  notes: string;
};

const EMPTY_FORM: VictimForm = {
  nameLatin: "",
  nameFarsi: "",
  causeOfDeath: "",
  placeOfDeath: "",
  ageAtDeath: "",
  dateOfDeath: "",
  dateOfBirth: "",
  verificationStatus: "unverified",
  circumstancesEn: "",
  circumstancesFa: "",
  dataSource: "",
  notes: "",
};

function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

export default function VictimEditPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const locale = params.locale as string;

  const [form, setForm] = useState<VictimForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch(`/api/admin/victims?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then(({ victim }) => {
        if (victim) {
          setForm({
            nameLatin: victim.nameLatin ?? "",
            nameFarsi: victim.nameFarsi ?? "",
            causeOfDeath: victim.causeOfDeath ?? "",
            placeOfDeath: victim.placeOfDeath ?? "",
            ageAtDeath: victim.ageAtDeath != null ? String(victim.ageAtDeath) : "",
            dateOfDeath: formatDate(victim.dateOfDeath),
            dateOfBirth: formatDate(victim.dateOfBirth),
            verificationStatus: victim.verificationStatus ?? "unverified",
            circumstancesEn: victim.circumstancesEn ?? "",
            circumstancesFa: victim.circumstancesFa ?? "",
            dataSource: victim.dataSource ?? "",
            notes: victim.notes ?? "",
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const payload: Record<string, unknown> = {
      slug,
      nameLatin: form.nameLatin || undefined,
      nameFarsi: form.nameFarsi || null,
      causeOfDeath: form.causeOfDeath || null,
      placeOfDeath: form.placeOfDeath || null,
      ageAtDeath: form.ageAtDeath ? parseInt(form.ageAtDeath, 10) : null,
      dateOfDeath: form.dateOfDeath || null,
      dateOfBirth: form.dateOfBirth || null,
      verificationStatus: form.verificationStatus,
      circumstancesEn: form.circumstancesEn || null,
      circumstancesFa: form.circumstancesFa || null,
      dataSource: form.dataSource || null,
      notes: form.notes || null,
    };

    try {
      const res = await fetch("/api/admin/victims", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Saved successfully" });
      } else {
        setMessage({ type: "error", text: data.error ?? "Save failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-memorial-950 text-memorial-100 p-8 flex items-center justify-center">
        <p className="text-memorial-400 animate-pulse">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-memorial-950 text-memorial-100 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Edit Victim</h1>
            <p className="text-memorial-400 mt-1 font-mono text-sm">{slug}</p>
          </div>
          <div className="flex gap-3">
            <Link
              href={`/victims/${slug}`}
              target="_blank"
              className="text-sm text-gold-400 hover:text-gold-300"
            >
              View →
            </Link>
            <Link
              href="/admin/data-quality"
              className="text-sm text-memorial-400 hover:text-memorial-200"
            >
              ← Data Quality
            </Link>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-900/30 border border-green-700 text-green-300"
                : "bg-red-900/30 border border-red-700 text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identity */}
          <section className="bg-memorial-900/50 rounded-xl border border-memorial-800 p-6">
            <h2 className="text-base font-semibold mb-4 text-memorial-300">Identity</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name (Latin)" name="nameLatin" value={form.nameLatin} onChange={handleChange} required />
              <Field label="Name (Farsi)" name="nameFarsi" value={form.nameFarsi} onChange={handleChange} dir="rtl" />
            </div>
          </section>

          {/* Death */}
          <section className="bg-memorial-900/50 rounded-xl border border-memorial-800 p-6">
            <h2 className="text-base font-semibold mb-4 text-memorial-300">Death</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Date of Birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} />
              <Field label="Date of Death" name="dateOfDeath" type="date" value={form.dateOfDeath} onChange={handleChange} />
              <Field label="Age at Death" name="ageAtDeath" type="number" value={form.ageAtDeath} onChange={handleChange} min={0} max={150} />
              <Field label="Place of Death" name="placeOfDeath" value={form.placeOfDeath} onChange={handleChange} />
              <div className="sm:col-span-2">
                <Field label="Cause of Death" name="causeOfDeath" value={form.causeOfDeath} onChange={handleChange} />
              </div>
            </div>
          </section>

          {/* Circumstances */}
          <section className="bg-memorial-900/50 rounded-xl border border-memorial-800 p-6">
            <h2 className="text-base font-semibold mb-4 text-memorial-300">Circumstances</h2>
            <div className="space-y-4">
              <TextArea
                label="Circumstances (EN)"
                name="circumstancesEn"
                value={form.circumstancesEn}
                onChange={handleChange}
                rows={5}
              />
              <TextArea
                label="Circumstances (FA)"
                name="circumstancesFa"
                value={form.circumstancesFa}
                onChange={handleChange}
                rows={4}
                dir="rtl"
              />
            </div>
          </section>

          {/* Admin */}
          <section className="bg-memorial-900/50 rounded-xl border border-memorial-800 p-6">
            <h2 className="text-base font-semibold mb-4 text-memorial-300">Admin</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-memorial-400 mb-1.5">Verification Status</label>
                <select
                  name="verificationStatus"
                  value={form.verificationStatus}
                  onChange={handleChange}
                  className="w-full bg-memorial-800 border border-memorial-700 rounded-lg px-3 py-2 text-sm text-memorial-100 focus:outline-none focus:border-gold-500"
                >
                  <option value="unverified">Unverified</option>
                  <option value="verified">Verified</option>
                  <option value="disputed">Disputed</option>
                </select>
              </div>
              <Field label="Data Source" name="dataSource" value={form.dataSource} onChange={handleChange} />
              <div className="sm:col-span-2">
                <TextArea label="Internal Notes" name="notes" value={form.notes} onChange={handleChange} rows={3} />
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <Link
              href="/admin/data-quality"
              className="px-4 py-2 text-sm bg-memorial-800 hover:bg-memorial-700 border border-memorial-700 rounded-lg transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 text-sm bg-gold-600 hover:bg-gold-500 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Field Components ──────────────────────────────────────────────────────

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required,
  min,
  max,
  dir,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  dir?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-memorial-400 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        min={min}
        max={max}
        dir={dir}
        className="w-full bg-memorial-800 border border-memorial-700 rounded-lg px-3 py-2 text-sm text-memorial-100 focus:outline-none focus:border-gold-500 placeholder:text-memorial-600"
      />
    </div>
  );
}

function TextArea({
  label,
  name,
  value,
  onChange,
  rows = 4,
  dir,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  dir?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-memorial-400 mb-1.5">{label}</label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        dir={dir}
        className="w-full bg-memorial-800 border border-memorial-700 rounded-lg px-3 py-2 text-sm text-memorial-100 focus:outline-none focus:border-gold-500 resize-y placeholder:text-memorial-600"
      />
    </div>
  );
}
