/**
 * Splits page text into chunks that fit Albert's embedding window while keeping
 * the page number attached to every chunk. Page-level provenance is the whole
 * point: the model must be able to cite "guide X, page N".
 */

export type PageText = {
  page: number;
  text: string;
};

export type TextChunk = {
  page: number;
  content: string;
};

export const CHUNK_TARGET_CHARS = 1200;
export const CHUNK_MIN_CHARS = 200;

/** Collapses PDF extraction artefacts: hyphenation across lines, hard wraps. */
export function normalizePageText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/-\n(?=\p{Ll})/gu, "")
    .replace(/(?<=\S)\n(?=\p{Ll})/gu, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Splits one page into paragraph-aligned chunks, merging short paragraphs and
 * hard-splitting any paragraph that alone exceeds the target.
 */
export function chunkPageText(
  page: number,
  text: string,
  targetChars: number = CHUNK_TARGET_CHARS,
): TextChunk[] {
  const normalized = normalizePageText(text);
  if (normalized.length === 0) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  const chunks: TextChunk[] = [];
  let buffer = "";

  const flush = () => {
    const content = buffer.trim();
    if (content.length > 0) chunks.push({ page, content });
    buffer = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > targetChars) {
      flush();
      for (const piece of splitText(paragraph, targetChars)) {
        chunks.push({ page, content: piece });
      }
      continue;
    }

    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length > targetChars) {
      flush();
      buffer = paragraph;
    } else {
      buffer = candidate;
    }
  }

  flush();

  return mergeShortChunks(chunks).flatMap((chunk) =>
    capChunkSize(chunk, targetChars),
  );
}

/**
 * A page often opens with a short paragraph that ends up alone once the next
 * paragraph is long enough to be split. Dropping it would remove the only text
 * that introduces the page, so a short chunk is carried into its neighbour
 * instead: forward when one follows, backward on the last chunk of a page.
 */
function mergeShortChunks(chunks: TextChunk[]): TextChunk[] {
  const merged: TextChunk[] = [];
  let carry = "";

  for (let index = 0; index < chunks.length; index += 1) {
    const content = carry
      ? `${carry}\n\n${chunks[index].content}`
      : chunks[index].content;
    carry = "";
    const isLast = index === chunks.length - 1;

    if (content.length < CHUNK_MIN_CHARS) {
      if (!isLast) {
        carry = content;
        continue;
      }
      const previous = merged[merged.length - 1];
      if (previous) {
        previous.content = `${previous.content}\n\n${content}`;
        continue;
      }
    }

    merged.push({ page: chunks[index].page, content });
  }

  return merged;
}

/**
 * A merged chunk can exceed the target by up to the minimum size. Retrieval
 * truncates every chunk to `LIMITS.maxChunkCharacters`, which equals the
 * chunking target, so an oversized chunk would lose its tail in the model's
 * context. Split it into balanced pieces instead: no text is dropped and every
 * piece stays within the limit.
 */
function capChunkSize(chunk: TextChunk, targetChars: number): TextChunk[] {
  const length = chunk.content.length;
  if (length <= targetChars) return [chunk];

  // Balanced, not full-then-fragment: a greedy cut would leave the same short
  // tail the merge was meant to eliminate.
  return splitText(chunk.content, targetChars).map((content) => ({
    page: chunk.page,
    content,
  }));
}

/**
 * Splits text into chunks of at most `targetChars`, on sentence boundaries
 * where possible, then on whitespace. Each cut aims at an even share of what
 * remains, so the last chunk is a real chunk rather than a fragment.
 */
function splitText(text: string, targetChars: number): string[] {
  const pieces: string[] = [];
  let remaining = text.trim();

  while (remaining.length > targetChars) {
    const wanted = Math.ceil(remaining.length / Math.ceil(remaining.length / targetChars));
    const window = remaining.slice(0, wanted);
    const sentenceEnd = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf(".\n"),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
    );
    const spaceEnd = window.lastIndexOf(" ");
    const cut =
      sentenceEnd > wanted * 0.5
        ? sentenceEnd + 1
        : spaceEnd > 0
          ? spaceEnd
          : wanted;

    pieces.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining.length > 0) pieces.push(remaining);
  return pieces;
}
