import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryClient } from "~/api/queryClient";
import { getAuthoringSession } from "~/modules/CourseAuthoring/courseAuthoring.api";

import { authoringSessionKey, refreshAuthoringSession } from "./useCourseAuthoringSessionQuery";

import type { AuthoringSession } from "~/modules/CourseAuthoring/courseAuthoring.types";

vi.mock("~/modules/CourseAuthoring/courseAuthoring.api", () => ({
  getAuthoringSession: vi.fn(),
}));

const snapshot = (sequence: number): AuthoringSession => ({
  schemaVersion: 1,
  sessionId: "session",
  courseId: "course",
  language: "en",
  status: "active",
  snapshotSequence: sequence,
  workspaceRevision: sequence,
  records: [],
  tasks: [],
});

describe("authoring snapshot refresh ownership", () => {
  beforeEach(() => {
    vi.mocked(getAuthoringSession).mockReset();
    queryClient.clear();
  });

  it("does not let an aborted request overwrite the session even if its transport resolves late", async () => {
    const key = authoringSessionKey("course", "session");
    const current = snapshot(1);
    queryClient.setQueryData(key, current);
    let resolveSnapshot: (value: AuthoringSession) => void = () => undefined;
    vi.mocked(getAuthoringSession).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSnapshot = resolve;
        }),
    );
    const controller = new AbortController();
    const refresh = refreshAuthoringSession("course", "session", undefined, controller.signal);

    controller.abort();
    resolveSnapshot(snapshot(2));
    await refresh;

    expect(getAuthoringSession).toHaveBeenCalledWith("course", "session", controller.signal);
    expect(queryClient.getQueryData(key)).toEqual(current);
  });

  it("still rejects a late response after its scoped owner changes", async () => {
    const key = authoringSessionKey("course", "session");
    const current = snapshot(1);
    queryClient.setQueryData(key, current);
    vi.mocked(getAuthoringSession).mockResolvedValue(snapshot(2));

    await refreshAuthoringSession("course", "session", () => false);

    expect(getAuthoringSession).toHaveBeenCalledWith("course", "session");
    expect(queryClient.getQueryData(key)).toEqual(current);
  });
});
