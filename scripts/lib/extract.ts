import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { PageText } from "./chunk";

const execFileAsync = promisify(execFile);

/** Below this many characters, a page's text layer is unusable (scanned page). */
const MIN_CHARS_PER_PAGE = 80;

/** How one page was turned into text. */
export type PageExtraction = "pdf" | "ocr";

/** How the text of a whole document was obtained. */
export type ExtractionMethod = PageExtraction | "mixed";

/**
 * Extracted page. A document can mix both sources: a PDF with a usable text
 * layer on most pages and scanned inserts only loses the scanned ones.
 */
export type ExtractedPage = PageText & { extraction: PageExtraction };

export type ExtractionResult = {
  pages: ExtractedPage[];
  method: ExtractionMethod;
};

export async function downloadPdf(url: string): Promise<Buffer> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Téléchargement échoué (HTTP ${response.status}) pour ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Extracts text page by page. The text layer is used page by page, and only the
 * pages that carry too little of it are re-read through Albert OCR. Deciding on
 * the document average would silently drop the scanned pages of a mixed PDF.
 */
export async function extractPages(params: {
  pdf: Buffer;
  pdfUrl: string;
  pageCount: number;
  ocr: (url: string) => Promise<Array<{ index: number; markdown?: string | null }>>;
}): Promise<ExtractionResult> {
  const textPages = await extractWithPdftotext(params.pdf, params.pageCount);
  const needsOcr = textPages.some((page) => !hasUsableText(page.text));

  if (!needsOcr) {
    return {
      pages: textPages.map((page) => ({ ...page, extraction: "pdf" as const })),
      method: "pdf",
    };
  }

  // One OCR call per document: the endpoint takes the PDF URL, not a page.
  // A failure here is fatal on purpose. Falling back to the text layer would
  // index the document without the pages OCR was meant to recover.
  const ocrPages = await params.ocr(params.pdfUrl);

  const ocrByPage = new Map<number, string>();
  for (const page of ocrPages) {
    const markdown = typeof page.markdown === "string" ? page.markdown : "";
    if (markdown.trim().length > 0) ocrByPage.set(page.index + 1, markdown);
  }

  const pages: ExtractedPage[] = textPages.map((page) => {
    if (hasUsableText(page.text)) return { ...page, extraction: "pdf" as const };

    // The OCR text wins when it carries something. Otherwise the thin text
    // layer is kept rather than discarded: a page with only a heading still
    // holds real content, and an empty page yields no chunk anyway.
    const markdown = ocrByPage.get(page.page);
    return markdown === undefined
      ? { ...page, extraction: "pdf" as const }
      : { page: page.page, text: markdown, extraction: "ocr" as const };
  });

  const usedOcr = pages.some((page) => page.extraction === "ocr");
  const usedTextLayer = pages.some((page) => page.extraction === "pdf");
  return {
    pages,
    method: usedOcr && usedTextLayer ? "mixed" : usedOcr ? "ocr" : "pdf",
  };
}

function hasUsableText(text: string): boolean {
  return text.trim().length >= MIN_CHARS_PER_PAGE;
}

/**
 * Extracts every page with a single pdftotext call. Poppler separates pages
 * with a form feed and terminates the output with one, so the stream is split
 * on `\f`; running the binary once per page meant one process per page and
 * turned each individual failure into an empty page.
 */
export async function extractWithPdftotext(
  pdf: Buffer,
  pageCount: number,
): Promise<PageText[]> {
  if (pageCount <= 0) return [];

  const dir = await mkdtemp(join(tmpdir(), "anssi-pdf-"));
  const pdfPath = join(dir, "input.pdf");

  try {
    await writeFile(pdfPath, pdf);

    const { stdout } = await execFileAsync("pdftotext", ["-layout", pdfPath, "-"], {
      maxBuffer: 64 * 1024 * 1024,
    });

    const parts = stdout.split("\f");
    // Drop the empty tail left by the final form feed.
    if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();

    const pages: PageText[] = [];
    for (let index = 0; index < pageCount; index += 1) {
      pages.push({ page: index + 1, text: parts[index] ?? "" });
    }
    return pages;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Reads the page count with `pdfinfo`. Kept separate so a missing poppler
 * install fails with an actionable message instead of a confusing chunk error.
 */
export async function countPdfPages(pdf: Buffer): Promise<number> {
  const dir = await mkdtemp(join(tmpdir(), "anssi-pdf-"));
  const pdfPath = join(dir, "input.pdf");

  try {
    await writeFile(pdfPath, pdf);
    const { stdout } = await execFileAsync("pdfinfo", [pdfPath], {
      maxBuffer: 1024 * 1024,
    });
    const match = /^Pages:\s+(\d+)$/m.exec(stdout);
    if (!match) throw new Error("Nombre de pages introuvable dans pdfinfo.");
    return Number.parseInt(match[1], 10);
  } catch (error) {
    if (error instanceof Error && /ENOENT/.test(error.message)) {
      throw new Error(
        "pdfinfo est introuvable. Installez poppler-utils (pdftotext, pdfinfo).",
      );
    }
    throw error;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function assertPdfBuffer(pdf: Buffer): void {
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new Error("Le fichier téléchargé n'est pas un PDF.");
  }
}

export async function readTextFile(path: string): Promise<string> {
  return readFile(path, "utf8");
}
