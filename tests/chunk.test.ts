import { describe, expect, it } from "vitest";
import {
  CHUNK_MIN_CHARS,
  CHUNK_TARGET_CHARS,
  chunkPageText,
  normalizePageText,
} from "@/scripts/lib/chunk";

describe("normalizePageText", () => {
  it("joins words hyphenated across a line break", () => {
    expect(normalizePageText("segmenta-\ntion du réseau")).toBe(
      "segmentation du réseau",
    );
  });

  it("joins a hard-wrapped lowercase line without leaving a space pair", () => {
    expect(normalizePageText("la politique\nde sécurité")).toBe(
      "la politique de sécurité",
    );
  });

  it("keeps sentence-separating newlines that start an uppercase word", () => {
    expect(normalizePageText("Première phrase.\nSeconde phrase.")).toBe(
      "Première phrase.\nSeconde phrase.",
    );
  });

  it("normalises carriage returns and collapses runs of spaces", () => {
    expect(normalizePageText("a\r\n\r\n  b\t\tc")).toBe("a\n\nb c");
  });
});

describe("chunkPageText", () => {
  it("returns nothing for a page without text", () => {
    expect(chunkPageText(3, "   \n\n  ")).toEqual([]);
  });

  it("stamps the page number on every chunk", () => {
    const text = "Un paragraphe.\n\nUn autre paragraphe.";
    const chunks = chunkPageText(12, text);
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) expect(chunk.page).toBe(12);
  });

  it("merges short paragraphs up to the target size instead of emitting fragments", () => {
    const paragraph = "a".repeat(150);
    const chunks = chunkPageText(1, Array.from({ length: 10 }, () => paragraph).join("\n\n"));
    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk.content.length).toBeGreaterThanOrEqual(CHUNK_TARGET_CHARS * 0.5);
    }
  });

  it("never exceeds the target size, splitting long paragraphs", () => {
    const long = `${"mot ".repeat(2000)}`;
    const chunks = chunkPageText(1, long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_TARGET_CHARS);
    }
  });

  it("keeps the whole text when splitting a long paragraph", () => {
    const sentence = "La journalisation centralisée est recommandée. ";
    const long = sentence.repeat(120);
    const chunks = chunkPageText(1, long);
    const rejoined = chunks.map((chunk) => chunk.content).join(" ");
    expect(rejoined.replace(/\s+/g, " ").trim()).toBe(long.replace(/\s+/g, " ").trim());
  });

  it("merges a trailing fragment into the previous chunk instead of dropping it", () => {
    const body = "m".repeat(CHUNK_TARGET_CHARS);
    const chunks = chunkPageText(1, `${body}\n\ncourt`);

    // The merged text is rebalanced: retrieval truncates every chunk to the
    // target, so keeping one oversized chunk would cut "court" off in context.
    expect(chunks.at(-1)?.content.endsWith("court")).toBe(true);
    expect(chunks.map((chunk) => chunk.content).join("")).toContain(body);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_TARGET_CHARS);
    }
  });

  it("merges a short page opening into the paragraph that follows", () => {
    const intro = "Ce chapitre présente les mesures de sécurité réseau.";
    const long = "mot ".repeat(500).trim();
    const chunks = chunkPageText(1, `${intro}\n\n${long}`);

    expect(chunks.length).toBeGreaterThan(1);
    // The introduction is real content: it must stay, at the head of the first
    // chunk, rather than disappearing because it is below the minimum size.
    expect(chunks[0].content.startsWith(intro)).toBe(true);
    const rejoined = chunks.map((chunk) => chunk.content).join(" ");
    expect(rejoined.replace(/\s+/g, " ")).toContain(intro);
  });

  it("keeps every chunk within the target after a merge, so nothing is truncated in context", () => {
    // The case from the review: a short introduction followed by a long
    // paragraph. Merging must not push the chunk past the limit that
    // `buildContextBlocks` enforces when it builds the model context.
    const intro = "Introduction courte. ".repeat(5).trim();
    const long = "mot ".repeat(500).trim();
    const chunks = chunkPageText(1, `${intro}\n\n${long}`);

    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_TARGET_CHARS);
      expect(chunk.content.length).toBeGreaterThanOrEqual(CHUNK_MIN_CHARS);
    }
    const rejoined = chunks
      .map((chunk) => chunk.content)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    expect(rejoined).toBe(`${intro} ${long}`);
  });

  it("keeps a page whose only text is short as a single chunk", () => {
    const chunks = chunkPageText(1, "Page de garde.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Page de garde.");
  });

  it("never splits a multi-byte character across two chunks", () => {
    // 2002 UTF-16 units: a naive hard cut at 1200 falls inside a surrogate pair.
    const chunks = chunkPageText(1, "😀".repeat(1001));
    const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

    for (const chunk of chunks) {
      expect(lone.test(chunk.content)).toBe(false);
      expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_TARGET_CHARS);
    }
    // The character count is preserved: each piece still holds whole emoji.
    expect(chunks.map((chunk) => chunk.content).join("")).toBe("😀".repeat(1001));
  });

  it("does not leave a stub chunk when the only space sits at the start", () => {
    // A space at offset 1 used to become the split point, leaving one character.
    const chunks = chunkPageText(1, `a ${"m".repeat(1198)}\n\ncourt`);

    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThanOrEqual(CHUNK_MIN_CHARS);
      expect(chunk.content.length).toBeLessThanOrEqual(CHUNK_TARGET_CHARS);
    }
  });
});
