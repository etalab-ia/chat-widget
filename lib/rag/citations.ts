import type { ChunkMetadata, SearchHit } from "@/lib/albert/types";
import { LIMITS } from "@/lib/config";

export type Citation = {
	id: string;
	title: string;
	page: number | null;
	url: string;
	score: number;
};

export type ContextBlock = {
	marker: string;
	citation: Citation;
	content: string;
};

/**
 * Builds a URL that opens a PDF at a given page. The `#page=` fragment is
 * honoured by browsers' built-in PDF viewers and by most intranet PDF plugins.
 */
export function buildCitationUrl(
	sourceUrl: string,
	page: number | null,
): string {
	if (page === null) return sourceUrl;
	// Split on the first "#" only: a fragment may itself contain "#", and
	// `split("#", 2)` would truncate it.
	const hashIndex = sourceUrl.indexOf("#");
	const base = hashIndex === -1 ? sourceUrl : sourceUrl.slice(0, hashIndex);
	const fragment = hashIndex === -1 ? "" : sourceUrl.slice(hashIndex + 1);

	if (!fragment) return `${base}#page=${page}`;
	// A fragment that already sets the page wins: appending a second `page=`
	// gives `#page=5&page=3`, where viewers honour the first value.
	if (/(?:^|&)page=/.test(fragment)) return sourceUrl;
	return `${base}#${fragment}&page=${page}`;
}

function readPage(metadata: ChunkMetadata | null | undefined): number | null {
	const page = metadata?.page;
	if (typeof page === "number" && Number.isFinite(page) && page > 0) {
		return Math.trunc(page);
	}
	if (typeof page === "string") {
		const parsed = Number.parseInt(page, 10);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
	}
	return null;
}

/**
 * Only absolute http(s) sources are rendered as links. `/v1/search` returns
 * whatever metadata was indexed, and a `javascript:` URL would become a
 * clickable script in the page the widget is embedded in.
 */
function isSafeSourceUrl(value: string): boolean {
	return /^https?:\/\//i.test(value);
}

/**
 * Turns raw search hits into numbered citations. Hits without a source URL are
 * dropped: a citation that cannot be opened is worse than no citation.
 */
export function toCitations(hits: SearchHit[]): Citation[] {
	const byKey = new Map<string, Citation>();

	for (const hit of hits) {
		const metadata = hit.chunk.metadata ?? {};
		const sourceUrl = metadata.source_url;
		if (typeof sourceUrl !== "string" || sourceUrl.length === 0) continue;
		if (!isSafeSourceUrl(sourceUrl)) continue;

		const page = readPage(metadata);
		const title =
			typeof metadata.guide_title === "string" && metadata.guide_title
				? metadata.guide_title
				: "Document ANSSI";

		const key = `${sourceUrl}#${page ?? ""}`;
		const existing = byKey.get(key);
		if (existing) {
			existing.score = Math.max(existing.score, hit.score);
			continue;
		}

		byKey.set(key, {
			id: `${hit.chunk.document_id}-${hit.chunk.id}`,
			title,
			page,
			url: buildCitationUrl(sourceUrl, page),
			score: hit.score,
		});
	}

	return [...byKey.values()].sort((left, right) => right.score - left.score);
}

/**
 * Builds the numbered context blocks that the model is asked to cite.
 *
 * Hits sharing a page are merged into a single block, so block N and source N
 * are the same document: the marker the model writes, e.g. [3], indexes the
 * source list the interface renders. Without the merge, two chunks from one
 * page would produce two markers pointing at one source and shift every
 * following marker.
 */
export function buildContextBlocks(hits: SearchHit[]): ContextBlock[] {
	const blocks: ContextBlock[] = [];
	const blockByKey = new Map<string, ContextBlock>();

	for (const hit of hits) {
		const metadata = hit.chunk.metadata ?? {};
		const sourceUrl = metadata.source_url;
		if (typeof sourceUrl !== "string" || sourceUrl.length === 0) continue;
		if (!isSafeSourceUrl(sourceUrl)) continue;

		const page = readPage(metadata);
		const content = hit.chunk.content.trim();
		if (content.length === 0) continue;

		const key = buildCitationUrl(sourceUrl, page);
		const existing = blockByKey.get(key);

		if (existing) {
			if (existing.content.length < LIMITS.maxChunkCharacters) {
				existing.content = `${existing.content}\n\n${content}`.slice(
					0,
					LIMITS.maxChunkCharacters,
				);
			}
			continue;
		}

		const title =
			typeof metadata.guide_title === "string" && metadata.guide_title
				? metadata.guide_title
				: "Document ANSSI";

		const block: ContextBlock = {
			marker: `[${blocks.length + 1}]`,
			citation: {
				id: `${hit.chunk.document_id}-${hit.chunk.id}`,
				title,
				page,
				url: key,
				score: hit.score,
			},
			content: content.slice(0, LIMITS.maxChunkCharacters),
		};

		blocks.push(block);
		blockByKey.set(key, block);
	}

	return blocks;
}

/** The sources of an answer, in the order its markers refer to. */
export function blocksToSources(blocks: ContextBlock[]): Citation[] {
	return blocks.map((block) => block.citation);
}
