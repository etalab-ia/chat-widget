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
      for (const piece of splitLongText(paragraph, targetChars)) {
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

  return chunks.filter(
    (chunk) => chunk.content.length >= CHUNK_MIN_CHARS || chunks.length === 1,
  );
}

/** Splits on sentence boundaries where possible, then on whitespace. */
function splitLongText(text: string, targetChars: number): string[] {
  const pieces: string[] = [];
  let remaining = text.trim();

  while (remaining.length > targetChars) {
    const window = remaining.slice(0, targetChars);
    const sentenceEnd = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf(".\n"),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
    );
    const spaceEnd = window.lastIndexOf(" ");
    const cut =
      sentenceEnd > targetChars * 0.5
        ? sentenceEnd + 1
        : spaceEnd > 0
          ? spaceEnd
          : targetChars;

    pieces.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining.length > 0) pieces.push(remaining);
  return pieces;
}
