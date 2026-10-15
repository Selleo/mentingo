import type { MatchRow } from "./global-search.types";

/** Fuse entity rankings, not chunk counts or incomparable lexical/vector scores. */
export function fuseSearchMatches(keyword: MatchRow[], semantic: MatchRow[]): MatchRow[] {
  const matches = new Map<string, MatchRow>();
  for (const ranking of [keyword, semantic]) {
    const seen = new Set<string>();
    let position = 0;
    for (const candidate of ranking) {
      if (seen.has(candidate.entityId)) continue;
      seen.add(candidate.entityId);
      position++;
      const previous = matches.get(candidate.entityId);
      const evidence = previous?.matchedPassage ? previous : candidate;
      matches.set(candidate.entityId, {
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
    (a, b) => b.rank - a.rank || a.entityId.localeCompare(b.entityId),
  );
}
