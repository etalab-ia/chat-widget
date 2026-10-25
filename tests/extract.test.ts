import { beforeEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({ execFile: execFileMock }));

import { extractPages, extractWithPdftotext } from "@/scripts/lib/extract";

const PDF = Buffer.from("%PDF-1.7\ncontenu de test\n");

/**
 * Mimics a successful `execFile`. The mock must resolve through the callback:
 * `promisify` on the mocked module resolves to whatever value the callback
 * receives, which production calls with `{ stdout, stderr }`.
 */
function pdftotextOutputs(stdout: string) {
	execFileMock.mockImplementation(
		(
			_file: string,
			_args: string[],
			_options: unknown,
			callback: (
				error: Error | null,
				result?: { stdout: string; stderr: string },
			) => void,
		) => {
			callback(null, { stdout, stderr: "" });
		},
	);
}

function pdftotextFails(message: string) {
	execFileMock.mockImplementation(
		(
			_file: string,
			_args: string[],
			_options: unknown,
			callback: (error: Error | null) => void,
		) => {
			callback(new Error(message));
		},
	);
}

/** Poppler separates pages with a form feed and ends the output with one. */
function pagesOutput(...pages: string[]): string {
	return `${pages.join("\f")}\f`;
}

beforeEach(() => {
	execFileMock.mockReset();
});

describe("extractWithPdftotext", () => {
	it("extracts the whole document with a single pdftotext call", async () => {
		pdftotextOutputs(pagesOutput("page une", "page deux", "page trois"));

		const pages = await extractWithPdftotext(PDF, 3);

		expect(execFileMock).toHaveBeenCalledTimes(1);
		const [file, args] = execFileMock.mock.calls[0];
		expect(file).toBe("pdftotext");
		expect(args.slice(0, 2)).toEqual([
			"-layout",
			expect.stringContaining("input.pdf"),
		]);
		expect(args.at(-1)).toBe("-");
		expect(pages).toEqual([
			{ page: 1, text: "page une" },
			{ page: 2, text: "page deux" },
			{ page: 3, text: "page trois" },
		]);
	});

	it("pads with empty pages when the output holds fewer pages than announced", async () => {
		pdftotextOutputs(pagesOutput("seule page"));

		const pages = await extractWithPdftotext(PDF, 3);

		expect(pages).toHaveLength(3);
		expect(pages[1]).toEqual({ page: 2, text: "" });
		expect(pages[2]).toEqual({ page: 3, text: "" });
	});

	it("ignores separators past the announced page count", async () => {
		pdftotextOutputs(pagesOutput("une", "deux", "trois", "quatre"));

		const pages = await extractWithPdftotext(PDF, 2);

		expect(pages).toEqual([
			{ page: 1, text: "une" },
			{ page: 2, text: "deux" },
		]);
	});

	it("does not run the binary for a document without pages", async () => {
		expect(await extractWithPdftotext(PDF, 0)).toEqual([]);
		expect(execFileMock).not.toHaveBeenCalled();
	});

	it("surfaces a pdftotext failure instead of returning empty pages", async () => {
		pdftotextFails("pdftotext: command failed");

		await expect(extractWithPdftotext(PDF, 2)).rejects.toThrow(
			"command failed",
		);
	});
});

describe("extractPages", () => {
	const dense = "a".repeat(400);

	it("uses the text layer and skips OCR when every page is readable", async () => {
		pdftotextOutputs(pagesOutput(dense, dense));
		const ocr = vi.fn();

		const result = await extractPages({
			pdf: PDF,
			pdfUrl: "u",
			pageCount: 2,
			ocr,
		});

		expect(ocr).not.toHaveBeenCalled();
		expect(result.method).toBe("pdf");
		expect(result.pages.map((page) => page.extraction)).toEqual(["pdf", "pdf"]);
	});

	it("re-reads only the pages whose text layer is unusable", async () => {
		pdftotextOutputs(pagesOutput(dense, "", dense));
		const ocr = vi.fn(async () => [
			{ index: 0, markdown: "texte OCR de la page 1" },
			{ index: 1, markdown: "texte OCR de la page 2" },
			{ index: 2, markdown: "texte OCR de la page 3" },
		]);

		const result = await extractPages({
			pdf: PDF,
			pdfUrl: "u",
			pageCount: 3,
			ocr,
		});

		expect(ocr).toHaveBeenCalledTimes(1);
		expect(ocr).toHaveBeenCalledWith("u");
		expect(result.method).toBe("mixed");
		expect(result.pages.map((page) => page.extraction)).toEqual([
			"pdf",
			"ocr",
			"pdf",
		]);
		// The readable pages keep their own text: OCR is not allowed to replace a
		// page that already has a good text layer.
		expect(result.pages[0].text).toBe(dense);
		expect(result.pages[1].text).toBe("texte OCR de la page 2");
		expect(result.pages[2].text).toBe(dense);
	});

	it("treats a nearly empty text layer as unusable page by page", async () => {
		// The document average is high, which is exactly the case the old
		// document-level heuristic let through.
		pdftotextOutputs(pagesOutput(dense, "1", dense, dense));
		const ocr = vi.fn(async () => [{ index: 1, markdown: "schéma légendé" }]);

		const result = await extractPages({
			pdf: PDF,
			pdfUrl: "u",
			pageCount: 4,
			ocr,
		});

		expect(result.pages[1]).toEqual({
			page: 2,
			text: "schéma légendé",
			extraction: "ocr",
		});
		expect(result.method).toBe("mixed");
	});

	it("uses OCR for every page of a scanned document", async () => {
		pdftotextOutputs(pagesOutput("", ""));
		const ocr = vi.fn(async () => [
			{ index: 0, markdown: "page 1" },
			{ index: 1, markdown: "page 2" },
		]);

		const result = await extractPages({
			pdf: PDF,
			pdfUrl: "u",
			pageCount: 2,
			ocr,
		});

		expect(result.method).toBe("ocr");
		expect(result.pages.map((page) => page.text)).toEqual(["page 1", "page 2"]);
	});

	it("keeps the thin text layer when OCR returns nothing for that page", async () => {
		pdftotextOutputs(pagesOutput(dense, "Titre de section"));
		const ocr = vi.fn(async () => [{ index: 1, markdown: null }]);

		const result = await extractPages({
			pdf: PDF,
			pdfUrl: "u",
			pageCount: 2,
			ocr,
		});

		// A heading is real content: dropping it because OCR found nothing would
		// lose text that the text layer already had.
		expect(result.pages[1]).toEqual({
			page: 2,
			text: "Titre de section",
			extraction: "pdf",
		});
	});

	it("fails loudly when OCR fails rather than indexing a partial document", async () => {
		pdftotextOutputs(pagesOutput(dense, ""));
		const ocr = vi.fn(async () => {
			throw new Error("Albert OCR indisponible");
		});

		await expect(
			extractPages({ pdf: PDF, pdfUrl: "u", pageCount: 2, ocr }),
		).rejects.toThrow("Albert OCR indisponible");
	});

	it("reports the pages that stayed empty because OCR did not cover them", async () => {
		// Page 2 has no text layer and the OCR response carries nothing for it.
		// The page produces no chunk, so it must be reported instead of vanishing.
		pdftotextOutputs(pagesOutput(dense, "", dense));
		const ocr = vi.fn(async () => [{ index: 0, markdown: "page 1 par OCR" }]);

		const result = await extractPages({
			pdf: PDF,
			pdfUrl: "u",
			pageCount: 3,
			ocr,
		});

		// No page ended up using OCR, so the document is still a text-layer one;
		// the dropped page is reported separately instead of being counted.
		expect(result.method).toBe("pdf");
		expect(result.pages[1]).toEqual({ page: 2, text: "", extraction: "pdf" });
		expect(result.emptyPages).toEqual([2]);
	});

	it("reports nothing when every page produced text", async () => {
		pdftotextOutputs(pagesOutput(dense, dense));

		const result = await extractPages({
			pdf: PDF,
			pdfUrl: "u",
			pageCount: 2,
			ocr: vi.fn(),
		});

		expect(result.emptyPages).toEqual([]);
	});
});
