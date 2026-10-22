import { describe, expect, it } from "vitest";
import type { ThreadMessage } from "@assistant-ui/react";
import {
  citationsToParts,
  collectHistory,
  messageToText,
} from "@/components/widget/chat-adapter";
import { LIMITS } from "@/lib/config";

/** Minimal thread message: the adapter only reads `role` and text parts. */
function message(
  role: "user" | "assistant",
  text: string,
  extraParts: unknown[] = [],
): ThreadMessage {
  return {
    id: `${role}-${Math.random()}`,
    role,
    createdAt: new Date(),
    content: [{ type: "text", text }, ...extraParts],
    attachments: [],
    metadata: { unstable_state: null, unstable_annotations: [], unstable_data: [], steps: [], custom: {} },
  } as unknown as ThreadMessage;
}

describe("messageToText", () => {
  it("keeps text parts and ignores citations", () => {
    const text = messageToText(
      message("assistant", "La MFA est requise.", [
        { type: "source", sourceType: "url", id: "x", url: "https://e.org/a.pdf" },
      ]),
    );
    expect(text).toBe("La MFA est requise.");
  });

  it("joins several text parts", () => {
    expect(
      messageToText(
        message("assistant", "premier", [{ type: "text", text: "second" }]),
      ),
    ).toBe("premier\nsecond");
  });
});

describe("collectHistory", () => {
  it("excludes the message being answered", () => {
    const history = collectHistory([
      message("user", "question 1"),
      message("assistant", "réponse 1"),
      message("user", "question 2"),
    ]);
    expect(history).toEqual([
      { role: "user", content: "question 1" },
      { role: "assistant", content: "réponse 1" },
    ]);
  });

  it("drops messages without text", () => {
    const history = collectHistory([
      message("user", "   "),
      message("assistant", "utile"),
      message("user", "question"),
    ]);
    expect(history).toEqual([{ role: "assistant", content: "utile" }]);
  });

  it("keeps the most recent entries when the thread is long", () => {
    const messages = Array.from({ length: 60 }, (_, index) =>
      message(index % 2 === 0 ? "user" : "assistant", `tour ${index}`),
    );
    const history = collectHistory([...messages, message("user", "question")]);

    // Sending more than the server accepts would fail every later turn.
    expect(history).toHaveLength(LIMITS.maxHistoryEntries);
    expect(history[history.length - 1].content).toBe("tour 59");
  });
});

describe("citationsToParts", () => {
  it("renders the page in the link title", () => {
    const parts = citationsToParts([
      {
        id: "1",
        title: "Guide",
        page: 12,
        url: "https://e.org/a.pdf#page=12",
        score: 0.5,
      },
    ]);
    expect(parts).toEqual([
      {
        type: "source",
        sourceType: "url",
        id: "1",
        url: "https://e.org/a.pdf#page=12",
        title: "Guide — page 12",
      },
    ]);
  });

  it("omits the page from the title when it is unknown", () => {
    const [part] = citationsToParts([
      { id: "2", title: "Guide", page: null, url: "https://e.org/a.pdf", score: 0.1 },
    ]);
    expect(part).toMatchObject({ type: "source", title: "Guide" });
  });
});
