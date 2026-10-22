"use client";

import { useAuiState } from "@assistant-ui/react";
import { DocumentIcon } from "./icons";

/**
 * Renders the URL sources attached to an assistant message as a compact
 * citation list. Each entry opens the source PDF at the cited page.
 */
export function MessageSources() {
  // The selector must return a value the store already holds. Building a new
  // array inside the selector makes every read look changed and React loops.
  const role = useAuiState((state) => state.message.role);
  const parts = useAuiState((state) => state.message.parts);

  const sources =
    role === "assistant"
      ? parts.filter(
          (part) => part.type === "source" && part.sourceType === "url",
        )
      : [];

  if (sources.length === 0) return null;

  const links = sources.map((part, index) => ({
    key: `${part.type === "source" ? part.id : index}-${index}`,
    url: part.type === "source" && part.sourceType === "url" ? part.url : "",
    title:
      part.type === "source" && part.sourceType === "url"
        ? (part.title ?? "Document ANSSI")
        : "Document ANSSI",
  }));

  return (
    <div className="mt-3 border-t border-slate-200 pt-2.5">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        Sources
      </p>
      <ul className="flex flex-col gap-1">
        {links.map((link, index) => (
          <li key={link.key}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-1.5 rounded-sm text-[12.5px] leading-snug text-slate-600 underline-offset-2 hover:text-[#000091] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000091]"
            >
              <DocumentIcon className="mt-0.5 size-3.5 shrink-0 text-slate-400 group-hover:text-[#000091]" />
              <span>
                <span className="font-medium text-slate-500">
                  [{index + 1}]
                </span>{" "}
                {link.title}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
