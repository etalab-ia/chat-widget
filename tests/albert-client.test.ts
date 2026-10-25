import { describe, expect, it, vi } from "vitest";
import { AlbertClient, AlbertError } from "@/lib/albert/client";

function sseResponse(frames: string[]): Response {
	const body = frames.join("");
	return new Response(body, {
		status: 200,
		headers: { "Content-Type": "text/event-stream" },
	});
}

async function collect(iterator: AsyncGenerator<string>): Promise<string> {
	let output = "";
	for await (const delta of iterator) output += delta;
	return output;
}

describe("AlbertClient.streamChat", () => {
	it("concatenates content deltas", async () => {
		const response = sseResponse([
			'data: {"choices":[{"delta":{"content":"Bon"}}]}\n\n',
			'data: {"choices":[{"delta":{"content":"jour"}}]}\n\n',
			"data: [DONE]\n\n",
		]);
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

		const client = new AlbertClient({
			baseUrl: "https://albert.test",
			apiKey: "sk-test",
		});

		const text = await collect(
			client.streamChat({
				messages: [{ role: "user", content: "q" }],
				model: "m",
			}),
		);
		expect(text).toBe("Bonjour");
		vi.unstubAllGlobals();
	});

	it("ignores reasoning deltas", async () => {
		const response = sseResponse([
			'data: {"choices":[{"delta":{"reasoning":"je réfléchis"}}]}\n\n',
			'data: {"choices":[{"delta":{"content":"Réponse"}}]}\n\n',
			"data: [DONE]\n\n",
		]);
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

		const client = new AlbertClient({
			baseUrl: "https://albert.test",
			apiKey: "sk-test",
		});

		const text = await collect(
			client.streamChat({
				messages: [{ role: "user", content: "q" }],
				model: "m",
			}),
		);
		expect(text).toBe("Réponse");
		expect(text).not.toContain("réfléchis");
		vi.unstubAllGlobals();
	});

	it("reassembles a frame split across reads", async () => {
		const encoder = new TextEncoder();
		const chunks = [
			'data: {"choices":[{"delta":{"content":"moi',
			'tié"}}]}\n\ndata: [DONE]\n\n',
		];
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
				controller.close();
			},
		});

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response(stream, { status: 200 })),
		);

		const client = new AlbertClient({
			baseUrl: "https://albert.test",
			apiKey: "sk-test",
		});

		const text = await collect(
			client.streamChat({
				messages: [{ role: "user", content: "q" }],
				model: "m",
			}),
		);
		expect(text).toBe("moitié");
		vi.unstubAllGlobals();
	});

	it("ignores a malformed frame instead of failing the stream", async () => {
		const response = sseResponse([
			"data: {not json}\n\n",
			'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
			"data: [DONE]\n\n",
		]);
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

		const client = new AlbertClient({
			baseUrl: "https://albert.test",
			apiKey: "sk-test",
		});

		const text = await collect(
			client.streamChat({
				messages: [{ role: "user", content: "q" }],
				model: "m",
			}),
		);
		expect(text).toBe("ok");
		vi.unstubAllGlobals();
	});
});

describe("AlbertClient error handling", () => {
	it("raises AlbertError carrying the API detail", async () => {
		vi.stubGlobal(
			"fetch",
			// A fresh Response per call: a reused one is already consumed on read.
			vi
				.fn()
				.mockImplementation(() =>
					Promise.resolve(
						new Response('{"detail":"collection inconnue"}', { status: 404 }),
					),
				),
		);

		const client = new AlbertClient({
			baseUrl: "https://albert.test",
			apiKey: "sk-test",
		});

		await expect(
			client.search({ query: "q", collectionIds: [1] }),
		).rejects.toBeInstanceOf(AlbertError);

		await expect(
			client.search({ query: "q", collectionIds: [1] }),
		).rejects.toMatchObject({
			status: 404,
			detail: '{"detail":"collection inconnue"}',
		});
		vi.unstubAllGlobals();
	});

	it("never puts the key in the URL", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(Response.json({ data: [] }));
		vi.stubGlobal("fetch", fetchMock);

		const client = new AlbertClient({
			baseUrl: "https://albert.test/",
			apiKey: "sk-secret",
		});
		await client.search({ query: "q", collectionIds: [1] });

		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toBe("https://albert.test/v1/search");
		expect(String(url)).not.toContain("sk-secret");
		const headers = init?.headers as Record<string, string> | undefined;
		expect(headers?.Authorization).toBe("Bearer sk-secret");
		vi.unstubAllGlobals();
	});
});

describe("AlbertClient.addChunks", () => {
	it("splits into batches of 64", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(Response.json({}));
		vi.stubGlobal("fetch", fetchMock);

		const client = new AlbertClient({
			baseUrl: "https://albert.test",
			apiKey: "sk-test",
		});

		const chunks = Array.from({ length: 130 }, (_, index) => ({
			content: `chunk ${index}`,
			metadata: { page: index + 1 },
		}));

		await client.addChunks(42, chunks);

		expect(fetchMock).toHaveBeenCalledTimes(3);
		const sizes = fetchMock.mock.calls.map(
			([, init]) => JSON.parse(String(init?.body)).chunks.length,
		);
		expect(sizes).toEqual([64, 64, 2]);
		vi.unstubAllGlobals();
	});
});

describe("AlbertClient.streamChat CRLF framing", () => {
	async function textFrom(body: string): Promise<string> {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response(body, { status: 200 })),
		);
		const client = new AlbertClient({
			baseUrl: "https://albert.test",
			apiKey: "sk-test",
		});
		const text = await collect(
			client.streamChat({
				messages: [{ role: "user", content: "q" }],
				model: "m",
			}),
		);
		vi.unstubAllGlobals();
		return text;
	}

	it("parses CRLF-framed events instead of dropping the answer", async () => {
		const body = [
			'data: {"choices":[{"delta":{"content":"Bon"}}]}',
			"",
			'data: {"choices":[{"delta":{"content":"jour"}}]}',
			"",
			"data: [DONE]",
			"",
		].join("\r\n");
		expect(await textFrom(body)).toBe("Bonjour");
	});

	it("parses LF framing", async () => {
		const body =
			'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n';
		expect(await textFrom(body)).toBe("ok");
	});
});
