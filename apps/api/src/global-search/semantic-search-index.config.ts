/** Restart the API after changing this process-wide background indexing switch. */
export const isSemanticSearchBackgroundIndexingEnabled = () =>
  process.env.SEMANTIC_SEARCH_BACKGROUND_INDEXING_ENABLED?.trim().toLowerCase() !== "false";
