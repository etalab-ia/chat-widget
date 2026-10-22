import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { PageText } from "./chunk";

const execFileAsync = promisify(execFile);

/** Below this average, the text layer is considered unusable (scanned PDF). */
const MIN_CHARS_PER_PAGE = 80;

export type ExtractionMethod = "pdf" | "ocr";

export type ExtractionResult = {
  pages: PageText[];
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
 * Extracts text page by page. Uses the PDF text layer when it carries enough
 * content, otherwise falls back to Albert OCR, which returns markdown per page.
 */
export async function extractPages(params: {
  pdf: Buffer;
  pdfUrl: string;
  pageCount: number;
  ocr: (url: string) => Promise<Array<{ index: number; markdown?: string | null }>>;
}): Promise<ExtractionResult> {
  const textPages = await extractWithPdftotext(params.pdf, params.pageCount);
  const totalChars = textPages.reduce((sum, page) => sum + page.text.length, 0);
  const average = textPages.length > 0 ? totalChars / textPages.length : 0;

  if (textPages.length > 0 && average >= MIN_CHARS_PER_PAGE) {
    return { pages: textPages, method: "pdf" };
  }

  const ocrPages = await params.ocr(params.pdfUrl);
  return {
    pages: ocrPages
      .filter((page) => typeof page.markdown === "string")
      .map((page) => ({ page: page.index + 1, text: page.markdown ?? "" }))
      .filter((page) => page.text.trim().length > 0)
      .sort((left, right) => left.page - right.page),
    method: "ocr",
  };
}

/** Extracts every page by running pdftotext once per page. */
export async function extractWithPdftotext(
  pdf: Buffer,
  pageCount: number,
): Promise<PageText[]> {
  if (pageCount <= 0) return [];

  const dir = await mkdtemp(join(tmpdir(), "anssi-pdf-"));
  const pdfPath = join(dir, "input.pdf");

  try {
    await writeFile(pdfPath, pdf);

    const pages: PageText[] = [];
    for (let page = 1; page <= pageCount; page += 1) {
      try {
        const { stdout } = await execFileAsync(
          "pdftotext",
          ["-layout", "-f", String(page), "-l", String(page), pdfPath, "-"],
          { maxBuffer: 8 * 1024 * 1024 },
        );
        pages.push({ page, text: stdout });
      } catch {
        pages.push({ page, text: "" });
      }
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
