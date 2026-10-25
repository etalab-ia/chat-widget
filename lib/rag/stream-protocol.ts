import { z } from "zod";
import { LIMITS } from "@/lib/config";
import type { Citation } from "./citations";

/**
 * Line-delimited JSON protocol between /api/chat and the browser.
 * One JSON object per line, each tagged with a `type` discriminator.
 */
export type StreamEvent =
	| { type: "sources"; sources: Citation[] }
	| { type: "delta"; text: string }
	| { type: "error"; message: string }
	| { type: "done" };

export function encodeEvent(event: StreamEvent): string {
	return `${JSON.stringify(event)}\n`;
}

export const chatRequestSchema = z.object({
	question: z.string().trim().min(1).max(LIMITS.maxQuestionLength),
	history: z
		.array(
			z.object({
				role: z.enum(["user", "assistant"]),
				content: z.string().max(8000),
			}),
		)
		.max(LIMITS.maxHistoryEntries)
		.default([]),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
