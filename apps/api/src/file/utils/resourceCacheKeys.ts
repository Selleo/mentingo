export const CONTEXT_TTL = 86_400; // 1 day in seconds

export function getContextKey(contextId: string) {
  return `context:${contextId}`;
}
