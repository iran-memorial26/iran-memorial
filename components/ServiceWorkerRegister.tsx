"use client";

import { useEffect } from "react";

/**
 * Registers the service worker once per session. Lives as a tiny client
 * component because next-intl's [locale]/layout.tsx is a Server Component
 * and cannot call browser APIs directly.
 *
 * The SW (/sw.js) implements network-first for HTML + cache-first for
 * static assets — designed for Iran-side networks with VPN drops and ISP
 * throttling. See public/sw.js for the strategy.
 *
 * Renders nothing.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    // Defer registration until after the page is interactive so the SW
    // install doesn't compete with critical resources on first paint.
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          // Swallow — failed SW registration must never break the page.
          // Common causes: Brave shields, Tor browser, restricted contexts.
          if (typeof console !== "undefined") {
            console.warn("[sw] registration failed", err);
          }
        });
    };
    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  return null;
}
