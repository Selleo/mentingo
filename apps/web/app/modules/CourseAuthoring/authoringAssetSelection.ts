/** Preserve unapplied image choices when the author closes and reopens the drawer. */
export const assetSelectionKey = (courseId: string, sessionId: string) =>
  `course-authoring-assets:${courseId}:${sessionId}`;

export const readOmittedAssets = (key: string): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? "[]");
    return Array.isArray(stored)
      ? [...new Set(stored.filter((value): value is string => typeof value === "string"))]
      : [];
  } catch {
    return [];
  }
};

export const writeOmittedAssets = (key: string, ids: string[]) => {
  if (typeof window === "undefined") return;
  try {
    if (ids.length) window.sessionStorage.setItem(key, JSON.stringify(ids));
    else window.sessionStorage.removeItem(key);
  } catch {
    // Storage may be unavailable; the current drawer still keeps the selection.
  }
};
