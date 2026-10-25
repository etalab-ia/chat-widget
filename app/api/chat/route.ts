import { AlbertClient } from "@/lib/albert/client";
import { ABUSE_LIMITS, type AppConfig, LIMITS, loadConfig } from "@/lib/config";
import { blocksToSources, buildContextBlocks } from "@/lib/rag/citations";
import { buildChatMessages } from "@/lib/rag/prompt";
import { chatRequestSchema, encodeEvent } from "@/lib/rag/stream-protocol";
import { clientKey, FixedWindowLimiter } from "@/lib/rate-limit";

// Process-wide, so the counters survive across requests within one instance.
const perClient = new FixedWindowLimiter(
	ABUSE_LIMITS.maxPerClientPerWindow,
	ABUSE_LIMITS.clientWindowMs,
);
const perDay = new FixedWindowLimiter(
	ABUSE_LIMITS.maxPerDay,
	ABUSE_LIMITS.dayMs,
);

export async function POST(request: Request) {
	let parsedBody: unknown;
	try {
		parsedBody = await request.json();
	} catch {
		return Response.json(
			{ error: "Corps de requête invalide." },
			{ status: 400 },
		);
	}

	const parsed = chatRequestSchema.safeParse(parsedBody);
	if (!parsed.success) {
		return Response.json(
			{ error: "Question invalide.", issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	// Refuse before spending an Albert call. The daily cap is charged for every
	// admitted request, so a distributed flood hits the ceiling instead of the
	// upstream quota.
	const caller = clientKey(request.headers);
	const clientDecision = perClient.check(caller);
	if (!clientDecision.allowed) {
		return Response.json(
			{
				error: "Trop de questions en peu de temps. Réessayez dans un instant.",
			},
			{
				status: 429,
				headers: { "Retry-After": String(clientDecision.retryAfterSeconds) },
			},
		);
	}

	const dayDecision = perDay.check("global");
	if (!dayDecision.allowed) {
		console.warn("[api/chat] daily request budget exhausted");
		return Response.json(
			{
				error: "Le service a atteint sa limite quotidienne. Réessayez demain.",
			},
			{
				status: 429,
				headers: { "Retry-After": String(dayDecision.retryAfterSeconds) },
			},
		);
	}

	let config: AppConfig;
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
			// A browser that navigates away closes the stream; enqueueing on it then
			// throws. Track that state so a disconnect ends the work quietly instead
			// of turning into an error event written to a closed channel.
			let closed = false;
			const upstream = new AbortController();

			request.signal.addEventListener("abort", () => {
				closed = true;
				upstream.abort();
			});

			const send = (event: Parameters<typeof encodeEvent>[0]) => {
				if (closed) return false;
				try {
					controller.enqueue(encoder.encode(encodeEvent(event)));
					return true;
				} catch {
					closed = true;
					return false;
				}
			};

			try {
				const hits = await client.search({
					query: question,
					collectionIds: config.collectionIds,
					limit: LIMITS.searchResults,
					method: "hybrid",
					signal: upstream.signal,
				});

				const blocks = buildContextBlocks(hits);
				// The block order is the citation order: marker [N] in the answer must
				// point at entry N of the rendered source list.
				send({ type: "sources", sources: blocksToSources(blocks) });

				const messages = buildChatMessages({ question, blocks, history });

				for await (const delta of client.streamChat({
					messages,
					model: config.chatModel,
					signal: upstream.signal,
				})) {
					if (closed) break;
					if (!send({ type: "delta", text: delta })) break;
				}

				send({ type: "done" });
			} catch (error) {
				// An aborted request is not a failure: the client is gone.
				if (!closed && !upstream.signal.aborted) {
					console.error("[api/chat] upstream error", error);
					send({
						type: "error",
						message:
							"La recherche ou la génération a échoué. Réessayez dans un instant.",
					});
				}
			} finally {
				closed = true;
				try {
					controller.close();
				} catch {
					// Already closed by the consumer.
				}
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
