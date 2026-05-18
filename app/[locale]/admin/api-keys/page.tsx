"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type ApiKey = {
  id: string;
  key: string;
  name: string;
  email: string | null;
  description: string | null;
  rateLimit: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  _count: { usageLogs: number };
};

export default function ApiKeysPage() {
  const t = useTranslations();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    description: "",
    rateLimit: 1000,
    expiresAt: "",
  });

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/admin/api-keys");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setKeys(data.keys);
    } catch (err) {
      setError("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to create");
      await fetchKeys();
      setShowForm(false);
      setFormData({ name: "", email: "", description: "", rateLimit: 1000, expiresAt: "" });
    } catch (err) {
      alert("Failed to create API key");
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await fetch("/api/admin/api-keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      await fetchKeys();
    } catch (err) {
      alert("Failed to update API key");
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm("Delete this API key? This cannot be undone.")) return;
    try {
      await fetch(`/api/admin/api-keys?id=${id}`, { method: "DELETE" });
      await fetchKeys();
    } catch (err) {
      alert("Failed to delete API key");
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">API Keys</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gold-600 hover:bg-gold-700 px-4 py-2 rounded"
          >
            {showForm ? "Cancel" : "Create New Key"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={createKey} className="bg-memorial-900 p-6 rounded-lg mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-memorial-800 border border-memorial-700 rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-memorial-800 border border-memorial-700 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Rate Limit (per hour)</label>
                <input
                  type="number"
                  value={formData.rateLimit}
                  onChange={(e) => setFormData({ ...formData, rateLimit: parseInt(e.target.value) })}
                  className="w-full bg-memorial-800 border border-memorial-700 rounded px-3 py-2"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Expires At (optional)</label>
                <input
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="w-full bg-memorial-800 border border-memorial-700 rounded px-3 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-memorial-800 border border-memorial-700 rounded px-3 py-2"
                  rows={3}
                />
              </div>
            </div>
            <button type="submit" className="mt-4 bg-gold-600 hover:bg-gold-700 px-6 py-2 rounded">
              Create API Key
            </button>
          </form>
        )}

        <div className="bg-memorial-900 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-memorial-800">
              <tr>
                <th className="text-left p-4">Name</th>
                <th className="text-left p-4">Key</th>
                <th className="text-left p-4">Rate Limit</th>
                <th className="text-left p-4">Usage</th>
                <th className="text-left p-4">Last Used</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-t border-memorial-800">
                  <td className="p-4">
                    <div className="font-medium">{key.name}</div>
                    {key.email && <div className="text-sm text-memorial-400">{key.email}</div>}
                  </td>
                  <td className="p-4">
                    <code className="text-xs bg-memorial-800 px-2 py-1 rounded">
                      {key.key.slice(0, 20)}...
                    </code>
                  </td>
                  <td className="p-4">{key.rateLimit}/hr</td>
                  <td className="p-4">{key._count.usageLogs} requests</td>
                  <td className="p-4 text-sm">
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        key.isActive ? "bg-green-900 text-green-200" : "bg-red-900 text-red-200"
                      }`}
                    >
                      {key.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleActive(key.id, key.isActive)}
                      className="text-sm text-gold-400 hover:text-gold-300 mr-3"
                    >
                      {key.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => deleteKey(key.id)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
  );
}
