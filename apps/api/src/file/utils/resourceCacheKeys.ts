export const CONTEXT_TTL = 60 * 60 * 24; // 1 day in seconds

export function getContextKey(contextId: string) {
  return `context:${contextId}`;
}
