"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  src: string | null | undefined;
  alt: string;
  /** Box-sizing: pass the same h/w utilities you'd put on the container. */
  className?: string;
  /** Pass-through to next/image `sizes` for responsive optimization. */
  sizes?: string;
  /** Render as a square <div> with rounded full / no rounding etc. */
  rounded?: "full" | "lg" | "md" | "none";
};

/** Image with a candle fallback. Renders the candle when:
 *   - `src` is null/empty
 *   - the browser failed to load the URL (404, network error, etc.)
 *
 * Use everywhere a victim photo is shown so that broken-image icons never
 * appear in the UI again. The candle uses brand gold for the flame and a
 * desaturated wax body so it reads as a placeholder, not a foreground icon.
 */
export function MemorialPhoto({
  src,
  alt,
  className = "",
  sizes = "64px",
  rounded = "full",
}: Props) {
  const [errored, setErrored] = useState(false);
  const showImage = src && !errored;
  const radius = {
    full: "rounded-full",
    lg: "rounded-lg",
    md: "rounded-md",
    none: "",
  }[rounded];

  return (
    <div
      className={`relative bg-memorial-800/80 overflow-hidden flex items-center justify-center ${radius} ${className}`}
    >
      {showImage ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover"
          unoptimized={src.startsWith("https://")}
          onError={() => setErrored(true)}
        />
      ) : (
        <CandleIcon />
      )}
    </div>
  );
}

function CandleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-1/2 h-1/2 text-memorial-600"
      fill="none"
      aria-hidden="true"
    >
      {/* Flame */}
      <path
        d="M12 3c1.6 1.8 2.4 3.3 2.4 4.6 0 1.7-1.07 2.6-2.4 2.6S9.6 9.3 9.6 7.6C9.6 6.3 10.4 4.8 12 3z"
        fill="currentColor"
        className="text-gold-400/80 candle-flicker"
      />
      {/* Wick */}
      <line
        x1="12"
        y1="10"
        x2="12"
        y2="12.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Candle body */}
      <rect
        x="9"
        y="12"
        width="6"
        height="8"
        rx="0.8"
        fill="currentColor"
        opacity="0.85"
      />
      {/* Holder */}
      <rect
        x="7.5"
        y="20"
        width="9"
        height="1.4"
        rx="0.4"
        fill="currentColor"
      />
    </svg>
  );
}
