import { afterEach, describe, expect, it, vi } from "vitest";

import {
  authoringSessionSelectionKey,
  authoringSessionCreateCommandKey,
  getOrCreateAuthoringSessionCommand,
  readAuthoringSessionSelection,
  selectAuthoringSession,
  writeAuthoringSessionSelection,
} from "./authoringSessionSelection";

import type { AuthoringSessionSummary } from "./courseAuthoring.types";

const sessions: AuthoringSessionSummary[] = [
  {
    sessionId: "newest",
    courseId: "course-1",
    language: "en",
    status: "active",
    title: "Newest",
    createdAt: "2026-09-22T09:00:00Z",
    lastActivityAt: "2026-09-22T10:00:00Z",
  },
  {
    sessionId: "older",
    courseId: "course-1",
    language: "en",
    status: "paused",
    title: "Older",
    createdAt: "2026-09-21T09:00:00Z",
    lastActivityAt: "2026-09-21T10:00:00Z",
  },
];

describe("authoring session selection", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("uses a persisted session only after the current authorized list includes it", () => {
    expect(selectAuthoringSession(sessions, "older")).toBe("older");
    expect(selectAuthoringSession(sessions, "deleted-session")).toBe("newest");
  });

  it("does not cross tenant, course, or language storage scopes", () => {
    const tenantA = authoringSessionSelectionKey("course-1", "en", "tenant-a.example");
    const tenantB = authoringSessionSelectionKey("course-1", "en", "tenant-b.example");
    const polish = authoringSessionSelectionKey("course-1", "pl", "tenant-a.example");
    writeAuthoringSessionSelection(tenantA, "older");

    expect(readAuthoringSessionSelection(tenantA)).toBe("older");
    expect(readAuthoringSessionSelection(tenantB)).toBeNull();
    expect(readAuthoringSessionSelection(polish)).toBeNull();
    expect(authoringSessionCreateCommandKey(tenantA)).not.toBe(
      authoringSessionCreateCommandKey(tenantB),
    );
  });

  it("leaves the workspace empty when the refreshed tenant list has no unfinished session", () => {
    expect(selectAuthoringSession([], "older")).toBeNull();
  });

  it("reuses one creation command across concurrent drawer mounts", () => {
    const key = authoringSessionCreateCommandKey(
      authoringSessionSelectionKey("course-1", "en", "tenant-a.example"),
    );
    const commandId = "00000000-0000-4000-8000-000000000042";
    const randomUUID = vi.spyOn(crypto, "randomUUID").mockReturnValue(commandId);

    expect(getOrCreateAuthoringSessionCommand(key)).toBe(commandId);
    expect(getOrCreateAuthoringSessionCommand(key)).toBe(commandId);
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });
});
