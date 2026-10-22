import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StreamEvent } from "@/lib/rag/stream-protocol";

const SEARCH_RESPONSE = {
  data: [
    {
      method: "hybrid",
      score: 0.9,
      chunk: {
        id: 1,
        collection_id: 10,
        document_id: 20,
        content: "La MFA repose sur deux facteurs de catégories différentes.",
        metadata: {
          page: 12,
          guide_title: "Guide MFA",
          source_url: "https://example.org/mfa.pdf",
        },
      },
    },
    {
      method: "hybrid",
      score: 0.5,
      chunk: {
        id: 2,
        collection_id: 10,
        document_id: 20,
        content: "Second extrait de la même page.",
        metadata: {
          page: 12,
          guide_title: "Guide MFA",
          source_url: "https://example.org/mfa.pdf",
        },
      },
    },
  ],
};

function sseBody(parts: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
}

async function readEvents(response: Response): Promise<StreamEvent[]> {
  const text = await response.text();
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as StreamEvent);
}

function postRequest(body: unknown, init: RequestInit = {}) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...init,
  });
}

beforeEach(() => {
  process.env.ALBERT_API_KEY = "sk-test";
  process.env.ALBERT_COLLECTION_FR = "10";
  process.env.ALBERT_COLLECTION_EN = "11";
  delete process.env.ALBERT_CHAT_MODEL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/chat", () => {
  it("rejects an invalid body before calling Albert", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/chat/route");
    const response = await POST(postRequest({ question: "" }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("streams sources first, then the answer, then done", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        call += 1;
        if (String(url).endsWith("/v1/search")) {
          return Promise.resolve(Response.json(SEARCH_RESPONSE));
        }
        return Promise.resolve(
          new Response(
            sseBody([
              'data: {"choices":[{"delta":{"reasoning":"je reflechis"}}]}\n\n',
              'data: {"choices":[{"delta":{"content":"La MFA "}}]}\n\n',
              'data: {"choices":[{"delta":{"content":"est requise [1]."}}]}\n\n',
              "data: [DONE]\n\n",
            ]),
            { status: 200 },
          ),
        );
      }),
    );

    const { POST } = await import("@/app/api/chat/route");
    const response = await POST(postRequest({ question: "MFA ?" }));
    const events = await readEvents(response);

    expect(call).toBe(2);
    expect(events[0].type).toBe("sources");
    expect(events[events.length - 1].type).toBe("done");

    const answer = events
      .filter((event): event is Extract<StreamEvent, { type: "delta" }> => event.type === "delta")
      .map((event) => event.text)
      .join("");

    expect(answer).toBe("La MFA est requise [1].");
    expect(answer).not.toContain("reflechis");
  });

  it("emits one source per cited page so marker N addresses source N", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (String(url).endsWith("/v1/search")) {
          return Promise.resolve(Response.json(SEARCH_RESPONSE));
        }
        return Promise.resolve(
          new Response(sseBody(["data: [DONE]\n\n"]), { status: 200 }),
        );
      }),
    );

    const { POST } = await import("@/app/api/chat/route");
    const response = await POST(postRequest({ question: "MFA ?" }));
    const [sources] = await readEvents(response);

    expect(sources.type).toBe("sources");
    if (sources.type !== "sources") throw new Error("unreachable");

    // Both chunks come from page 12: one source, not two.
    expect(sources.sources).toHaveLength(1);
    expect(sources.sources[0].page).toBe(12);
    expect(sources.sources[0].url).toBe("https://example.org/mfa.pdf#page=12");
  });

  it("reports an upstream failure as an error event instead of failing the request", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"detail":"boom"}', { status: 500 }),
      ),
    );

    const { POST } = await import("@/app/api/chat/route");
    const response = await POST(postRequest({ question: "MFA ?" }));
    const events = await readEvents(response);

    expect(response.status).toBe(200);
    expect(events.at(-1)?.type).toBe("error");
  });

  it("stays silent when the client cancels the stream mid-answer", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    let chatStarted = false;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (String(url).endsWith("/v1/search")) {
          return Promise.resolve(Response.json(SEARCH_RESPONSE));
        }
        chatStarted = true;
        // An endless-ish stream: the handler must stop on abort, not drain it.
        const encoder = new TextEncoder();
        return Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                for (let index = 0; index < 50; index += 1) {
                  controller.enqueue(
                    encoder.encode(
                      `data: {"choices":[{"delta":{"content":"mot${index} "}}]}\n\n`,
                    ),
                  );
                }
                controller.close();
              },
            }),
            { status: 200 },
          ),
        );
      }),
    );

    const { POST } = await import("@/app/api/chat/route");
    const response = await POST(postRequest({ question: "MFA ?" }));

    const reader = response.body!.getReader();
    await reader.read();

    // This is what the runtime does when the browser goes away: the consumer
    // cancels, and any later enqueue on the controller throws.
    await reader.cancel();
    // Give the handler's pending iterations a chance to run and fail.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(chatStarted).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
