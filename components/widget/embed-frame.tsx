"use client";

import { useEffect, useRef, useState } from "react";
import {
  COLLAPSED_SIZE,
  EXPANDED_SIZE,
  isEmbedResizeMessage,
  originOf,
} from "@/lib/embed-bridge";

/**
 * Loads the widget through an iframe so the demo page exercises the same
 * integration path the intranet will use. The frame is sized to the widget's
 * announced state, since an iframe cannot shrink to its content.
 */
export function EmbedFrame() {
  const [open, setOpen] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current;
      if (!frame) return;
      // Two independent checks: the message must come from this frame, and from
      // the origin the frame was loaded from. `event.source` alone already
      // identifies the window; the origin check costs nothing and still holds
      // if the frame is ever pointed at another host.
      if (event.source !== frame.contentWindow) return;
      if (event.origin !== originOf(frame.src, window.location.href)) return;
      if (!isEmbedResizeMessage(event.data)) return;
      setOpen(event.data.open);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const size = open ? EXPANDED_SIZE : COLLAPSED_SIZE;

  return (
    <iframe
      ref={frameRef}
      src="/embed"
      title="Assistant ANSSI"
      // The widget runs scripts and fetches its own API, so it needs
      // `allow-same-origin`; it opens citation PDFs in a new tab, so it needs
      // popups. Everything else stays off: no top-level navigation, no forms,
      // no downloads, no modals.
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      // Same-origin frames inherit the parent's permissions, so the sensitive
      // ones are refused here rather than assumed. The rest of the list is
      // refused by the service's own `Permissions-Policy` header, which is what
      // protects the same snippet pasted on another site.
      allow="camera 'none'; microphone 'none'; geolocation 'none'"
      referrerPolicy="strict-origin-when-cross-origin"
      className="fixed right-4 bottom-4 z-40 border-0 bg-transparent"
      style={{
        width: size.width,
        height: size.height,
        transition: "width 160ms ease, height 160ms ease",
      }}
    />
  );
}
