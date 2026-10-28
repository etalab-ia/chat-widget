/** Reads the public ANSSI guide catalogue served by MesServicesCyber. */

export const CATALOGUE_URL = "https://messervices.cyber.gouv.fr/api/guides";

export type CatalogueDocument = {
	libelle?: string;
	url?: string;
};

export type CatalogueEntry = {
	id: string;
	nom: string;
	langue: "FR" | "EN";
	thematique?: string;
	description?: string;
	dateMiseAJour?: string;
	lienCourt?: string;
	documents?: CatalogueDocument[] | null;
};

export type PdfSource = {
	guideId: string;
	guideTitle: string;
	language: "FR" | "EN";
	pdfUrl: string;
	updated?: string;
	landingUrl?: string;
};

/**
 * Flattens the catalogue into one entry per PDF, keeping only http(s) URLs that
 * point at a PDF file.
 */
export function extractPdfSources(entries: CatalogueEntry[]): PdfSource[] {
	const sources: PdfSource[] = [];

	for (const entry of entries) {
		const language = entry.langue === "EN" ? "EN" : "FR";

		for (const document of entry.documents ?? []) {
			const url = document.url?.trim();
			if (!url) continue;
			if (!/^https?:\/\//i.test(url)) continue;
			if (!/\.pdf($|[?#])/i.test(url)) continue;

			sources.push({
				guideId: entry.id,
				guideTitle: entry.nom.trim(),
				language,
				pdfUrl: url,
				updated: entry.dateMiseAJour,
				landingUrl: entry.lienCourt,
			});
		}
	}

	return sources;
}

export async function fetchCatalogue(
	fetchImpl: typeof fetch = fetch,
): Promise<CatalogueEntry[]> {
	const response = await fetchImpl(CATALOGUE_URL, {
		headers: { Accept: "application/json" },
	});

	if (!response.ok) {
		throw new Error(
			`Catalogue ANSSI indisponible (HTTP ${response.status}) sur ${CATALOGUE_URL}`,
		);
	}

	const payload = (await response.json()) as unknown;
	if (!Array.isArray(payload)) {
		throw new Error("Format de catalogue inattendu: un tableau était attendu.");
	}

	return payload as CatalogueEntry[];
}

export function groupByLanguage(sources: PdfSource[]) {
	return {
		FR: sources.filter((source) => source.language === "FR"),
		EN: sources.filter((source) => source.language === "EN"),
	};
}

/**
 * Validates the French catalogue before it can drive destructive sync actions.
 * A renamed `documents` field must fail closed rather than look like an empty
 * catalogue and delete the whole collection.
 */
export function extractFrenchPdfSources(
	entries: CatalogueEntry[],
): PdfSource[] {
	const frenchEntries = entries.filter((entry) => entry.langue === "FR");
	const guideIds = new Set<string>();

	for (const entry of frenchEntries) {
		if (!entry.id?.trim() || !entry.nom?.trim()) {
			throw new Error("Guide ANSSI français sans identifiant ou titre.");
		}
		if (guideIds.has(entry.id)) {
			throw new Error(`Guide ANSSI français dupliqué: ${entry.id}`);
		}
		guideIds.add(entry.id);
		if (!Array.isArray(entry.documents)) {
			throw new Error(
				`Documents absents ou invalides pour le guide ${entry.id}.`,
			);
		}
	}

	const sources = extractPdfSources(frenchEntries);
	const urls = new Set<string>();
	for (const source of sources) {
		if (urls.has(source.pdfUrl)) {
			throw new Error(`PDF ANSSI français dupliqué: ${source.pdfUrl}`);
		}
		urls.add(source.pdfUrl);
	}
	if (sources.length === 0) {
		throw new Error("Le catalogue ANSSI ne contient aucun PDF français.");
	}
	return sources;
}
