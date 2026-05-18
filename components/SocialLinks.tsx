import type { ReactNode } from "react";

/**
 * SocialLinks — renders a victim's online presence as small icon buttons.
 *
 * Server component (no client interactivity needed).
 *
 * For each present field, the anchor uses `rel="me noopener noreferrer"` so
 * Mastodon / Bluesky / IndieAuth can verify these as the same person's
 * profiles. Empty input → returns null (no empty row).
 */

type SocialField =
  | "instagramHandle"
  | "xHandle"
  | "linkedinUrl"
  | "githubHandle"
  | "telegramHandle"
  | "facebookUrl"
  | "youtubeChannelUrl"
  | "websiteUrl";

type VictimSocials = Partial<Record<SocialField, string | null | undefined>>;

interface LinkDef {
  key: SocialField;
  label: string;
  buildHref: (raw: string) => string;
  icon: ReactNode;
}

// Minimal Heroicons-style 16x16 inline SVGs. `currentColor` so the parent
// hover state can flip the color (memorial-400 → gold-400).
const ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true,
} as const;

const LINKS: LinkDef[] = [
  {
    key: "instagramHandle",
    label: "Instagram",
    buildHref: (h) => `https://www.instagram.com/${stripAt(h)}`,
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 2.2c3.2 0 3.6 0 4.8.07 1.2.06 1.8.25 2.2.41.6.22 1 .48 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c0 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2 0-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2-.1-1.2-.1-1.6-.1-4.8s0-3.6.1-4.8c0-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.2-.1 1.6-.1 4.8-.1zm0 2c-3.2 0-3.5 0-4.7.07-1.1.06-1.7.24-2.1.4-.5.2-.9.5-1.3.9-.4.4-.6.7-.8 1.3-.2.4-.3 1-.4 2.1-.1 1.2-.1 1.5-.1 4.7s0 3.5.1 4.7c.1 1.1.2 1.7.4 2.1.2.5.4.9.8 1.3.4.4.7.6 1.3.8.4.2 1 .3 2.1.4 1.2.1 1.5.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.4 1.3-.8.4-.4.6-.8.8-1.3.2-.4.3-1 .4-2.1.1-1.2.1-1.5.1-4.7s0-3.5-.1-4.7c-.1-1.1-.2-1.7-.4-2.1-.2-.5-.4-.9-.8-1.3-.4-.4-.8-.7-1.3-.9-.4-.2-1-.3-2.1-.4-1.2-.1-1.5-.1-4.7-.1zm0 3.4a4.4 4.4 0 110 8.8 4.4 4.4 0 010-8.8zm0 7.2a2.8 2.8 0 100-5.6 2.8 2.8 0 000 5.6zm5.6-7.4a1 1 0 11-2.1 0 1 1 0 012.1 0z" />
      </svg>
    ),
  },
  {
    key: "xHandle",
    label: "X (Twitter)",
    buildHref: (h) => `https://x.com/${stripAt(h)}`,
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.819-5.969 6.819H1.677l7.73-8.834L1.254 2.25h6.83l4.713 6.231 5.447-6.231zm-1.16 17.52h1.832L7.084 4.126H5.117L17.083 19.77z" />
      </svg>
    ),
  },
  {
    key: "linkedinUrl",
    label: "LinkedIn",
    buildHref: (raw) => raw,
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.4v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 11-.01-4.12 2.06 2.06 0 01.01 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.77-.77 1.77-1.72V1.72C24 .77 23.2 0 22.22 0z" />
      </svg>
    ),
  },
  {
    key: "githubHandle",
    label: "GitHub",
    buildHref: (h) => `https://github.com/${stripAt(h)}`,
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11 11 0 015.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.77.12 3.06.73.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.06.78 2.14v3.18c0 .31.21.68.8.56A11.5 11.5 0 0023.5 12C23.5 5.65 18.35.5 12 .5z" />
      </svg>
    ),
  },
  {
    key: "telegramHandle",
    label: "Telegram",
    buildHref: (h) => `https://t.me/${stripAt(h)}`,
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M9.78 18.65l.28-4.23 7.7-6.93c.34-.31-.07-.46-.52-.19L7.74 13.5 3.64 12.2c-.88-.25-.89-.86.2-1.27l16-6.16c.74-.27 1.43.17 1.16 1.27l-2.73 12.81c-.18.85-.7 1.05-1.42.66l-3.85-2.84-1.85 1.78c-.21.21-.39.39-.78.39z" />
      </svg>
    ),
  },
  {
    key: "facebookUrl",
    label: "Facebook",
    buildHref: (raw) => raw,
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M22.68 0H1.32C.59 0 0 .59 0 1.32v21.36c0 .73.59 1.32 1.32 1.32h11.49v-9.3H9.69V10.9h3.12V8.24c0-3.1 1.89-4.79 4.66-4.79 1.33 0 2.46.1 2.79.14v3.24h-1.92c-1.5 0-1.79.71-1.79 1.76v2.31h3.59l-.47 3.79h-3.12V24h6.13c.73 0 1.32-.59 1.32-1.32V1.32C24 .59 23.41 0 22.68 0z" />
      </svg>
    ),
  },
  {
    key: "youtubeChannelUrl",
    label: "YouTube",
    buildHref: (raw) => raw,
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
      </svg>
    ),
  },
  {
    key: "websiteUrl",
    label: "Website",
    buildHref: (raw) => raw,
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm6.93 6h-2.95a15.65 15.65 0 00-1.38-3.56A8.03 8.03 0 0118.93 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14a7.82 7.82 0 010-4h3.38a16.6 16.6 0 000 4H4.26zm.81 2h2.95a15.65 15.65 0 001.38 3.56A8 8 0 015.07 16zm2.95-8H5.07a8 8 0 014.33-3.56A15.65 15.65 0 008.02 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82A12.45 12.45 0 0112 19.96zM14.34 14H9.66a14.05 14.05 0 010-4h4.68a14.05 14.05 0 010 4zm.26 5.56A15.65 15.65 0 0015.98 16h2.95a8.03 8.03 0 01-4.33 3.56zM16.36 14a16.6 16.6 0 000-4h3.38a7.82 7.82 0 010 4h-3.38z" />
      </svg>
    ),
  },
];

function stripAt(raw: string): string {
  return raw.replace(/^@/, "").trim();
}

export function SocialLinks({ victim }: { victim: VictimSocials }) {
  const present = LINKS.filter((l) => {
    const v = victim?.[l.key];
    return typeof v === "string" && v.trim().length > 0;
  });

  if (present.length === 0) return null;

  return (
    <ul className="mt-4 flex flex-wrap items-center gap-2">
      {present.map((l) => {
        const raw = (victim[l.key] as string).trim();
        const href = l.buildHref(raw);
        return (
          <li key={l.key}>
            <a
              href={href}
              target="_blank"
              rel="me noopener noreferrer"
              aria-label={l.label}
              title={l.label}
              className="group inline-flex items-center justify-center h-8 w-8 rounded-full border border-memorial-700/60 bg-memorial-900/40 text-memorial-400 hover:text-gold-400 hover:border-gold-500/40 transition-colors"
            >
              {l.icon}
              <span className="sr-only">{l.label}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export default SocialLinks;
