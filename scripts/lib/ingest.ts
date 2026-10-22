import { AlbertClient } from "../../lib/albert/client";
import type { ChunkMetadata } from "../../lib/albert/types";
import { buildCitationUrl } from "../../lib/rag/citations";
import type { PdfSource } from "./catalogue";
import { chunkPageText } from "./chunk";
import { assertPdfBuffer, countPdfPages, downloadPdf, extractPages } from "./extract";

export type IngestOutcome =
  | {
      status: "indexed";
      guideId: string;
      documentId: number;
      chunks: number;
      pages: number;
      extraction: "pdf" | "ocr";
    }
  | { status: "skipped"; guideId: string; reason: string }
  | { status: "failed"; guideId: string; reason: string };

/**
 * Downloads one guide PDF, splits it page by page and indexes the chunks as a
 * manually-populated Albert document. Chunk metadata carries the page number and
 * a citation URL that opens the PDF at that page.
 */
export async function ingestSource(params: {
  source: PdfSource;
  collectionId: number;
  client: AlbertClient;
  dryRun?: boolean;
}): Promise<IngestOutcome> {
  const { source, collectionId, client } = params;

  try {
    const pdf = await downloadPdf(source.pdfUrl);
    assertPdfBuffer(pdf);

    const pageCount = await countPdfPages(pdf);
    const extracted = await extractPages({
      pdf,
      pdfUrl: source.pdfUrl,
      pageCount,
      ocr: async (url) => {
        const response = await client.ocr({ documentUrl: url });
        return response.pages;
      },
    });

    const chunks = extracted.pages.flatMap((page) =>
      chunkPageText(page.page, page.text).map((chunk) => ({
        content: chunk.content,
        metadata: buildChunkMetadata(source, chunk.page, extracted.method),
      })),
    );

    if (chunks.length === 0) {
      return {
        status: "skipped",
        guideId: source.guideId,
        reason: "aucun texte extrait",
      };
    }

    if (params.dryRun) {
      return {
        status: "indexed",
        guideId: source.guideId,
        documentId: -1,
        chunks: chunks.length,
        pages: extracted.pages.length,
        extraction: extracted.method,
      };
    }

    const document = await client.createDocument({
      name: source.pdfUrl.split("/").pop() ?? `${source.guideId}.pdf`,
      collectionId,
    });

    await client.addChunks(document.id, chunks);

    return {
      status: "indexed",
      guideId: source.guideId,
      documentId: document.id,
      chunks: chunks.length,
      pages: extracted.pages.length,
      extraction: extracted.method,
    };
  } catch (error) {
    return {
      status: "failed",
      guideId: source.guideId,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function buildChunkMetadata(
  source: PdfSource,
  page: number,
  extraction: "pdf" | "ocr",
): ChunkMetadata {
  return {
    guide_id: source.guideId,
    guide_title: source.guideTitle,
    source_url: source.pdfUrl,
    citation_url: buildCitationUrl(source.pdfUrl, page),
    page,
    collection: source.language,
    extraction,
    ...(source.updated ? { updated: source.updated.slice(0, 10) } : {}),
  };
}
