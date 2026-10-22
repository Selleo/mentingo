import { SEMANTIC_SEARCH_MAX_DISTANCE } from "./semantic-search-index.constants";

import type { SearchEntityType, MatchRow } from "./global-search.types";

/** Fuse entity rankings, not chunk counts or incomparable lexical/vector scores. */
export function fuseSearchMatches<T extends MatchRow & { entityType?: SearchEntityType }>(
  keyword: T[],
  semantic: T[],
): T[] {
  const matches = new Map<string, T>();
  for (const ranking of [keyword, semantic]) {
    const seen = new Set<string>();
    let position = 0;
    for (const candidate of ranking) {
      const key = `${candidate.entityType ?? ""}:${candidate.entityId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      position++;
      const previous = matches.get(key);
      const evidence = previous?.matchedPassage ? previous : candidate;
      matches.set(key, {
        ...candidate,
        ...previous,
        languages: [...new Set([...(previous?.languages ?? []), ...candidate.languages])],
        rank: (previous?.rank ?? 0) + 1 / (60 + position),
        matchedPassage: evidence.matchedPassage,
        matchedAttachmentFileName: evidence.matchedAttachmentFileName,
      });
    }
  }
  return [...matches.values()].sort(
    (a, b) =>
      b.rank - a.rank ||
      a.entityId.localeCompare(b.entityId) ||
      (a.entityType ?? "").localeCompare(b.entityType ?? ""),
  );
}

/** Rank all content types together; lexical and cosine scores are only compared within their own lists.
 * The semantic floor is applied before fusion so a weak first vector hit cannot gain a high rank.
 */
export function rankContentMatches<T extends MatchRow & { entityType: SearchEntityType }>(
  keyword: T[],
  semantic: T[],
): T[] {
  const compare = (a: T, b: T) =>
    b.rank - a.rank ||
    a.entityId.localeCompare(b.entityId) ||
    a.entityType.localeCompare(b.entityType);
  return fuseSearchMatches(
    [...keyword].sort(compare),
    semantic.filter((match) => match.rank >= 1 - SEMANTIC_SEARCH_MAX_DISTANCE).sort(compare),
  );
}
