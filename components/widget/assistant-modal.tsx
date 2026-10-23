"use client";

import { AssistantRuntimeProvider, useLocalRuntime } from "@assistant-ui/react";
import { AssistantModalPrimitive } from "@assistant-ui/react";
import { useState } from "react";
import { chatModelAdapter } from "./chat-adapter";
import { WidgetThread } from "./thread";
import { ChatIcon, CloseIcon } from "./icons";

/**
 * Floating chat widget. The thread is the only surface: no conversation list,
 * no history browser.
 */
export function AssistantModal({
  onOpenChange,
}: {
  onOpenChange?: (open: boolean) => void;
}) {
  const runtime = useLocalRuntime(chatModelAdapter);
  const [open, setOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AssistantModalPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <AssistantModalPrimitive.Anchor className="fixed right-4 bottom-4 z-50">
          <AssistantModalPrimitive.Trigger
            className="flex size-12 items-center justify-center rounded-full bg-[#000091] text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000091] aria-expanded:bg-[#1212ff]"
            aria-label="Ouvrir l'assistant ANSSI"
          >
            <ChatIcon className="size-5" />
          </AssistantModalPrimitive.Trigger>
        </AssistantModalPrimitive.Anchor>

        <AssistantModalPrimitive.Content
          side="top"
          align="end"
          sideOffset={12}
          className="z-50 flex h-[min(560px,calc(100dvh-6rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl outline-none data-[state=closed]:hidden"
        >
          <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#000091] text-white">
                <ChatIcon className="size-3.5" />
              </span>
              <p className="truncate text-[13px] font-semibold text-slate-900">
                Assistant ANSSI
              </p>
            </div>
            <AssistantModalPrimitive.Trigger
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000091]"
              aria-label="Fermer l'assistant"
            >
              <CloseIcon className="size-4" />
            </AssistantModalPrimitive.Trigger>
          </header>

          <div className="flex min-h-0 flex-1 flex-col">
            <WidgetThread />
          </div>
        </AssistantModalPrimitive.Content>
      </AssistantModalPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
