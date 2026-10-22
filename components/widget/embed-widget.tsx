"use client";

import { useCallback, useEffect } from "react";
import { AssistantModal } from "./assistant-modal";
import { EMBED_MESSAGE_SOURCE, type EmbedResizeMessage } from "@/lib/embed-bridge";

/**
 * Widget entry point for the /embed route. It reports its collapsed/expanded
 * state to the parent document so the host can size the iframe.
 */
export function EmbedWidget() {
  const announce = useCallback((open: boolean) => {
    if (typeof window === "undefined" || window.parent === window) return;

    const message: EmbedResizeMessage = {
      source: EMBED_MESSAGE_SOURCE,
      type: "resize",
      open,
    };
    window.parent.postMessage(message, "*");
  }, []);

  useEffect(() => {
    announce(false);
  }, [announce]);

  return <AssistantModal onOpenChange={announce} />;
}
