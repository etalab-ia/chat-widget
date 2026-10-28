import { describe, expect, it } from "vitest";
import {
	type CatalogueEntry,
	extractFrenchPdfSources,
	extractPdfSources,
	groupByLanguage,
} from "@/scripts/lib/catalogue";

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
		documents: [
			{ url: "https://messervices.cyber.gouv.fr/documents-guides/c.pdf" },
		],
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

describe("extractFrenchPdfSources", () => {
	it("keeps French PDFs only and supports several PDFs per guide", () => {
		const entries: CatalogueEntry[] = [
			{
				id: "guide-fr",
				nom: "Guide",
				langue: "FR",
				documents: [
					{ url: "https://example.gouv.fr/a.pdf" },
					{ url: "https://example.gouv.fr/b.pdf" },
				],
			},
			...ENTRIES.filter((entry) => entry.langue === "EN"),
		];
		const sources = extractFrenchPdfSources(entries);
		expect(sources).toHaveLength(2);
		expect(sources.map((item) => item.guideId)).toEqual([
			"guide-fr",
			"guide-fr",
		]);
	});

	it("fails closed when the French documents field changes shape", () => {
		expect(() =>
			extractFrenchPdfSources([{ id: "guide-fr", nom: "Guide", langue: "FR" }]),
		).toThrow("Documents absents ou invalides");
	});

	it("rejects duplicate guide IDs and duplicate PDF URLs", () => {
		const french: CatalogueEntry = {
			id: "guide-fr",
			nom: "Guide",
			langue: "FR",
			documents: [{ url: "https://example.gouv.fr/a.pdf" }],
		};
		expect(() => extractFrenchPdfSources([french, french])).toThrow("dupliqué");
		expect(() =>
			extractFrenchPdfSources([
				french,
				{ ...french, id: "other", nom: "Other" },
			]),
		).toThrow("PDF ANSSI français dupliqué");
	});

	it("rejects an empty French corpus rather than deleting the collection", () => {
		expect(() => extractFrenchPdfSources([])).toThrow("aucun PDF français");
	});
});

describe("groupByLanguage", () => {
	it("splits sources by language", () => {
		const grouped = groupByLanguage(extractPdfSources(ENTRIES));
		expect(grouped.FR).toHaveLength(1);
		expect(grouped.EN).toHaveLength(1);
	});
});
