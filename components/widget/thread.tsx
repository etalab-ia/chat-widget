"use client";

import {
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import { useMemo } from "react";
import { parseAnswer, parseSpans, type AnswerSource } from "@/lib/render-answer";
import { ChatIcon, SendIcon, StopIcon } from "./icons";

/**
 * The sources attached to the assistant message being rendered, indexed by
 * their marker so "[2]" can link straight to the page it refers to.
 */
function useAnswerSources(): ReadonlyMap<number, AnswerSource> {
  const parts = useAuiState((state) => state.message.parts);

  return useMemo(() => {
    const index = new Map<number, AnswerSource>();
    for (const part of parts) {
      if (part.type !== "source" || part.sourceType !== "url") continue;
      const source = part as {
        marker?: number;
        url?: string;
        page?: number | null;
      };
      if (typeof source.marker !== "number" || typeof source.url !== "string") {
        continue;
      }
      index.set(source.marker, {
        marker: source.marker,
        url: source.url,
        page: source.page ?? null,
      });
    }
    return index;
  }, [parts]);
}

const SUGGESTIONS = [
  "Quelles sont les recommandations pour segmenter un réseau ?",
  "Comment gérer une crise cyber ?",
  "Que recommande l'ANSSI sur l'authentification multifacteur ?",
];

export function WidgetThread() {
  return (
    <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col bg-white">
      {/* The reader starts at the first line of the answer, not at its last.
          `turnAnchor="top"` anchors the turn at the top of the viewport, and the
          three "scroll to bottom" defaults are switched off: on run start they
          scrolled straight past the beginning of the answer, which is the
          behaviour they are meant to prevent here. */}
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        autoScroll={false}
        scrollToBottomOnRunStart={false}
        scrollToBottomOnInitialize={false}
        scrollToBottomOnThreadSwitch={false}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4"
      >
        <AuiIf condition={(state) => state.thread.isEmpty}>
          <EmptyState />
        </AuiIf>

        <ThreadPrimitive.Messages
          components={{ UserMessage, AssistantMessage }}
        />
      </ThreadPrimitive.Viewport>

      <Composer />
    </ThreadPrimitive.Root>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4 py-6">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#000091] text-white">
            <ChatIcon className="size-4" />
          </span>
          <p className="text-[15px] font-semibold text-slate-900">
            Assistant ANSSI
          </p>
        </div>
        <p className="text-[13px] leading-relaxed text-slate-600">
          Posez une question sur les guides publics de l&apos;ANSSI. Les
          réponses citent les documents et les pages utilisés.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        {SUGGESTIONS.map((suggestion) => (
          <ThreadPrimitive.Suggestion
            key={suggestion}
            prompt={suggestion}
            send
            className="rounded-md border border-slate-200 px-3 py-2 text-left text-[12.5px] leading-snug text-slate-700 transition-colors hover:border-[#000091]/40 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000091]"
          >
            {suggestion}
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
}

function UserMessage() {
  return (
    <div className="mb-3 flex justify-end">
      <div className="max-w-[85%] rounded-lg rounded-br-sm bg-[#000091] px-3 py-2 text-[13px] leading-relaxed text-white">
        <MessagePrimitive.Parts components={{ Text: PlainText }} />
      </div>
    </div>
  );
}

function PlainText({ text }: { text: string }) {
  return <p className="whitespace-pre-line">{text}</p>;
}

function AssistantMessage() {
  const sources = useAnswerSources();
  const answer = useAuiState((state) =>
    state.message.parts
      .filter((part) => part.type === "text")
      .map((part) => (part.type === "text" ? part.text : ""))
      .join(" "),
  );

  // Citations are rendered inside the sentences that use them. If an answer
  // arrives with no marker at all, the sources would have nowhere to appear and
  // could not be checked, so they are listed once as a fallback.
  const citesInline = parseSpans(answer, sources).some(
    (span) => span.kind === "citation",
  );

  return (
    <div className="mb-4 max-w-full">
      <div className="text-[13px] leading-relaxed text-slate-800">
        <MessagePrimitive.Parts
          components={{
            Text: (props) => <AnswerText {...props} sources={sources} />,
            Source: () => null,
            Image: () => null,
            File: () => null,
          }}
        />
        <WaitingDots />
      </div>
      {!citesInline && answer.trim().length > 0 ? (
        <FallbackSources sources={sources} />
      ) : null}
    </div>
  );
}

/** Lists the sources when the answer cited none of them inline. */
function FallbackSources({
  sources,
}: {
  sources: ReadonlyMap<number, AnswerSource>;
}) {
  if (sources.size === 0) return null;

  return (
    <div className="mt-3 border-t border-slate-200 pt-2.5">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        Sources
      </p>
      <ul className="flex flex-col gap-1">
        {[...sources.values()].map((source) => (
          <li key={source.marker}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-1.5 rounded-sm text-[12.5px] leading-snug text-slate-600 hover:text-[#000091] hover:underline"
            >
              <span className="font-medium text-slate-500">
                [{source.marker}]
              </span>
              <span>
                {source.page === null ? "Ouvrir le document" : `Page ${source.page}`}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnswerText({
  text,
  sources,
}: {
  text: string;
  sources: ReadonlyMap<number, AnswerSource>;
}) {
  if (!text) return null;

  const blocks = parseAnswer(text);

  return (
    <div className="flex flex-col gap-1.5">
      {blocks.map((block, index) => {
        if (block.kind === "bullet") {
          return (
            <div key={index} className="flex gap-2 pl-0.5">
              <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-slate-400" />
              <p className="flex-1">
                <InlineText text={block.text} sources={sources} />
              </p>
            </div>
          );
        }

        if (block.kind === "ordered") {
          return (
            <div key={index} className="flex gap-2 pl-0.5">
              <span className="shrink-0 tabular-nums text-slate-500">
                {block.number}.
              </span>
              <p className="flex-1">
                <InlineText text={block.text} sources={sources} />
              </p>
            </div>
          );
        }

        return (
          <p key={index} className="whitespace-pre-line">
            <InlineText text={block.text} sources={sources} />
          </p>
        );
      })}
    </div>
  );
}

/**
 * Renders one block of answer text, turning citation markers into links to the
 * cited page. The marker keeps the "[n]" shape so the reader can still see
 * which source a sentence comes from.
 */
function InlineText({
  text,
  sources,
}: {
  text: string;
  sources: ReadonlyMap<number, AnswerSource>;
}) {
  const spans = parseSpans(text, sources);

  if (spans.length === 0) return <>{text}</>;

  return (
    <>
      {spans.map((span, index) => {
        if (span.kind === "text") return <span key={index}>{span.text}</span>;

        const where =
          span.page === null ? "le document cité" : `la page ${span.page}`;

        return (
          <a
            key={index}
            href={span.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Ouvrir ${where}`}
            aria-label={`Source ${span.marker}, ouvrir ${where}`}
            className="ml-0.5 inline-flex items-center rounded-sm bg-[#000091]/8 px-1 text-[11.5px] font-medium text-[#000091] no-underline transition-colors hover:bg-[#000091] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000091]"
          >
            {span.marker}
          </a>
        );
      })}
    </>
  );
}

function WaitingDots() {
  const isRunning = useAuiState(
    (state) => state.message.status?.type === "running",
  );
  const hasText = useAuiState((state) =>
    state.message.parts.some(
      (part) => part.type === "text" && part.text.trim().length > 0,
    ),
  );

  if (!isRunning || hasText) return null;

  return (
    <span className="mt-1 flex gap-1" aria-label="Recherche en cours">
      <span className="size-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-pulse rounded-full bg-slate-400" />
    </span>
  );
}

function Composer() {
  return (
    <ComposerPrimitive.Root className="border-t border-slate-200 bg-white p-2.5">
      <div className="flex items-end gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:border-[#000091] focus-within:ring-2 focus-within:ring-[#000091]/15">
        <ComposerPrimitive.Input
          placeholder="Votre question…"
          rows={1}
          maxRows={4}
          className="max-h-24 min-h-8 flex-1 resize-none bg-transparent py-1 text-[13px] leading-relaxed text-slate-900 outline-none placeholder:text-slate-400"
          aria-label="Votre question"
        />
        <AuiIf condition={(state) => state.thread.isRunning}>
          <ComposerPrimitive.Cancel
            className="mb-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000091]"
            aria-label="Arrêter la réponse"
          >
            <StopIcon className="size-3.5" />
          </ComposerPrimitive.Cancel>
        </AuiIf>
        <AuiIf condition={(state) => !state.thread.isRunning}>
          <ComposerPrimitive.Send
            className="mb-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-[#000091] text-white transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000091]"
            aria-label="Envoyer"
          >
            <SendIcon className="size-3.5" />
          </ComposerPrimitive.Send>
        </AuiIf>
      </div>
    </ComposerPrimitive.Root>
  );
}
