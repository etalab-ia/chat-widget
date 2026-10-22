"use client";

import { useEffect, useRef, useState } from "react";
import {
  COLLAPSED_SIZE,
  EXPANDED_SIZE,
  isEmbedResizeMessage,
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
      if (event.source !== frameRef.current?.contentWindow) return;
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
      allow="clipboard-write"
      className="fixed right-4 bottom-4 z-40 border-0 bg-transparent"
      style={{
        width: size.width,
        height: size.height,
        transition: "width 160ms ease, height 160ms ease",
      }}
    />
  );
}
