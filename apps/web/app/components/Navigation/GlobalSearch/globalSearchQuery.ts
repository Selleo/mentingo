export const GLOBAL_SEARCH_QUERY = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 500,
  NATURAL_LANGUAGE_MIN_WORDS: 3,
} as const;

/** Keyboard index of the pinned "Search with AI" row, which sits above the first result. */
export const ASK_AI_INDEX = -1;

export const isSearchableQuery = (query: string) =>
  query.trim().length >= GLOBAL_SEARCH_QUERY.MIN_LENGTH;

/**
 * Sentences and questions rarely match titles, so for them Enter selects the AI row first.
 * Short title-like queries keep Enter on the top keyword match, so a paid embedding request is
 * never the accidental default for a lookup.
 */
export const isNaturalLanguageQuery = (query: string) => {
  const trimmed = query.trim();
  if (!isSearchableQuery(trimmed)) return false;
  if (trimmed.endsWith("?")) return true;
  return trimmed.split(/\s+/).length >= GLOBAL_SEARCH_QUERY.NATURAL_LANGUAGE_MIN_WORDS;
};

const MIN_EXPLAINING_TERM_LENGTH = 3;

/**
 * True when every meaningful query term already appears in the title. The excerpt then only
 * repeats what the title shows, so the row stays compact; otherwise the excerpt explains the hit.
 */
export const titleExplainsMatch = (title: string, query: string) => {
  const normalizedTitle = title.toLocaleLowerCase();
  const terms = query
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter((term) => term.length >= MIN_EXPLAINING_TERM_LENGTH);
  return terms.length > 0 && terms.every((term) => normalizedTitle.includes(term));
};
