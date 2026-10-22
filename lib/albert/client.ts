import type {
  ChatMessage,
  Chunk,
  OCRResponse,
  SearchHit,
  SearchResponse,
} from "./types";

export type AlbertConfig = {
  baseUrl: string;
  apiKey: string;
};

/**
 * Minimal Albert API client. Every method here is server-only: the API key must
 * never be bundled into the browser.
 */
export class AlbertClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: AlbertConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
  }

  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    // FormData bodies must keep the multipart boundary that fetch generates, so
    // only JSON payloads get an explicit Content-Type.
    const isFormData = init.body instanceof FormData;

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(init.body && !isFormData
          ? { "Content-Type": "application/json" }
          : {}),
        ...init.headers,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new AlbertError(
        `Albert ${init.method ?? "GET"} ${path} failed with ${response.status}`,
        response.status,
        detail.slice(0, 500),
      );
    }

    return response;
  }

  async search(params: {
    query: string;
    collectionIds: number[];
    limit?: number;
    method?: "hybrid" | "semantic" | "lexical";
    scoreThreshold?: number;
    signal?: AbortSignal;
  }): Promise<SearchHit[]> {
    const response = await this.request("/v1/search", {
      method: "POST",
      signal: params.signal,
      body: JSON.stringify({
        query: params.query,
        collection_ids: params.collectionIds,
        method: params.method ?? "hybrid",
        limit: params.limit ?? 8,
        ...(params.scoreThreshold === undefined
          ? {}
          : { score_threshold: params.scoreThreshold }),
      }),
    });

    const payload = (await response.json()) as SearchResponse;
    return payload.data ?? [];
  }

  /**
   * Streams an assistant answer. Yields content deltas only; reasoning deltas
   * emitted by models such as gpt-oss-120b are filtered out.
   */
  async *streamChat(params: {
    messages: ChatMessage[];
    model: string;
    temperature?: number;
    signal?: AbortSignal;
  }): AsyncGenerator<string, void, unknown> {
    const response = await this.request("/v1/chat/completions", {
      method: "POST",
      signal: params.signal,
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        stream: true,
        temperature: params.temperature ?? 0.2,
      }),
    });

    if (!response.body) {
      throw new AlbertError("Albert returned an empty stream", 502, "");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Normalise CRLF framing: the SSE spec allows it, and searching for
        // "\n\n" alone would never find a boundary and drop the whole answer.
        buffer += decoder
          .decode(value, { stream: true })
          .replace(/\r\n/g, "\n");

        // SSE frames are separated by a blank line; keep any trailing partial
        // frame in the buffer for the next read.
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const delta = parseSSEFrame(frame);
          if (delta === DONE) return;
          if (delta) yield delta;
          boundary = buffer.indexOf("\n\n");
        }
      }

      buffer += decoder.decode();
      const tail = parseSSEFrame(buffer);
      if (tail && tail !== DONE) yield tail;
    } finally {
      reader.releaseLock();
    }
  }

  async createCollection(params: {
    name: string;
    description?: string;
    visibility?: "public" | "private";
  }): Promise<{ id: number; name: string }> {
    const response = await this.request("/v1/collections", {
      method: "POST",
      body: JSON.stringify({
        name: params.name,
        description: params.description ?? "",
        visibility: params.visibility ?? "public",
      }),
    });
    return (await response.json()) as { id: number; name: string };
  }

  async findCollectionByName(
    name: string,
  ): Promise<{ id: number; name: string } | null> {
    // The listing endpoint is paginated (10 by default); filter server-side so a
    // collection is not missed once the account holds more than one page.
    const response = await this.request(
      `/v1/collections?name=${encodeURIComponent(name)}&limit=100`,
    );
    const payload = (await response.json()) as {
      data?: Array<{ id: number; name: string }>;
    };
    return (payload.data ?? []).find((item) => item.name === name) ?? null;
  }

  /** Creates a document without a file, so its chunks can be supplied by hand. */
  async createDocument(params: {
    name: string;
    collectionId: number;
  }): Promise<{ id: number }> {
    // Albert expects multipart/form-data here, not JSON: the optional `file`
    // part is what distinguishes an upload from a hand-filled document.
    const body = new FormData();
    body.set("collection_id", String(params.collectionId));
    body.set("name", params.name);

    const response = await this.request("/v1/documents", {
      method: "POST",
      body,
    });
    return (await response.json()) as { id: number };
  }

  /** Albert accepts at most 64 chunks per call. */
  async addChunks(
    documentId: number,
    chunks: Array<{ content: string; metadata: Chunk["metadata"] }>,
  ): Promise<void> {
    const BATCH = 64;
    for (let index = 0; index < chunks.length; index += BATCH) {
      await this.request(`/v1/documents/${documentId}/chunks`, {
        method: "POST",
        body: JSON.stringify({
          chunks: chunks.slice(index, index + BATCH).map((chunk) => ({
            content: chunk.content,
            metadata: chunk.metadata ?? {},
          })),
        }),
      });
    }
  }

  async getDocumentChunks(documentId: number): Promise<Chunk[]> {
    const response = await this.request(`/v1/documents/${documentId}/chunks`);
    const payload = (await response.json()) as { data?: Chunk[] };
    return payload.data ?? [];
  }

  async ocr(params: {
    documentUrl: string;
    model?: string;
  }): Promise<OCRResponse> {
    const response = await this.request("/v1/ocr", {
      method: "POST",
      body: JSON.stringify({
        model: params.model ?? "mistral-ocr-2512",
        document: { type: "document_url", document_url: params.documentUrl },
      }),
    });
    return (await response.json()) as OCRResponse;
  }
}

export class AlbertError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(message: string, status: number, detail: string) {
    super(message);
    this.name = "AlbertError";
    this.status = status;
    this.detail = detail;
  }
}

const DONE = Symbol("sse-done");

function parseSSEFrame(frame: string): string | null | typeof DONE {
  let result: string | null | typeof DONE = null;

  for (const line of frame.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data) continue;
    if (data === "[DONE]") return DONE;

    let payload: {
      choices?: Array<{
        delta?: { content?: string | null; reasoning?: string | null };
      }>;
    };
    try {
      payload = JSON.parse(data);
    } catch {
      continue;
    }

    const content = payload.choices?.[0]?.delta?.content;
    if (content) result = (result === null ? "" : result) + content;
  }

  return result;
}
