import { describe, expect, it } from "vitest";
import { extractPdfSources, groupByLanguage, type CatalogueEntry } from "@/scripts/lib/catalogue";

const ENTRIES: CatalogueEntry[] = [
  {
    id: "guide-fr",
    nom: "Guide FR",
    langue: "FR",
    dateMiseAJour: "2026-10-09T00:00:00.000Z",
    documents: [
      { url: "https://messervices.cyber.gouv.fr/documents-guides/a.pdf" },
      { url: "https://messervices.cyber.gouv.fr/documents-guides/b.xlsx" },
    ],
  },
  {
    id: "guide-en",
    nom: "Guide EN",
    langue: "EN",
    documents: [{ url: "https://messervices.cyber.gouv.fr/documents-guides/c.pdf" }],
  },
  { id: "no-doc", nom: "Sans document", langue: "FR", documents: null },
];

describe("extractPdfSources", () => {
  it("keeps only PDF documents", () => {
    const sources = extractPdfSources(ENTRIES);
    expect(sources.map((source) => source.pdfUrl)).toEqual([
      "https://messervices.cyber.gouv.fr/documents-guides/a.pdf",
      "https://messervices.cyber.gouv.fr/documents-guides/c.pdf",
    ]);
  });

  it("carries the guide identity and language", () => {
    const [first] = extractPdfSources(ENTRIES);
    expect(first.guideId).toBe("guide-fr");
    expect(first.guideTitle).toBe("Guide FR");
    expect(first.language).toBe("FR");
    expect(first.updated).toBe("2026-10-09T00:00:00.000Z");
  });

  it("keeps a PDF URL that carries a query string", () => {
    const sources = extractPdfSources([
      {
        id: "q",
        nom: "Query",
        langue: "FR",
        documents: [{ url: "https://example.org/a.pdf?v=2" }],
      },
    ]);
    expect(sources).toHaveLength(1);
  });

  it("ignores non-http URLs", () => {
    const sources = extractPdfSources([
      {
        id: "x",
        nom: "Local",
        langue: "FR",
        documents: [{ url: "/documents-guides/local.pdf" }],
      },
    ]);
    expect(sources).toHaveLength(0);
  });
});

describe("groupByLanguage", () => {
  it("splits sources by language", () => {
    const grouped = groupByLanguage(extractPdfSources(ENTRIES));
    expect(grouped.FR).toHaveLength(1);
    expect(grouped.EN).toHaveLength(1);
  });
});
