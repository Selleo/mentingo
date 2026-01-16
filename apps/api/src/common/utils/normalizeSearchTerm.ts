export function normalizeSearchTerm(searchTerm: string) {
  return searchTerm
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[':()&|!<>]/g, ""))
    .filter(Boolean)
    .map((token) => `${token}:*`)
    .join(" & ");
}
