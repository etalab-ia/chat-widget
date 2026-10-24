"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    __anssiWidget?: {
      mount: () => void;
      destroy: () => void;
    };
  }
}

/**
 * Uses the public loader so the demo exercises exactly the integration offered
 * to host pages, rather than maintaining a second iframe and resize bridge.
 */
export function EmbedFrame() {
  const active = useRef(false);

  useEffect(() => {
    active.current = true;
    // This call covers a cached next/script on a later mount. The onReady path
    // covers the initial load; both are idempotent.
    window.__anssiWidget?.mount();
    return () => {
      active.current = false;
      window.__anssiWidget?.destroy();
    };
  }, []);

  return (
    <Script
      src="/embed.js"
      strategy="afterInteractive"
      referrerPolicy="strict-origin-when-cross-origin"
      data-anssi-auto-mount="false"
      onReady={() => {
        // A script that finishes downloading after unmount must not recreate
        // the widget. Plain host script tags keep the default auto-mount.
        if (active.current) window.__anssiWidget?.mount();
      }}
    />
  );
}
