import { describe, expect, it } from "vitest";
import {
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

  it("drops a trailing fragment below the minimum size when other chunks exist", () => {
    const body = "m".repeat(CHUNK_TARGET_CHARS);
    const chunks = chunkPageText(1, `${body}\n\ncourt`);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).not.toContain("court");
  });
});
