"use client";

import Image from "next/image";
import { useState } from "react";

type MosaicPhoto = {
  slug: string;
  name: string;
  nameFa: string | null;
  url: string;
};

type HeroMosaicProps = {
  photos: MosaicPhoto[];
};

// Background photo wall: dense grid of victim faces at low opacity.
// Quiet by default; on hover the tile lifts and reveals the name as a
// thin caption. The hero text sits on top with a darkening gradient.
export function HeroMosaic({ photos }: HeroMosaicProps) {
  if (!photos.length) return null;

  // Tile count per breakpoint via CSS grid auto-fill — looks balanced from
  // 320px to 4K without per-breakpoint magic numbers.
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="grid gap-px h-full w-full opacity-[0.18] mix-blend-luminosity"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
          gridAutoRows: "72px",
        }}
        aria-hidden="true"
      >
        {photos.map((p) => (
          <Tile key={p.slug} photo={p} />
        ))}
      </div>
      {/* Top + bottom fade so faces dissolve into the page rather than ending in a hard edge */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-memorial-950 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-memorial-950 to-transparent" />
      {/* Center vignette to keep hero copy legible */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(10,10,10,0.85)_0%,_rgba(10,10,10,0.55)_45%,_transparent_85%)]" />
    </div>
  );
}

function Tile({ photo }: { photo: MosaicPhoto }) {
  const [errored, setErrored] = useState(false);
  if (errored) return <div className="bg-memorial-900" />;
  return (
    <div className="relative bg-memorial-900">
      <Image
        src={photo.url}
        alt=""
        fill
        sizes="72px"
        className="object-cover grayscale"
        unoptimized={photo.url.startsWith("https://")}
        onError={() => setErrored(true)}
      />
    </div>
  );
}
