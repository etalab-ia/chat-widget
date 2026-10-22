import { AlbertClient } from "@/lib/albert/client";
import { loadConfig, LIMITS } from "@/lib/config";
import { buildContextBlocks, toCitations } from "@/lib/rag/citations";
import { buildChatMessages } from "@/lib/rag/prompt";
import { chatRequestSchema, encodeEvent } from "@/lib/rag/stream-protocol";

export async function POST(request: Request) {
  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return Response.json(
      { error: "Question invalide.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error("[api/chat] configuration error", error);
    return Response.json(
      { error: "Le service n'est pas configuré correctement." },
      { status: 500 },
    );
  }

  const client = new AlbertClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
  });

  const encoder = new TextEncoder();
  const { question, history } = parsed.data;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Parameters<typeof encodeEvent>[0]) => {
        controller.enqueue(encoder.encode(encodeEvent(event)));
      };

      try {
        const hits = await client.search({
          query: question,
          collectionIds: config.collectionIds,
          limit: LIMITS.searchResults,
          method: "hybrid",
        });

        const blocks = buildContextBlocks(hits);
        send({ type: "sources", sources: toCitations(hits) });

        const messages = buildChatMessages({ question, blocks, history });

        for await (const delta of client.streamChat({
          messages,
          model: config.chatModel,
        })) {
          send({ type: "delta", text: delta });
        }

        send({ type: "done" });
      } catch (error) {
        console.error("[api/chat] upstream error", error);
        send({
          type: "error",
          message:
            "La recherche ou la génération a échoué. Réessayez dans un instant.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
