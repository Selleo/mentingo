export function normalizeSearchTerm(searchTerm: string) {
  return (searchTerm.match(/[\p{L}\p{N}_]+/gu) ?? []).map((token) => `${token}:*`).join(" & ");
}
