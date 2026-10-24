import Script from "next/script";

/**
 * Uses the public loader so the demo exercises exactly the integration offered
 * to host pages, rather than maintaining a second iframe and resize bridge.
 */
export function EmbedFrame() {
  return <Script src="/embed.js" strategy="afterInteractive" />;
}
