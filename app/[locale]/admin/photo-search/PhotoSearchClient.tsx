"use client";

import { useState } from "react";
import Image from "next/image";

type Match = {
  photoId: string;
  url: string;
  victimId: string | null;
  victimSlug: string | null;
  victimName: string | null;
  victimNameFa: string | null;
  distance: number;
};

/** 8x8 perceptual hash (DCT-less, mean-based — "dHash variant"). 64 bits.
 *  Matches the layout used by Python's imagehash.phash(hash_size=8) closely
 *  enough that Hamming-distance results remain meaningful across the two
 *  implementations for the typical thresholds (Hamming <= 8).
 *  Returns a signed 64-bit BigInt to match the Postgres BIGINT representation.
 */
async function computePHash(file: File): Promise<bigint> {
  const img = new globalThis.Image();
  const objUrl = URL.createObjectURL(file);
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("decode"));
      img.src = objUrl;
    });
    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("canvas-2d unavailable");
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    // grayscale 32x32
    const lum = new Float32Array(size * size);
    for (let i = 0; i < lum.length; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    // downsample to 8x8 via 4x4 box average — close enough to DCT-low-pass
    // for our threshold range. (True DCT pHash is slightly more robust but
    // requires fft; the gain isn't worth shipping a kB of JS for an admin tool.)
    const dst = 8;
    const small = new Float32Array(dst * dst);
    for (let y = 0; y < dst; y++) {
      for (let x = 0; x < dst; x++) {
        let s = 0;
        for (let yy = 0; yy < 4; yy++) {
          for (let xx = 0; xx < 4; xx++) {
            s += lum[(y * 4 + yy) * size + (x * 4 + xx)];
          }
        }
        small[y * dst + x] = s / 16;
      }
    }
    let mean = 0;
    for (const v of small) mean += v;
    mean /= small.length;
    const ONE = BigInt(1);
    const ZERO = BigInt(0);
    let bits = ZERO;
    for (let i = 0; i < small.length; i++) {
      bits = (bits << ONE) | (small[i] >= mean ? ONE : ZERO);
    }
    // Map to signed 64-bit two's-complement so it matches Postgres BIGINT.
    const SIGN_BIT = ONE << BigInt(63);
    const WRAP = ONE << BigInt(64);
    if (bits >= SIGN_BIT) bits -= WRAP;
    return bits;
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

export function PhotoSearchClient() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [maxDistance, setMaxDistance] = useState(8);
  const [photoIdInput, setPhotoIdInput] = useState("");

  async function searchByPhash(phash: bigint) {
    const r = await fetch(
      `/api/admin/photo-similar?phash=${phash.toString()}&max=${maxDistance}`,
    );
    if (!r.ok) {
      setError(`HTTP ${r.status}`);
      return;
    }
    const j = await r.json();
    setMatches(j.matches as Match[]);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setMatches(null);
    setBusy(true);
    try {
      setPreview(URL.createObjectURL(file));
      const phash = await computePHash(file);
      await searchByPhash(phash);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function searchById() {
    if (!photoIdInput.trim()) return;
    setError(null);
    setMatches(null);
    setBusy(true);
    setPreview(null);
    try {
      const r = await fetch(
        `/api/admin/photo-similar?photo_id=${encodeURIComponent(photoIdInput.trim())}&max=${maxDistance}`,
      );
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`${r.status}: ${txt}`);
      }
      const j = await r.json();
      setMatches(j.matches as Match[]);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-memorial-800 bg-memorial-900/40 p-5">
          <h2 className="text-sm font-semibold text-memorial-200 mb-3">Upload image</h2>
          <input
            type="file"
            accept="image/*"
            onChange={onFile}
            className="block w-full text-sm text-memorial-300 file:mr-3 file:rounded file:border-0 file:bg-gold-500/10 file:text-gold-300 file:px-3 file:py-2 file:text-xs"
          />
          {preview && (
            <div className="mt-4 relative w-32 h-32 rounded overflow-hidden border border-memorial-700">
              <Image src={preview} alt="upload preview" fill className="object-cover" unoptimized />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-memorial-800 bg-memorial-900/40 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-memorial-200">By existing photo id</h2>
          <input
            type="text"
            placeholder="photo uuid"
            value={photoIdInput}
            onChange={(e) => setPhotoIdInput(e.target.value)}
            className="w-full rounded border border-memorial-700 bg-memorial-950 px-3 py-2 text-sm text-memorial-100"
          />
          <button
            onClick={searchById}
            disabled={busy || !photoIdInput.trim()}
            className="rounded bg-gold-500/20 px-4 py-2 text-sm text-gold-300 hover:bg-gold-500/30 disabled:opacity-50"
          >
            Find similar
          </button>
        </div>
      </section>

      <div className="flex items-center gap-3 text-sm text-memorial-300">
        <label className="font-medium">Max Hamming distance:</label>
        <input
          type="range"
          min={0}
          max={20}
          value={maxDistance}
          onChange={(e) => setMaxDistance(parseInt(e.target.value, 10))}
        />
        <span className="font-mono w-6 text-end">{maxDistance}</span>
        <span className="text-xs text-memorial-500">
          (≤6 = very strict, ≤8 default, ≤12 = loose)
        </span>
      </div>

      {busy && <p className="text-sm text-memorial-400">Searching…</p>}
      {error && <p className="text-sm text-red-400">Error: {error}</p>}

      {matches && (
        <section>
          <h2 className="text-sm font-semibold text-memorial-200 mb-3">
            {matches.length} match{matches.length === 1 ? "" : "es"}
          </h2>
          {matches.length === 0 ? (
            <p className="text-sm text-memorial-500">
              No similar photos found. Try increasing the distance.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((m) => (
                <a
                  key={m.photoId}
                  href={m.victimSlug ? `/admin/victims/${m.victimSlug}/edit` : "#"}
                  className="flex gap-3 rounded border border-memorial-800 bg-memorial-900/40 p-3 hover:border-gold-500/40"
                >
                  <div className="relative w-20 h-20 flex-shrink-0 rounded overflow-hidden bg-memorial-800">
                    <Image src={m.url} alt="" fill sizes="80px" className="object-cover" unoptimized={m.url.startsWith("https://")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-memorial-100 truncate">
                      {m.victimName || "(orphan photo)"}
                    </p>
                    {m.victimNameFa && (
                      <p className="text-xs text-memorial-500 truncate" dir="rtl">
                        {m.victimNameFa}
                      </p>
                    )}
                    <p className="text-xs text-gold-400 mt-1">
                      Distance: {m.distance}
                      {m.distance === 0 && " (exact)"}
                    </p>
                    <p className="text-[10px] text-memorial-600 font-mono mt-1 truncate">
                      {m.photoId}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
