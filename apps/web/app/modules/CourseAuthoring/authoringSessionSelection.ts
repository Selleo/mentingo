import type { AuthoringSessionSummary } from "./courseAuthoring.types";
import type { SupportedLanguages } from "@repo/shared";

const STORAGE_PREFIX = "course-authoring.selected-session";
const CREATE_COMMAND_SUFFIX = "create-command";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AuthoringSessionCommandId = ReturnType<typeof crypto.randomUUID>;

/** Builds a browser-local selection key that cannot cross the current tenant origin, course, or language. */
export const authoringSessionSelectionKey = (
  courseId: string,
  language: SupportedLanguages,
  tenantScope = typeof window === "undefined" ? "server" : window.location.host,
) => [STORAGE_PREFIX, tenantScope, courseId, language].join(":");

/** Keeps an automatic replacement idempotent across StrictMode and a drawer remount. */
export const authoringSessionCreateCommandKey = (selectionKey: string) =>
  `${selectionKey}:${CREATE_COMMAND_SUFFIX}`;

/** Returns a saved selection only after it is present in the freshly authorized summaries. */
export const selectAuthoringSession = (
  sessions: AuthoringSessionSummary[],
  persistedSessionId: string | null,
) => {
  if (persistedSessionId && sessions.some((session) => session.sessionId === persistedSessionId)) {
    return persistedSessionId;
  }

  return (
    sessions.find((session) => session.status === "active" || session.status === "paused")
      ?.sessionId ?? null
  );
};

/** Reads a browser-local selection without making server rendering depend on storage. */
export const readAuthoringSessionSelection = (key: string) => {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(key);
};

/** Replaces the selection only in its tenant, course, and language scope. */
export const writeAuthoringSessionSelection = (key: string, sessionId: string | null) => {
  if (typeof window === "undefined") return;
  if (sessionId) window.sessionStorage.setItem(key, sessionId);
  else window.sessionStorage.removeItem(key);
};

/** Reuses one pending creation command until the server has returned its durable session. */
export const getOrCreateAuthoringSessionCommand = (key: string) => {
  const saved = readAuthoringSessionSelection(key);
  if (saved && UUID_PATTERN.test(saved)) return saved as AuthoringSessionCommandId;
  const commandId = crypto.randomUUID();
  writeAuthoringSessionSelection(key, commandId);
  return commandId;
};
