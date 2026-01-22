export function normalizeSearchTerm(searchTerm: string) {
  return searchTerm
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[':()&|!<>]/g, ""))
    .map((token) => `${token}:*`)
    .join(" & ");
}
