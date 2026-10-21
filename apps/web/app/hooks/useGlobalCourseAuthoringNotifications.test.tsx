import "~/utils/mocks/i18next.mock";

import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  authoringSessionKey,
  refreshAuthoringSession,
} from "~/api/queries/useCourseAuthoringSessionQuery";
import { queryClient } from "~/api/queryClient";
import { Toast, ToastProvider, ToastViewport } from "~/components/ui/toast";
import { useAuthStore } from "~/modules/Auth/authStore";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";
import {
  authoringSessionVisibility,
  useVisibleAuthoringSession,
} from "~/modules/CourseAuthoring/authoringSessionVisibility";

import { useGlobalCourseAuthoringNotifications } from "./useGlobalCourseAuthoringNotifications";

import type { CurrentUserResponse } from "~/api/generated-api";
import type { toast } from "~/components/ui/use-toast";
import type {
  AuthoringSession,
  AuthoringTurnStatus,
} from "~/modules/CourseAuthoring/courseAuthoring.types";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn<(...args: unknown[]) => Promise<AuthoringSession>>(),
  toast: vi.fn((_options: Parameters<typeof toast>[0]) => ({
    id: "notice",
    dismiss: vi.fn(),
    update: vi.fn(),
  })),
  navigate: vi.fn(),
}));

vi.mock("~/modules/CourseAuthoring/courseAuthoring.api", () => ({
  getAuthoringSession: mocks.getSession,
}));
vi.mock("~/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@remix-run/react", () => ({ useNavigate: () => mocks.navigate }));

const session = (status: AuthoringTurnStatus, sequence = 1): AuthoringSession => ({
  schemaVersion: 1,
  sessionId: "session-a",
  courseId: "course-a",
  language: "en",
  status: "active",
  snapshotSequence: sequence,
  workspaceRevision: 1,
  records: [],
  tasks: [],
  turns: [
    {
      requestId: "request-a",
      messageId: "message-a",
      status,
      taskIds: [],
      parts: [],
      firstSequence: 1,
      updatedSequence: sequence,
    },
  ],
});
const key = authoringSessionKey("course-a", "session-a");
const setActor = (id: string | undefined) => {
  useAuthStore.setState({ isLoggedIn: Boolean(id) });
  useCurrentUserStore.setState({
    currentUser: id ? ({ id } as CurrentUserResponse["data"]) : undefined,
  });
};

describe("global authoring notification ownership", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    queryClient.clear();
    authoringSessionVisibility.setState({}, true);
    setActor("actor-a");
  });
  afterEach(() => {
    queryClient.clear();
    setActor(undefined);
    vi.useRealTimers();
  });

  it("publishes the current actor's polled completion to the shared cache", async () => {
    mocks.getSession.mockResolvedValue(session("completed", 2));
    queryClient.setQueryData(key, session("running"));
    const { unmount } = renderHook(useGlobalCourseAuthoringNotifications);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(queryClient.getQueryData<AuthoringSession>(key)?.snapshotSequence).toBe(2);
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    unmount();
  });

  it.each([
    ["waiting_author", "AI needs your input to continue."],
    ["failed", "AI could not finish this request."],
    ["completed", "AI’s response is ready."],
    ["outline", "Your course outline is ready to review."],
    ["changes", "Your course changes are ready to review."],
  ] as const)("describes the %s outcome in the toast", (kind, description) => {
    queryClient.setQueryData(key, session("running"));
    const { unmount } = renderHook(useGlobalCourseAuthoringNotifications);
    vi.setSystemTime(Date.now() + 10_000);
    const ready = session(kind === "outline" || kind === "changes" ? "completed" : kind, 2);
    if (kind === "outline" || kind === "changes") {
      ready.tasks = [
        {
          taskId: "task-a",
          requestId: "request-a",
          status: "waiting_author",
          errorCode: null,
          outputId: "proposal-a",
        },
      ];
      ready.records = [
        {
          id: "proposal-a",
          kind: "proposal",
          payload: {
            taskId: "task-a",
            revision: 1,
            outline:
              kind === "outline" ? [{ id: "chapter-a", title: "Introduction", lessons: [] }] : null,
            operations:
              kind === "changes"
                ? [
                    {
                      operationId: "operation-a",
                      type: "course.update",
                      targetId: "course-a",
                      dependencies: [],
                      payload: { title: "New course title" },
                    },
                  ]
                : [],
          },
        },
      ];
    }
    act(() => {
      queryClient.setQueryData(key, ready);
    });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description }));
    unmount();
  });

  it("preserves unguarded refresh callers and their monotonic cache behavior", async () => {
    mocks.getSession
      .mockResolvedValueOnce(session("running", 2))
      .mockResolvedValueOnce(session("running", 1));
    await refreshAuthoringSession("course-a", "session-a");
    await refreshAuthoringSession("course-a", "session-a");
    expect(queryClient.getQueryData<AuthoringSession>(key)?.snapshotSequence).toBe(2);
  });

  it.each(["waiting_author", "failed", "completed"] as const)(
    "suppresses %s notices while the same session is visible",
    (outcome) => {
      queryClient.setQueryData(key, session("running"));
      const { unmount } = renderHook(() => {
        useVisibleAuthoringSession("course-a", "session-a");
        useGlobalCourseAuthoringNotifications();
      });
      vi.setSystemTime(Date.now() + 10_000);
      act(() => {
        queryClient.setQueryData(key, session(outcome, 2));
      });
      expect(mocks.toast).not.toHaveBeenCalled();
      unmount();
    },
  );

  it("dismisses an existing attention toast on reopening and resumes background notices on close", () => {
    queryClient.setQueryData(key, session("running"));
    const { rerender, unmount } = renderHook(
      ({ open }) => {
        useVisibleAuthoringSession("course-a", "session-a", open);
        useGlobalCourseAuthoringNotifications();
      },
      { initialProps: { open: false } },
    );
    vi.setSystemTime(Date.now() + 10_000);
    act(() => {
      queryClient.setQueryData(key, session("waiting_author", 2));
    });
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    const attention = mocks.toast.mock.results[0].value;

    rerender({ open: true });
    expect(attention.dismiss).toHaveBeenCalledTimes(1);
    rerender({ open: false });
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    act(() => {
      queryClient.setQueryData(key, session("completed", 3));
    });
    expect(mocks.toast).toHaveBeenCalledTimes(2);
    expect(mocks.toast).toHaveBeenLastCalledWith({
      description: expect.any(String),
      action: expect.anything(),
      variant: "default",
      duration: 15_000,
    });
    unmount();
    expect(attention.dismiss).toHaveBeenCalledTimes(1);
  });

  it.each(["current", "logout", "switch"] as const)(
    "opens the exact course drawer only for the current actor (%s)",
    (actor) => {
      queryClient.setQueryData(key, session("running"));
      const { unmount } = renderHook(useGlobalCourseAuthoringNotifications);
      act(() => {
        queryClient.setQueryData(key, session("waiting_author", 2));
      });
      const { action } = mocks.toast.mock.calls[0][0];
      render(
        <ToastProvider>
          <Toast open>{action}</Toast>
          <ToastViewport />
        </ToastProvider>,
      );
      if (actor !== "current") {
        act(() => setActor(actor === "switch" ? "actor-b" : undefined));
      }
      fireEvent.click(screen.getByRole("button", { name: "View" }));
      if (actor === "current") {
        expect(mocks.navigate).toHaveBeenCalledWith(
          "/admin/beta-courses/course-a?tab=Curriculum&aiGeneration=true&sessionId=session-a",
        );
      } else {
        expect(mocks.navigate).not.toHaveBeenCalled();
      }
      unmount();
    },
  );

  it.each([
    ["course-a", "session-b"],
    ["course-b", "session-a"],
  ])("still notifies while a different session %s/%s is visible", (courseId, sessionId) => {
    queryClient.setQueryData(key, session("running"));
    const { unmount } = renderHook(() => {
      useVisibleAuthoringSession(courseId, sessionId);
      useGlobalCourseAuthoringNotifications();
    });
    act(() => {
      queryClient.setQueryData(key, session("waiting_author", 2));
    });
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("rejects actor A's delayed poll before it can enter actor B's query cache", async () => {
    let resolvePoll: (snapshot: AuthoringSession) => void = () => {};
    const delayed = new Promise<AuthoringSession>((resolve) => {
      resolvePoll = resolve;
    });
    mocks.getSession.mockReturnValue(delayed);
    queryClient.setQueryData(key, session("running"));
    const { unmount } = renderHook(useGlobalCourseAuthoringNotifications);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mocks.getSession).toHaveBeenCalledTimes(1);

    act(() => {
      setActor(undefined);
      queryClient.clear();
    });
    act(() => {
      setActor("actor-b");
    });
    await act(async () => {
      resolvePoll(session("running", 2));
      await delayed;
    });

    expect(queryClient.getQueryData(key)).toBeUndefined();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
    expect(mocks.toast).not.toHaveBeenCalled();
    unmount();
  });

  it.each(["logout", "switch", "unmount"] as const)(
    "dismisses owned notices on %s and suppresses a disposed poll's toast and cache write",
    async (change) => {
      let resolvePoll: (snapshot: AuthoringSession) => void = () => {};
      const delayed = new Promise<AuthoringSession>((resolve) => {
        resolvePoll = resolve;
      });
      mocks.getSession.mockReturnValue(delayed);
      queryClient.setQueryData(key, session("running"));
      const { unmount } = renderHook(useGlobalCourseAuthoringNotifications);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      act(() => {
        queryClient.setQueryData(
          key,
          session(change === "switch" ? "failed" : "waiting_author", 2),
        );
      });
      expect(mocks.toast).toHaveBeenCalledTimes(1);
      const notice = mocks.toast.mock.results[0].value;

      act(() => {
        if (change === "unmount") unmount();
        else setActor(change === "switch" ? "actor-b" : undefined);
      });
      expect(notice.dismiss).toHaveBeenCalledTimes(1);
      queryClient.clear();
      await act(async () => {
        resolvePoll(session("failed", 3));
        await delayed;
      });
      expect(queryClient.getQueryData(key)).toBeUndefined();
      expect(mocks.toast).toHaveBeenCalledTimes(1);
      unmount();
    },
  );

  it("replaces a persistent attention notice when the request finishes", async () => {
    queryClient.setQueryData(key, session("running"));
    const { unmount } = renderHook(useGlobalCourseAuthoringNotifications);
    // The current request is long enough to announce completion without starting a poll.
    vi.setSystemTime(Date.now() + 10_000);
    act(() => {
      queryClient.setQueryData(key, session("waiting_author", 2));
    });
    const attention = mocks.toast.mock.results[0].value;
    act(() => {
      queryClient.setQueryData(key, session("completed", 3));
    });
    expect(attention.dismiss).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledTimes(2);
    unmount();
    expect(mocks.toast.mock.results[1].value.dismiss).toHaveBeenCalledTimes(1);
  });
});
