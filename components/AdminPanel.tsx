"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type Submission = {
  id: string;
  victimData: any;
  submitterEmail: string | null;
  submitterName: string | null;
  status: string;
  reviewerNotes: string | null;
  createdAt: string;
};

type VictimSearchResult = {
  id: string;
  slug: string;
  nameLatin: string;
  nameFarsi: string | null;
  dateOfDeath: string | null;
  placeOfDeath: string | null;
};

export function AdminPanel({
  submissions: initialSubmissions,
  counts,
}: {
  submissions: Submission[];
  counts: { pending: number; approved: number; rejected: number };
}) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected" | "photos">("pending");
  const [loading, setLoading] = useState<string | null>(null);
  const [converting, setConverting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadTab(status: string) {
    setActiveTab(status as any);
    setError(null);
    if (status === "photos") return;
    try {
      const res = await fetch(`/api/admin/submissions?status=${status}`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions);
      } else {
        setError(`Failed to load submissions (${res.status})`);
      }
    } catch {
      setError("Network error — could not load submissions");
    }
  }

  async function reviewSubmission(id: string, status: "approved" | "rejected", notes?: string) {
    setLoading(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, reviewerNotes: notes }),
      });
      if (res.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== id));
      } else {
        setError(`Failed to update submission (${res.status})`);
      }
    } catch {
      setError("Network error — could not update submission");
    }
    setLoading(null);
  }

  async function convertSubmission(id: string) {
    setConverting(id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/submissions/${id}/convert`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess(`Converted to victim: ${data.victim.slug}`);
        // Remove from list after successful conversion
        setSubmissions((prev) => prev.filter((s) => s.id !== id));
      } else {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        setError(`Failed to convert: ${errorData.error || res.statusText}`);
      }
    } catch {
      setError("Network error — could not convert submission");
    }
    setConverting(null);
  }

  const tabCls = (tab: string) =>
    `px-4 py-2 text-sm rounded-t border-b-2 transition-colors cursor-pointer ${
      activeTab === tab
        ? "border-gold-400 text-gold-400"
        : "border-transparent text-memorial-400 hover:text-memorial-200"
    }`;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-memorial-100 mb-2">Admin Panel</h1>
      <p className="text-memorial-400 mb-8">Review community submissions</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-4 text-center">
          <div className="text-2xl font-bold text-gold-400">{counts.pending}</div>
          <div className="text-xs text-memorial-500">Pending</div>
        </div>
        <div className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{counts.approved}</div>
          <div className="text-xs text-memorial-500">Approved</div>
        </div>
        <div className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{counts.rejected}</div>
          <div className="text-xs text-memorial-500">Rejected</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-memorial-800 mb-6">
        <button onClick={() => loadTab("pending")} className={tabCls("pending")}>
          Pending ({counts.pending})
        </button>
        <button onClick={() => loadTab("approved")} className={tabCls("approved")}>
          Approved
        </button>
        <button onClick={() => loadTab("rejected")} className={tabCls("rejected")}>
          Rejected
        </button>
        <button onClick={() => loadTab("photos")} className={tabCls("photos")}>
          Photos
        </button>
      </div>

      {/* Error (only for non-photos tabs) */}
      {error && activeTab !== "photos" && (
        <div className="mb-4 rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Success */}
      {success && activeTab !== "photos" && (
        <div className="mb-4 rounded-lg border border-green-800/50 bg-green-900/20 px-4 py-3 text-sm text-green-400">
          {success}
        </div>
      )}

      {/* Photos Tab */}
      {activeTab === "photos" && <PhotoUploadSection />}

      {/* Submissions */}
      {activeTab !== "photos" && (
        <>
          {submissions.length === 0 ? (
            <p className="text-memorial-500 text-center py-12">
              No {activeTab} submissions.
            </p>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub) => (
                <SubmissionCard
                  key={sub.id}
                  submission={sub}
                  isActive={activeTab === "pending"}
                  isApproved={activeTab === "approved"}
                  loading={loading === sub.id}
                  converting={converting === sub.id}
                  onApprove={() => reviewSubmission(sub.id, "approved")}
                  onReject={() => reviewSubmission(sub.id, "rejected")}
                  onConvert={() => convertSubmission(sub.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Photo Upload Section                                               */
/* ------------------------------------------------------------------ */

function PhotoUploadSection() {
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VictimSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedVictim, setSelectedVictim] = useState<VictimSearchResult | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<{ id: string; url: string; isPrimary: boolean } | null>(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery]);

  // File selection handler
  const handleFileSelect = useCallback((selected: File | null) => {
    setUploadError(null);
    setUploadSuccess(null);

    if (!selected) {
      setFile(null);
      setPreview(null);
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(selected.type)) {
      setUploadError(`Invalid file type: ${selected.type}. Allowed: JPEG, PNG, WebP`);
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setUploadError("File too large (max 5 MB)");
      return;
    }

    setFile(selected);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(selected);
  }, []);

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0] || null;
    handleFileSelect(dropped);
  }, [handleFileSelect]);

  // Upload handler
  async function handleUpload() {
    if (!selectedVictim || !file) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("victimId", selectedVictim.id);
    if (caption.trim()) {
      formData.append("caption", caption.trim());
    }

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setUploadSuccess(data);
        // Reset form for next upload
        setFile(null);
        setPreview(null);
        setCaption("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setUploadError(data.error || `Upload failed (${res.status})`);
      }
    } catch {
      setUploadError("Network error — could not upload photo");
    }
    setUploading(false);
  }

  // Reset everything
  function resetForm() {
    setSelectedVictim(null);
    setSearchQuery("");
    setSearchResults([]);
    setFile(null);
    setPreview(null);
    setCaption("");
    setUploadError(null);
    setUploadSuccess(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Search for victim */}
      <div className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-5">
        <h3 className="text-sm font-medium text-memorial-100 mb-3">
          1. Select Victim
        </h3>

        {selectedVictim ? (
          <div className="flex items-center justify-between rounded-lg border border-gold-400/30 bg-gold-400/5 px-4 py-3">
            <div>
              <span className="text-sm font-medium text-memorial-100">
                {selectedVictim.nameLatin}
              </span>
              {selectedVictim.nameFarsi && (
                <span className="text-sm text-memorial-400 ms-2" dir="rtl">
                  ({selectedVictim.nameFarsi})
                </span>
              )}
              <span className="text-xs text-memorial-500 ms-2">
                {selectedVictim.slug}
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedVictim(null);
                setSearchQuery("");
                setSearchResults([]);
                setUploadSuccess(null);
              }}
              className="text-xs text-memorial-400 hover:text-memorial-200 transition-colors cursor-pointer"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or slug..."
              className="w-full rounded-lg border border-memorial-800 bg-memorial-900/50 px-4 py-2.5 text-sm text-memorial-100 placeholder:text-memorial-600 focus:border-gold-400/50 focus:outline-none focus:ring-1 focus:ring-gold-400/30"
            />
            {searching && (
              <div className="absolute inset-y-0 end-3 flex items-center">
                <span className="text-xs text-memorial-500">Searching...</span>
              </div>
            )}
            {/* Search results dropdown */}
            {searchResults.length > 0 && !selectedVictim && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-memorial-800 bg-memorial-900 shadow-lg max-h-64 overflow-y-auto">
                {searchResults.map((victim) => (
                  <button
                    key={victim.id}
                    onClick={() => {
                      setSelectedVictim(victim);
                      setSearchResults([]);
                      setSearchQuery("");
                    }}
                    className="w-full text-start px-4 py-3 hover:bg-memorial-800/50 transition-colors border-b border-memorial-800/40 last:border-b-0 cursor-pointer"
                  >
                    <div className="text-sm text-memorial-100">
                      {victim.nameLatin}
                      {victim.nameFarsi && (
                        <span className="text-memorial-400 ms-2" dir="rtl">
                          {victim.nameFarsi}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-memorial-500 mt-0.5">
                      {victim.slug}
                      {victim.placeOfDeath && ` — ${victim.placeOfDeath}`}
                      {victim.dateOfDeath && ` — ${new Date(victim.dateOfDeath).toLocaleDateString()}`}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
              <p className="mt-2 text-xs text-memorial-500">No victims found.</p>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Select photo */}
      <div className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-5">
        <h3 className="text-sm font-medium text-memorial-100 mb-3">
          2. Select Photo
        </h3>

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors cursor-pointer ${
            dragging
              ? "border-gold-400 bg-gold-400/10"
              : "border-memorial-700 hover:border-memorial-500 bg-memorial-900/20"
          }`}
        >
          <svg
            className="mb-3 h-10 w-10 text-memorial-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
            />
          </svg>
          <p className="text-sm text-memorial-400 mb-1">
            Drop an image here, or click to select
          </p>
          <p className="text-xs text-memorial-600">
            JPEG, PNG, or WebP — max 5 MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            className="hidden"
          />
        </div>

        {/* Preview */}
        {preview && file && (
          <div className="mt-4 flex items-start gap-4">
            <div className="relative flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Preview"
                className="h-24 w-24 rounded-lg object-cover border border-memorial-800"
              />
              <button
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="absolute -top-2 -end-2 h-5 w-5 rounded-full bg-red-900 border border-red-700 text-red-400 flex items-center justify-center text-xs hover:bg-red-800 transition-colors cursor-pointer"
              >
                x
              </button>
            </div>
            <div className="text-xs text-memorial-500 pt-1">
              <p className="font-medium text-memorial-300">{file.name}</p>
              <p>{(file.size / 1024).toFixed(0)} KB — {file.type}</p>
            </div>
          </div>
        )}
      </div>

      {/* Step 3: Caption (optional) */}
      <div className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-5">
        <h3 className="text-sm font-medium text-memorial-100 mb-3">
          3. Caption <span className="text-memorial-600 font-normal">(optional)</span>
        </h3>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="e.g. Portrait from family archive"
          className="w-full rounded-lg border border-memorial-800 bg-memorial-900/50 px-4 py-2.5 text-sm text-memorial-100 placeholder:text-memorial-600 focus:border-gold-400/50 focus:outline-none focus:ring-1 focus:ring-gold-400/30"
        />
      </div>

      {/* Error */}
      {uploadError && (
        <div className="rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {uploadError}
        </div>
      )}

      {/* Success */}
      {uploadSuccess && (
        <div className="rounded-lg border border-green-800/50 bg-green-900/20 px-4 py-3 text-sm text-green-400">
          Photo uploaded successfully.
          {uploadSuccess.isPrimary && " This is now the primary photo."}
          <span className="block text-xs text-green-500 mt-1">{uploadSuccess.url}</span>
        </div>
      )}

      {/* Upload button */}
      <div className="flex gap-3">
        <button
          onClick={handleUpload}
          disabled={!selectedVictim || !file || uploading}
          className="px-6 py-2.5 rounded-lg text-sm font-medium bg-gold-400/20 text-gold-400 border border-gold-400/30 hover:bg-gold-400/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {uploading ? "Uploading..." : "Upload Photo"}
        </button>
        <button
          onClick={resetForm}
          className="px-4 py-2.5 rounded-lg text-sm text-memorial-400 border border-memorial-800 hover:border-memorial-600 hover:text-memorial-200 transition-colors cursor-pointer"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function SubmissionCard({
  submission,
  isActive,
  isApproved,
  loading,
  converting,
  onApprove,
  onReject,
  onConvert,
}: {
  submission: Submission;
  isActive: boolean;
  isApproved?: boolean;
  loading: boolean;
  converting?: boolean;
  onApprove: () => void;
  onReject: () => void;
  onConvert: () => void;
}) {
  const data = submission.victimData as any;

  return (
    <div className="rounded-lg border border-memorial-800/60 bg-memorial-900/30 p-5">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-semibold text-memorial-100">
            {data.name_latin || data.nameLatin || "Unknown"}
          </h3>
          {(data.name_farsi || data.nameFarsi) && (
            <p className="text-sm text-memorial-400" dir="rtl">
              {data.name_farsi || data.nameFarsi}
            </p>
          )}
        </div>
        <time className="text-xs text-memorial-500">
          {new Date(submission.createdAt).toLocaleDateString()}
        </time>
      </div>

      {data.details && (
        <div className="mb-3">
          <h4 className="text-xs font-medium text-memorial-500 mb-1">Details</h4>
          <p className="text-sm text-memorial-300 whitespace-pre-wrap">
            {data.details}
          </p>
        </div>
      )}

      {data.sources && (
        <div className="mb-3">
          <h4 className="text-xs font-medium text-memorial-500 mb-1">Sources</h4>
          <p className="text-sm text-memorial-400 break-all">{data.sources}</p>
        </div>
      )}

      {(submission.submitterName || submission.submitterEmail) && (
        <div className="mb-3 text-xs text-memorial-500">
          Submitted by: {submission.submitterName || "Anonymous"}
          {submission.submitterEmail && ` (${submission.submitterEmail})`}
        </div>
      )}

      {submission.reviewerNotes && (
        <div className="mb-3 text-xs text-memorial-500 italic">
          Notes: {submission.reviewerNotes}
        </div>
      )}

      {isActive && (
        <div className="flex gap-2 mt-4 pt-3 border-t border-memorial-800">
          <button
            onClick={onApprove}
            disabled={loading}
            className="px-4 py-2 rounded text-sm font-medium bg-green-900/50 text-green-400 border border-green-800/50 hover:bg-green-900 transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "Approve"}
          </button>
          <button
            onClick={onReject}
            disabled={loading}
            className="px-4 py-2 rounded text-sm font-medium bg-red-900/50 text-red-400 border border-red-800/50 hover:bg-red-900 transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "Reject"}
          </button>
        </div>
      )}

      {isApproved && (
        <div className="flex gap-2 mt-4 pt-3 border-t border-memorial-800">
          <button
            onClick={onConvert}
            disabled={converting}
            className="px-4 py-2 rounded text-sm font-medium bg-gold-900/50 text-gold-400 border border-gold-800/50 hover:bg-gold-900 transition-colors disabled:opacity-50"
          >
            {converting ? "Converting..." : "Convert to Victim"}
          </button>
          <p className="text-xs text-memorial-500 pt-2">
            This will create a new victim record in the database
          </p>
        </div>
      )}
    </div>
  );
}
