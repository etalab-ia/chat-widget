import { z } from "zod";

const envSchema = z.object({
  ALBERT_API_KEY: z.string().min(1, "ALBERT_API_KEY is required"),
  ALBERT_BASE_URL: z.string().url().default("https://albert.api.etalab.gouv.fr"),
  ALBERT_CHAT_MODEL: z.string().default("gpt-oss-120b"),
  ALBERT_COLLECTION_FR: z.coerce.number().int().positive().optional(),
  ALBERT_COLLECTION_EN: z.coerce.number().int().positive().optional(),
});

export type AppConfig = {
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  collectionIds: number[];
};

/**
 * Reads and validates the server configuration. Throws a readable error listing
 * the offending variables rather than failing later inside a request.
 */
export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server configuration (${issues})`);
  }

  const collectionIds = [
    parsed.data.ALBERT_COLLECTION_FR,
    parsed.data.ALBERT_COLLECTION_EN,
  ].filter((id): id is number => typeof id === "number");

  if (collectionIds.length === 0) {
    throw new Error(
      "Invalid server configuration (set ALBERT_COLLECTION_FR and/or ALBERT_COLLECTION_EN)",
    );
  }

  return {
    apiKey: parsed.data.ALBERT_API_KEY,
    baseUrl: parsed.data.ALBERT_BASE_URL,
    chatModel: parsed.data.ALBERT_CHAT_MODEL,
    collectionIds,
  };
}

/** Public limits shared by the API route and the widget UI. */
export const LIMITS = {
  maxQuestionLength: 1000,
  maxTurnsInHistory: 6,
  maxHistoryEntries: 20,
  searchResults: 8,
  maxChunkCharacters: 1200,
} as const;
