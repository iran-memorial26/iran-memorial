"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

type Photo = {
  id: string;
  url: string;
  captionEn: string | null;
  captionFa: string | null;
  sourceCredit: string | null;
  photoType: string;
  isPrimary: boolean;
};

type PhotoGalleryProps = {
  photos: Photo[];
  name: string;
  locale: string;
  labels: {
    photoOf: string;
    photoCredit: string;
    closeGallery: string;
    previousPhoto: string;
    nextPhoto: string;
  };
};

export function PhotoGallery({ photos: rawPhotos, name, locale, labels }: PhotoGalleryProps) {
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());
  const photos = rawPhotos.filter((p) => !brokenIds.has(p.id));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const safeIndex = Math.min(selectedIndex, Math.max(0, photos.length - 1));
  const selected = photos[safeIndex];
  const caption = locale === "fa" ? (selected?.captionFa || selected?.captionEn) : (selected?.captionEn || selected?.captionFa);

  const markBroken = useCallback((id: string) => {
    setBrokenIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const goTo = useCallback((dir: 1 | -1) => {
    setSelectedIndex((i) => (i + dir + Math.max(photos.length, 1)) % Math.max(photos.length, 1));
  }, [photos.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") goTo(-1);
      if (e.key === "ArrowRight") goTo(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxOpen, goTo]);

  if (!selected) return null;

  return (
    <>
      {/* Main photo */}
      <div
        className="relative w-full aspect-[3/4] max-w-[300px] sm:max-w-[400px] rounded-lg overflow-hidden bg-memorial-800/80 cursor-pointer group"
        onClick={() => setLightboxOpen(true)}
      >
        <Image
          src={selected.url}
          alt={labels.photoOf.replace("{name}", name)}
          fill
          sizes="(min-width: 640px) 400px, 300px"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          unoptimized={selected.url.startsWith("https://")}
          onError={() => markBroken(selected.id)}
        />
        {photos.length > 1 && (
          <div className="absolute bottom-2 end-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {safeIndex + 1} / {photos.length}
          </div>
        )}
      </div>

      {/* Caption */}
      {(caption || selected.sourceCredit) && (
        <div className="mt-2 max-w-[400px]">
          {caption && <p className="text-sm text-memorial-300">{caption}</p>}
          {selected.sourceCredit && (
            <p className="text-xs text-memorial-500 mt-0.5">
              {labels.photoCredit.replace("{credit}", selected.sourceCredit)}
            </p>
          )}
        </div>
      )}

      {/* Thumbnails */}
      {photos.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 max-w-[400px]">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              onClick={() => setSelectedIndex(i)}
              className={`relative w-[60px] h-[60px] flex-shrink-0 rounded overflow-hidden border-2 bg-memorial-800/80 transition-colors ${
                i === safeIndex
                  ? "border-gold-400"
                  : "border-transparent hover:border-memorial-500"
              }`}
              aria-label={labels.photoOf.replace("{name}", name)}
            >
              <Image
                src={photo.url}
                alt=""
                fill
                sizes="60px"
                className="object-cover"
                unoptimized={photo.url.startsWith("https://")}
                onError={() => markBroken(photo.id)}
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close button */}
          <button
            className="absolute top-4 end-4 text-white/80 hover:text-white text-3xl z-10"
            onClick={() => setLightboxOpen(false)}
            aria-label={labels.closeGallery}
          >
            &times;
          </button>

          {/* Nav arrows */}
          {photos.length > 1 && (
            <>
              <button
                className="absolute start-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-4xl z-10 px-2"
                onClick={(e) => { e.stopPropagation(); goTo(-1); }}
                aria-label={labels.previousPhoto}
              >
                &#8249;
              </button>
              <button
                className="absolute end-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-4xl z-10 px-2"
                onClick={(e) => { e.stopPropagation(); goTo(1); }}
                aria-label={labels.nextPhoto}
              >
                &#8250;
              </button>
            </>
          )}

          {/* Image */}
          <div
            className="relative max-w-[90vw] max-h-[85vh] w-full h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={selected.url}
              alt={labels.photoOf.replace("{name}", name)}
              fill
              sizes="90vw"
              className="object-contain"
              unoptimized={selected.url.startsWith("https://")}
              onError={() => markBroken(selected.id)}
            />
          </div>

          {/* Caption in lightbox */}
          {(caption || selected.sourceCredit) && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center max-w-lg px-4">
              {caption && <p className="text-sm text-white/90">{caption}</p>}
              {selected.sourceCredit && (
                <p className="text-xs text-white/50 mt-1">
                  {labels.photoCredit.replace("{credit}", selected.sourceCredit)}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
