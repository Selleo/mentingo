export const CONTEXT_TTL = 24 * 60 * 60 * 1000; // 1 day in milliseconds

export function getContextKey(contextId: string) {
  return `context:${contextId}`;
}
