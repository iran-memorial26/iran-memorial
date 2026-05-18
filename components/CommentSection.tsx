"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";

type Comment = {
  id: string;
  authorName: string | null;
  content: string;
  createdAt: string;
};

type Props = {
  victimId: string;
  locale: Locale;
};

export function CommentSection({ victimId, locale }: Props) {
  const t = useTranslations();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({ authorName: "", content: "" });

  useEffect(() => {
    fetchComments();
  }, [victimId]);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/comments?victimId=${victimId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setComments(data.comments || []);
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(false);

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          victimId,
          authorName: formData.authorName.trim() || null,
          content: formData.content.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }

      setSuccess(true);
      setFormData({ authorName: "", content: "" });
      setShowForm(false);
    } catch (err: any) {
      alert(err.message || "Failed to submit comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-12 border-t border-memorial-800 pt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">{t("victim.comments")}</h2>
        {!showForm && !success && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-gold-600 hover:bg-gold-700 px-4 py-2 rounded text-sm"
          >
            {t("victim.addComment")}
          </button>
        )}
      </div>

      {success && (
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 mb-6">
          <p className="text-green-200">
            {t("victim.commentSubmitted")}
          </p>
        </div>
      )}

      {showForm && (
        <form onSubmit={submitComment} className="bg-memorial-900 p-6 rounded-lg mb-8">
          <div className="mb-4">
            <label className="block text-sm mb-2">{t("victim.yourName")} ({t("optional")})</label>
            <input
              type="text"
              value={formData.authorName}
              onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
              className="w-full bg-memorial-800 border border-memorial-700 rounded px-3 py-2"
              maxLength={100}
              placeholder={t("victim.anonymous")}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm mb-2">{t("victim.comment")} *</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full bg-memorial-800 border border-memorial-700 rounded px-3 py-2"
              rows={4}
              required
              minLength={3}
              maxLength={2000}
              placeholder={t("victim.commentPlaceholder")}
            />
            <p className="text-xs text-memorial-400 mt-1">
              {formData.content.length}/2000
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || !formData.content.trim()}
              className="bg-gold-600 hover:bg-gold-700 disabled:bg-memorial-700 disabled:cursor-not-allowed px-6 py-2 rounded"
            >
              {submitting ? t("submitting") : t("common.submit")}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setFormData({ authorName: "", content: "" });
              }}
              className="bg-memorial-800 hover:bg-memorial-700 px-6 py-2 rounded"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-memorial-400">{t("common.loading")}</p>
      ) : comments.length === 0 ? (
        <p className="text-memorial-400">{t("victim.noComments")}</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="bg-memorial-900 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2 text-sm text-memorial-400">
                <span className="font-medium text-memorial-200">
                  {comment.authorName || t("victim.anonymous")}
                </span>
                <span>•</span>
                <span>{new Date(comment.createdAt).toLocaleDateString(locale)}</span>
              </div>
              <p className="whitespace-pre-wrap">{comment.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
