import {
  AI_MENTOR_CONFIGURATION_GENERATION_MODE,
  AI_MENTOR_CONFIGURATION_GENERATION_SOCKET_EVENTS,
  AI_MENTOR_CONFIGURATION_GENERATION_STATUS,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
  USER_SOCKET_EVENTS,
} from "@repo/shared";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_MENTOR_CONFIGURATION_GENERATION_QUERY_KEY } from "~/api/queries/admin/useAiMentorConfigurationGenerationSnapshot";

import { useAiMentorConfigurationGeneration } from "./useAiMentorConfigurationGeneration";

import type { AiMentorGenerationSnapshot } from "./aiMentorGeneration.types";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  cancel: vi.fn(),
  revise: vi.fn(),
  refetch: vi.fn(),
  setQueryData: vi.fn(),
  invalidateQueries: vi.fn(),
  acquireSocket: vi.fn(),
  releaseSocket: vi.fn(),
  socket: {
    connected: false,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
  },
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock("~/api/mutations/admin/useStartAiMentorConfigurationGeneration", () => ({
  useStartAiMentorConfigurationGeneration: () => ({
    mutateAsync: mocks.start,
    isPending: false,
  }),
}));

vi.mock("~/api/mutations/admin/useCancelAiMentorConfigurationGeneration", () => ({
  useCancelAiMentorConfigurationGeneration: () => ({
    mutateAsync: mocks.cancel,
    isPending: false,
  }),
}));

vi.mock("~/api/mutations/admin/useReviseAiMentorConfigurationGeneration", () => ({
  useReviseAiMentorConfigurationGeneration: () => ({
    mutateAsync: mocks.revise,
    isPending: false,
  }),
}));

vi.mock("~/api/queries/admin/useAiMentorConfigurationGenerationSnapshot", () => ({
  AI_MENTOR_CONFIGURATION_GENERATION_QUERY_KEY: ["ai-mentor-configuration-generation"],
  useAiMentorConfigurationGenerationSnapshot: (generationId?: string) => {
    const snapshot: AiMentorGenerationSnapshot = {
      generationId: "generation-1",
      progress: {
        status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.AWAITING_REVISION,
        attempt: 1,
        configuration: {
          type: AI_MENTOR_TYPE.TEACHER,
          taskGoal: "Goal",
          expertise: "Expertise",
          contentScope: "Scope",
          teachingStyle: AI_MENTOR_TEACHING_STYLE.SOCRATIC,
        },
        validation: {
          passed: false,
          summary: "Needs revision.",
          issues: [],
        },
        attemptHistory: [],
      },
    };

    return {
      data: generationId ? snapshot : undefined,
      refetch: mocks.refetch,
      isFetching: false,
    };
  },
}));

vi.mock("~/api/queryClient", () => ({
  queryClient: {
    setQueryData: mocks.setQueryData,
    invalidateQueries: mocks.invalidateQueries,
  },
}));

vi.mock("~/api/socket", () => ({
  acquireSocket: mocks.acquireSocket,
  releaseSocket: mocks.releaseSocket,
}));

describe("useAiMentorConfigurationGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.start.mockResolvedValue({ generationId: "generation-1" });
    mocks.cancel.mockResolvedValue({
      generationId: "generation-1",
      cancellationRequested: true,
    });
    mocks.revise.mockResolvedValue({ generationId: "generation-2" });
    mocks.refetch.mockResolvedValue(undefined);
    mocks.invalidateQueries.mockResolvedValue(undefined);
    mocks.acquireSocket.mockReturnValue(mocks.socket);
    mocks.socket.on.mockImplementation(
      (event: string, handler: (...args: unknown[]) => unknown) => {
        mocks.handlers.set(event, handler);
        return mocks.socket;
      },
    );
    mocks.socket.off.mockReturnValue(mocks.socket);
    mocks.socket.emit.mockReturnValue(mocks.socket);
    mocks.socket.connect.mockReturnValue(mocks.socket);
  });

  it("seeds cache, reconnects/refetches, accepts matching socket progress, cancels, and revises", async () => {
    const { result } = renderHook(() => useAiMentorConfigurationGeneration());
    const input = {
      courseId: "course-1",
      lessonContext: {},
      mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE,
      configurationType: AI_MENTOR_TYPE.TEACHER,
      brief: "Create a security teacher.",
    };

    await act(async () => {
      await result.current.startGeneration(input);
    });

    expect(result.current.generationType).toBe(AI_MENTOR_TYPE.TEACHER);
    expect(mocks.setQueryData).toHaveBeenCalledWith(
      [...AI_MENTOR_CONFIGURATION_GENERATION_QUERY_KEY, "generation-1"],
      {
        generationId: "generation-1",
        progress: {
          status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.DRAFTING,
          attempt: 1,
          attemptHistory: [],
        },
      },
    );

    const reconnect = mocks.handlers.get("connect");
    await act(async () => {
      await reconnect?.();
    });
    expect(mocks.socket.emit).toHaveBeenCalledWith(USER_SOCKET_EVENTS.JOIN);
    expect(mocks.refetch).toHaveBeenCalled();

    mocks.setQueryData.mockClear();
    const progress = mocks.handlers.get(AI_MENTOR_CONFIGURATION_GENERATION_SOCKET_EVENTS.PROGRESS);
    const socketSnapshot: AiMentorGenerationSnapshot = {
      generationId: "generation-1",
      progress: {
        status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.EVALUATING,
        attempt: 1,
        draft: {
          type: AI_MENTOR_TYPE.TEACHER,
          taskGoal: "Goal",
          expertise: "Expertise",
          contentScope: "Scope",
          teachingStyle: AI_MENTOR_TEACHING_STYLE.SOCRATIC,
        },
        attemptHistory: [],
      },
    };
    act(() => {
      progress?.(socketSnapshot);
    });
    expect(mocks.setQueryData).toHaveBeenCalledWith(
      [...AI_MENTOR_CONFIGURATION_GENERATION_QUERY_KEY, "generation-1"],
      socketSnapshot,
    );

    await act(async () => {
      await result.current.cancelGeneration();
    });
    expect(mocks.cancel).toHaveBeenCalledWith("generation-1");
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: [...AI_MENTOR_CONFIGURATION_GENERATION_QUERY_KEY, "generation-1"],
    });

    await act(async () => {
      await result.current.reviseGeneration();
    });
    expect(mocks.revise).toHaveBeenCalledWith("generation-1");
    expect(mocks.setQueryData).toHaveBeenLastCalledWith(
      [...AI_MENTOR_CONFIGURATION_GENERATION_QUERY_KEY, "generation-2"],
      {
        generationId: "generation-2",
        progress: {
          status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.DRAFTING,
          attempt: 2,
          attemptHistory: [],
        },
      },
    );
    expect(mocks.releaseSocket).toHaveBeenCalled();
  });

  it("ignores socket progress for another generation", async () => {
    const { result } = renderHook(() => useAiMentorConfigurationGeneration());

    await act(async () => {
      await result.current.startGeneration({
        courseId: "course-1",
        lessonContext: {},
        mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE,
        configurationType: AI_MENTOR_TYPE.TEACHER,
        brief: "Create a security teacher.",
      });
    });
    mocks.setQueryData.mockClear();

    act(() => {
      mocks.handlers.get(AI_MENTOR_CONFIGURATION_GENERATION_SOCKET_EVENTS.PROGRESS)?.({
        generationId: "stale-generation",
        progress: {
          status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.DRAFTING,
          attempt: 1,
          attemptHistory: [],
        },
      });
    });

    expect(mocks.setQueryData).not.toHaveBeenCalled();
  });
});
