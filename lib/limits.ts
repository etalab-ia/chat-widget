/** Public request and rendering limits, with no server environment access. */
export const LIMITS = {
	maxQuestionLength: 1000,
	maxTurnsInHistory: 6,
	maxHistoryEntries: 20,
	searchResults: 8,
	maxChunkCharacters: 1200,
} as const;
