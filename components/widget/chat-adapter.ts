"use client";

import type { ChatModelAdapter, ThreadMessage } from "@assistant-ui/react";
import { LIMITS } from "@/lib/config";
import type { Citation } from "@/lib/rag/citations";
import type { StreamEvent } from "@/lib/rag/stream-protocol";

type ContentPart =
  | { type: "text"; text: string }
  | {
      type: "source";
      sourceType: "url";
      id: string;
      url: string;
      title?: string;
    };

export type WidgetRunResult = {
  content: ContentPart[];
  metadata?: Record<string, unknown>;
};

/** Extracts the plain text of a thread message, ignoring citations and tools. */
export function messageToText(message: ThreadMessage): string {
  return message.content
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .join("\n")
    .trim();
}

/**
 * Collects the earlier turns of the thread, excluding the message currently
 * being answered (the last one), which travels as `question`. The result is
 * capped at the same bound the server validates, so a long conversation keeps
 * working instead of failing the schema on every later turn.
 */
export function collectHistory(messages: readonly ThreadMessage[]) {
  return messages
    .slice(0, -1)
    .filter(
      (message): message is ThreadMessage & { role: "user" | "assistant" } =>
        message.role === "user" || message.role === "assistant",
    )
    .map((message) => ({ role: message.role, content: messageToText(message) }))
    .filter((message) => message.content.length > 0)
    .slice(-LIMITS.maxHistoryEntries);
}

export function citationsToParts(citations: Citation[]): ContentPart[] {
  return citations.map((citation) => ({
    type: "source" as const,
    sourceType: "url" as const,
    id: citation.id,
    url: citation.url,
    title:
      citation.page === null
        ? citation.title
        : `${citation.title} — page ${citation.page}`,
  }));
}

/**
 * Streams the answer from /api/chat and yields cumulative assistant content:
 * the citation parts first, then the growing answer text.
 */
export async function* runChat(params: {
  question: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  signal?: AbortSignal;
}): AsyncGenerator<WidgetRunResult, void, unknown> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: params.question, history: params.history }),
    signal: params.signal,
  });

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    let detail = "";
    try {
      const parsed = JSON.parse(body) as { error?: string };
      detail = parsed.error ?? "";
    } catch {
      detail = "";
    }
    throw new Error(
      detail || `Le service a renvoyé ${response.status}.`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sources: ContentPart[] = [];
  let answer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
        if (!line) continue;

        let event: StreamEvent;
        try {
          event = JSON.parse(line) as StreamEvent;
        } catch {
          // A truncated or injected line must not kill the answer in progress.
          continue;
        }

        if (event.type === "sources") {
          sources = citationsToParts(event.sources);
          yield { content: [...sources] };
        } else if (event.type === "delta") {
          answer += event.text;
          yield { content: [...sources, { type: "text", text: answer }] };
        } else if (event.type === "error") {
          throw new Error(event.message);
        } else if (event.type === "done") {
          return;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { content: [...sources, { type: "text", text: answer }] };
}

/** assistant-ui adapter wrapping the streaming fetcher above. */
export const chatModelAdapter: ChatModelAdapter = {
  async run({ messages, abortSignal }) {
    const latest = messages[messages.length - 1];
    const question = latest ? messageToText(latest) : "";

    if (!question) {
      return { content: [{ type: "text", text: "Posez une question." }] };
    }

    const history = collectHistory(messages);

    let last: WidgetRunResult | undefined;
    for await (const update of runChat({
      question,
      history,
      signal: abortSignal,
    })) {
      last = update;
    }

    return last ?? { content: [{ type: "text", text: "" }] };
  },
};
