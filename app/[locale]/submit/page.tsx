"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

type Media = { url: string; mime: string; size: number };

export default function SubmitPage() {
  const t = useTranslations("submit");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [media, setMedia] = useState<Media[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/submit/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) {
        setUploadError(j.error || `HTTP ${res.status}`);
        return;
      }
      setMedia((prev) => [...prev, j as Media]);
    } catch {
      setUploadError(t("uploadError"));
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected if needed
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");

    const form = new FormData(e.currentTarget);
    // Drop empty strings so they pass the API's `.optional()` validation
    // instead of failing on "" — the zod schema accepts undefined, not "".
    const raw: Record<string, FormDataEntryValue | null> = {
      name_latin: form.get("name_latin"),
      name_farsi: form.get("name_farsi"),
      date_of_birth: form.get("date_of_birth"),
      date_of_death: form.get("date_of_death"),
      place_of_death: form.get("place_of_death"),
      province: form.get("province"),
      cause_of_death: form.get("cause_of_death"),
      details: form.get("details"),
      sources: form.get("sources"),
      submitter_email: form.get("submitter_email"),
      submitter_name: form.get("submitter_name"),
      // Personal (combined "Beruf / Occupation" lives in occupation_en;
      // a separate optional Farsi input feeds occupation_fa).
      occupation_en: form.get("occupation_en"),
      occupation_fa: form.get("occupation_fa"),
      age_at_death: form.get("age_at_death"),
      gender: form.get("gender"),
      ethnicity: form.get("ethnicity"),
      religion: form.get("religion"),
      place_of_birth: form.get("place_of_birth"),
      // Education
      field_of_study: form.get("field_of_study"),
      university_name: form.get("university_name"),
      university_city: form.get("university_city"),
      degree_level: form.get("degree_level"),
      graduation_year: form.get("graduation_year"),
      // Online presence
      instagram_handle: form.get("instagram_handle"),
      x_handle: form.get("x_handle"),
      linkedin_url: form.get("linkedin_url"),
      github_handle: form.get("github_handle"),
      telegram_handle: form.get("telegram_handle"),
      facebook_url: form.get("facebook_url"),
      youtube_channel_url: form.get("youtube_channel_url"),
      website_url: form.get("website_url"),
    };
    const data: Record<string, unknown> = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v !== null && v !== ""),
    );

    // Coerce numeric fields client-side so the JSON payload is well-typed
    // (the API also runs z.coerce.number(), but doing it here keeps types tidy).
    if (typeof data.age_at_death === "string") {
      const n = Number(data.age_at_death);
      if (Number.isFinite(n)) data.age_at_death = n;
      else delete data.age_at_death;
    }
    if (typeof data.graduation_year === "string") {
      const n = Number(data.graduation_year);
      if (Number.isFinite(n)) data.graduation_year = n;
      else delete data.graduation_year;
    }

    // Aliases: single comma-separated input → string[].
    const aliasesRaw = form.get("aliases");
    if (typeof aliasesRaw === "string") {
      const list = aliasesRaw.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length > 0) data.aliases = list;
    }
    // Quotes: single textarea, one quote per line → string[].
    const quotesRaw = form.get("quotes");
    if (typeof quotesRaw === "string") {
      const list = quotesRaw.split("\n").map((s) => s.trim()).filter(Boolean);
      if (list.length > 0) data.quotes = list;
    }

    if (media.length > 0) data.media_urls = media.map((m) => m.url);

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <span className="text-5xl mb-6 block candle-flicker">🕯</span>
        <p className="text-xl text-memorial-200 mb-2">{t("thankYou")}</p>
        <p className="text-sm text-memorial-500">{t("description")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <span className="text-3xl candle-flicker inline-block mb-4">🕯</span>
        <h1 className="text-3xl font-bold text-memorial-50 mb-2">{t("title")}</h1>
        <p className="text-memorial-400">{t("description")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Victim Name Group */}
        <fieldset className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-6 space-y-5">
          <legend className="text-sm font-medium text-gold-400 px-2">
            {t("nameLabel").replace(" *", "")}
          </legend>
          <div>
            <label className="block text-sm text-memorial-300 mb-1.5">
              {t("nameLabel")} *
            </label>
            <input
              name="name_latin"
              required
              className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              placeholder="e.g. Mahsa Amini"
            />
          </div>
          <div>
            <label className="block text-sm text-memorial-300 mb-1.5">
              {t("nameFarsiLabel")}
            </label>
            <input
              name="name_farsi"
              dir="rtl"
              className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              placeholder="مثلاً مهسا امینی"
            />
          </div>
        </fieldset>

        {/* Structured facts — date of birth/death, place, cause.
            Optional but every filled field saves admin review time. */}
        <fieldset className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-6 space-y-5">
          <legend className="text-sm font-medium text-gold-400 px-2">
            {t("factsLegend")}
          </legend>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("dateOfBirthLabel")}
              </label>
              <input
                name="date_of_birth"
                type="date"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("dateOfDeathLabel")}
              </label>
              <input
                name="date_of_death"
                type="date"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("placeOfDeathLabel")}
              </label>
              <input
                name="place_of_death"
                placeholder={t("placeOfDeathPlaceholder")}
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("provinceLabel")}
              </label>
              <input
                name="province"
                placeholder={t("provincePlaceholder")}
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-memorial-300 mb-1.5">
              {t("causeOfDeathLabel")}
            </label>
            <select
              name="cause_of_death"
              defaultValue=""
              className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
            >
              <option value="">{t("causeUnknown")}</option>
              <option value="Killed during protest">{t("causeKilled")}</option>
              <option value="Executed">{t("causeExecuted")}</option>
              <option value="Died in custody">{t("causeCustody")}</option>
              <option value="Imprisoned (alive)">{t("causeImprisoned")}</option>
              <option value="Other">{t("causeOther")}</option>
            </select>
          </div>
        </fieldset>

        {/* Personal — optional bio facts already in the Victim schema
            but historically not exposed in the public form. */}
        <fieldset className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-6 space-y-5">
          <legend className="text-sm font-medium text-gold-400 px-2">
            {t("personalLegend")}
          </legend>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("occupationLabel")}
              </label>
              <input
                name="occupation_en"
                placeholder="e.g. Student, Engineer, Nurse"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("occupationFarsiLabel")}
              </label>
              <input
                name="occupation_fa"
                dir="rtl"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("ageLabel")}
              </label>
              <input
                name="age_at_death"
                type="number"
                min={0}
                max={120}
                inputMode="numeric"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("genderLabel")}
              </label>
              <select
                name="gender"
                defaultValue=""
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              >
                <option value="">—</option>
                <option value="male">{t("genderMale")}</option>
                <option value="female">{t("genderFemale")}</option>
                <option value="other">{t("genderOther")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("ethnicityLabel")}
              </label>
              <input
                name="ethnicity"
                placeholder="e.g. Kurdish, Baloch, Azeri"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("religionLabel")}
              </label>
              <input
                name="religion"
                placeholder="e.g. Baháʼí, Sunni, Christian"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("placeOfBirthLabel")}
              </label>
              <input
                name="place_of_birth"
                placeholder="e.g. Mahabad, Saqqez"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-memorial-300 mb-1.5">
              {t("aliasesLabel")}
            </label>
            <p className="text-xs text-memorial-500 mb-2">{t("aliasesHint")}</p>
            <textarea
              name="aliases"
              rows={2}
              placeholder="Jina, Zhina"
              className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
            />
          </div>
          <div>
            <label className="block text-sm text-memorial-300 mb-1.5">
              {t("quotesLabel")}
            </label>
            <p className="text-xs text-memorial-500 mb-2">{t("quotesHint")}</p>
            <textarea
              name="quotes"
              rows={3}
              className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
            />
          </div>
        </fieldset>

        {/* Education — 5 columns added in migration 20260512210000. */}
        <fieldset className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-6 space-y-5">
          <legend className="text-sm font-medium text-gold-400 px-2">
            {t("educationLegend")}
          </legend>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("fieldOfStudyLabel")}
              </label>
              <input
                name="field_of_study"
                placeholder="e.g. Civil Engineering"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("universityNameLabel")}
              </label>
              <input
                name="university_name"
                placeholder="e.g. Sharif University of Technology"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("universityCityLabel")}
              </label>
              <input
                name="university_city"
                placeholder="e.g. Tehran"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("degreeLevelLabel")}
              </label>
              <select
                name="degree_level"
                defaultValue=""
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              >
                <option value="">—</option>
                <option value="undergraduate">{t("degreeUndergraduate")}</option>
                <option value="bachelor">{t("degreeBachelor")}</option>
                <option value="master">{t("degreeMaster")}</option>
                <option value="phd">{t("degreePhd")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("graduationYearLabel")}
              </label>
              <input
                name="graduation_year"
                type="number"
                min={1900}
                max={2100}
                inputMode="numeric"
                placeholder="e.g. 2018"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
          </div>
        </fieldset>

        {/* Online presence — 8 columns added in migration 20260512210000.
            Handles get a small confirmation hint to discourage drive-by guessing. */}
        <fieldset className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-6 space-y-5">
          <legend className="text-sm font-medium text-gold-400 px-2">
            {t("onlineLegend")}
          </legend>
          <p className="text-xs text-memorial-500">ⓘ {t("onlineHint")}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("instagramLabel")}
              </label>
              <input
                name="instagram_handle"
                placeholder="without @"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("xLabel")}
              </label>
              <input
                name="x_handle"
                placeholder="without @"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("githubLabel")}
              </label>
              <input
                name="github_handle"
                placeholder="without @"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("telegramLabel")}
              </label>
              <input
                name="telegram_handle"
                placeholder="without @"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("linkedinLabel")}
              </label>
              <input
                name="linkedin_url"
                type="url"
                placeholder="https://linkedin.com/in/…"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("facebookLabel")}
              </label>
              <input
                name="facebook_url"
                type="url"
                placeholder="https://facebook.com/…"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("youtubeLabel")}
              </label>
              <input
                name="youtube_channel_url"
                type="url"
                placeholder="https://youtube.com/@…"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("websiteLabel")}
              </label>
              <input
                name="website_url"
                type="url"
                placeholder="https://…"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
          </div>
        </fieldset>

        {/* Details */}
        <div>
          <label className="block text-sm font-medium text-memorial-300 mb-1.5">
            {t("detailsLabel")} *
          </label>
          <p className="text-xs text-memorial-500 mb-2">
            {t("detailsHint")}
          </p>
          <textarea
            name="details"
            required
            rows={6}
            className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
          />
        </div>

        {/* Sources */}
        <div>
          <label className="block text-sm font-medium text-memorial-300 mb-1.5">
            {t("sourcesLabel")}
          </label>
          <p className="text-xs text-memorial-500 mb-2">
            {t("sourcesHint")}
          </p>
          <textarea
            name="sources"
            rows={3}
            className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
          />
        </div>

        {/* Media upload — optional photo or video, max 20 MB.
            Each upload returns a server-issued URL that gets bundled into
            the submission JSON so admins can preview during review. */}
        <fieldset className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-6 space-y-4">
          <legend className="text-sm font-medium text-memorial-400 px-2">
            {t("mediaLegend")}
          </legend>
          <p className="text-xs text-memorial-500">{t("mediaHint")}</p>

          <div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
              onChange={handleFileChange}
              disabled={uploading || media.length >= 5}
              className="block w-full text-sm text-memorial-300 file:mr-3 file:rounded file:border-0 file:bg-gold-500/10 file:text-gold-300 file:px-3 file:py-2 file:text-xs hover:file:bg-gold-500/20 disabled:opacity-50"
            />
            {uploading && (
              <p className="mt-2 text-xs text-memorial-400">{t("uploading")}</p>
            )}
            {uploadError && (
              <p className="mt-2 text-xs text-blood-400">{uploadError}</p>
            )}
          </div>

          {media.length > 0 && (
            <ul className="space-y-2">
              {media.map((m, i) => (
                <li
                  key={m.url}
                  className="flex items-center gap-3 rounded border border-memorial-800/60 bg-memorial-950/40 p-2"
                >
                  {m.mime.startsWith("image/") ? (
                    // Plain <img> on purpose — these /uploads/pending/* paths
                    // are not in next.config remotePatterns yet, and we want
                    // zero-friction local preview.
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={m.url}
                      alt=""
                      className="h-16 w-16 rounded object-cover bg-memorial-900"
                    />
                  ) : (
                    <video
                      src={m.url}
                      className="h-16 w-16 rounded object-cover bg-memorial-900"
                      muted
                    />
                  )}
                  <div className="flex-1 min-w-0 text-xs text-memorial-400">
                    <div className="truncate">{m.mime}</div>
                    <div>{(m.size / 1024 / 1024).toFixed(1)} MB</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMedia((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-xs text-memorial-500 hover:text-blood-400 px-2"
                  >
                    {t("removeMedia")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        {/* Submitter Info */}
        <fieldset className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-6 space-y-5">
          <legend className="text-sm font-medium text-memorial-400 px-2">
            {t("yourInfo")}
          </legend>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("yourNameLabel")}
              </label>
              <input
                name="submitter_name"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
            <div>
              <label className="block text-sm text-memorial-300 mb-1.5">
                {t("emailLabel")}
              </label>
              <input
                name="submitter_email"
                type="email"
                className="w-full rounded-lg border border-memorial-700 bg-memorial-900 px-4 py-2.5 text-memorial-100 placeholder:text-memorial-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
          </div>
          <p className="text-xs text-memorial-600">{t("privacyNote")}</p>
        </fieldset>

        {status === "error" && (
          <p className="text-blood-400 text-sm text-center">{t("error")}</p>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-lg bg-gold-500/20 border border-gold-500/30 px-6 py-3.5 font-medium text-gold-400 hover:bg-gold-500/30 transition-colors disabled:opacity-50"
        >
          {status === "loading" ? "..." : t("submitButton")}
        </button>
      </form>
    </div>
  );
}
