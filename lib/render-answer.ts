/**
 * Splits an answer into blocks for display, dropping the light Markdown models
 * emit even when asked for plain text.
 *
 * The widget renders a small block model (paragraph, bullet, numbered item)
 * rather than Markdown: the corpus answers need emphasis and lists, not links,
 * tables or embedded HTML, and a full Markdown pipeline would execute whatever
 * the model produced.
 */

export type AnswerBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "ordered"; text: string };

export function parseAnswer(raw: string): AnswerBlock[] {
  const text = raw
    .replace(/\r\n?/g, "\n")
    // Emphasis markers: **bold**, __bold__, *italic*, _italic_, `code`.
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/`([^`\n]+)`/g, "$1")
    // Escape characters the model sometimes emits before punctuation.
    .replace(/\\([.()\-])/g, "$1");

  const blocks: AnswerBlock[] = [];
  const lines = text.split("\n");
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const joined = paragraph.join(" ").trim();
    if (joined.length > 0) blocks.push({ kind: "paragraph", text: joined });
    paragraph = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      flushParagraph();
      continue;
    }

    // A heading stands alone, so it must not be folded into the next paragraph.
    const heading = /^#{1,6}\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      blocks.push({ kind: "paragraph", text: heading[1].trim() });
      continue;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flushParagraph();
      blocks.push({ kind: "bullet", text: bullet[1].trim() });
      continue;
    }

    const ordered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    if (ordered) {
      flushParagraph();
      blocks.push({ kind: "ordered", text: ordered[2].trim() });
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return blocks;
}
