import type { ReactNode } from "react";
import "../globals.css";

/** Standalone layout for embeddable widgets — no header, footer or i18n shell.
 *  The host page's chrome should never bleed in via inherited styles. */
export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-transparent text-memorial-100 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
