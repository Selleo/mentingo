import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendAuthoringCommand } from "~/modules/CourseAuthoring/courseAuthoring.api";

import { refreshAuthoringSession } from "../queries/useCourseAuthoringSessionQuery";

import { useCourseAuthoringCommand } from "./useCourseAuthoringCommand";

import type { PropsWithChildren } from "react";

vi.mock("~/modules/CourseAuthoring/courseAuthoring.api", () => ({
  sendAuthoringCommand: vi.fn(),
}));
vi.mock("../queries/useCourseAuthoringSessionQuery", () => ({
  authoringSessionKey: (id: string, language: string) => ["course-authoring", id, language],
  refreshAuthoringSession: vi.fn(),
}));
vi.mock("../queryClient", () => ({
  queryClient: { invalidateQueries: vi.fn().mockResolvedValue(undefined) },
}));

describe("useCourseAuthoringCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves selected lesson task IDs on a source refresh command", async () => {
    const receipt = {
      commandId: "refresh-command",
      acceptedSequence: 4,
      workspaceRevision: 4,
      hash: "hash",
      requestId: null,
      taskIds: ["new-task"],
    };
    vi.mocked(sendAuthoringCommand).mockResolvedValue(receipt);
    vi.mocked(refreshAuthoringSession).mockRejectedValue(new Error("read unavailable"));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useCourseAuthoringCommand({ courseId: "course", language: "en", sessionId: "session" }),
      { wrapper },
    );
    const command = {
      action: "source.refresh" as const,
      targetId: "old-source",
      replacementSourceVersionId: "replacement-source",
      selectedTaskIds: ["lesson-task-1", "lesson-task-2"],
    };

    await act(async () => {
      await expect(result.current.mutateAsync(command)).resolves.toEqual(receipt);
    });

    expect(sendAuthoringCommand).toHaveBeenCalledWith("course", "session", command);
    client.clear();
  });

  it("preserves an accepted command when the following snapshot read fails", async () => {
    const receipt = {
      commandId: "accepted",
      acceptedSequence: 4,
      workspaceRevision: 4,
      hash: "hash",
      requestId: null,
      taskIds: null,
    };
    vi.mocked(sendAuthoringCommand).mockResolvedValue(receipt);
    vi.mocked(refreshAuthoringSession).mockRejectedValue(new Error("read unavailable"));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => useCourseAuthoringCommand({ courseId: "course", language: "en", sessionId: "session" }),
      { wrapper },
    );
    await act(async () => {
      await expect(
        result.current.mutateAsync({ action: "session.pause", commandId: "command-1" }),
      ).resolves.toEqual(receipt);
    });
    expect(sendAuthoringCommand).toHaveBeenCalledTimes(1);
    expect(sendAuthoringCommand).toHaveBeenCalledWith("course", "session", {
      action: "session.pause",
      commandId: "command-1",
    });
    expect(result.current.isError).toBe(false);
    client.clear();
  });
});
