/** Wire types for the subset of the Albert API used by this POC. */

export type ChunkMetadata = {
  guide_id?: string;
  guide_title?: string;
  source_url?: string;
  page?: number;
  updated?: string;
  collection?: string;
  extraction?: string;
  [key: string]: string | number | boolean | null | undefined;
};

export type Chunk = {
  object?: "chunk";
  id: number;
  collection_id: number;
  document_id: number;
  content: string;
  metadata?: ChunkMetadata | null;
};

export type SearchHit = {
  method: "semantic" | "lexical" | "hybrid";
  score: number;
  chunk: Chunk;
};

export type SearchResponse = {
  data: SearchHit[];
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OCRPage = {
  index: number;
  markdown?: string | null;
};

export type OCRResponse = {
  pages: OCRPage[];
};
