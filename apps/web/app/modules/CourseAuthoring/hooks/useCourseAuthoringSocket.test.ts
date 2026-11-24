import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACTIVE_TURN_RECONCILE_DELAY_MS,
  useCourseAuthoringSocket,
} from "./useCourseAuthoringSocket";

import type { AuthoringEvent, AuthoringSession } from "../courseAuthoring.types";

const mocks = vi.hoisted(() => ({
  acquireSocket: vi.fn(),
  releaseSocket: vi.fn(),
}));

vi.mock("~/api/socket", () => mocks);

type SocketListener = (...args: unknown[]) => void;

const createSocket = () => {
  const listeners = new Map<string, SocketListener>();
  const socket = {
    connected: true,
    emit: vi.fn(),
    on: vi.fn((event: string, listener: SocketListener) => {
      listeners.set(event, listener);
    }),
    off: vi.fn((event: string) => {
      listeners.delete(event);
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  return { listeners, socket };
};

const session = (): AuthoringSession => ({
  schemaVersion: 1,
  sessionId: "session-1",
  courseId: "course-1",
  language: "en",
  status: "active",
  snapshotSequence: 1,
  workspaceRevision: 1,
  records: [],
  tasks: [],
  turns: [],
});

const event = (sequence: number): AuthoringEvent => ({
  schemaVersion: 1,
  eventId: `event-${sequence}`,
  sessionId: "session-1",
  sequence,
  occurredAt: "2026-09-21T10:00:00.000Z",
  type: "assistant.update",
  payload: {
    turn: {
      requestId: "request-1",
      messageId: "message-1",
      status: "completed",
      taskIds: [],
      firstSequence: sequence,
      updatedSequence: sequence,
      part: null,
    },
  },
});

describe("useCourseAuthoringSocket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("projects contiguous events without refreshing the snapshot for every event", () => {
    const { listeners, socket } = createSocket();
    mocks.acquireSocket.mockReturnValue(socket);
    const onEvent = vi.fn();
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onSnapshot = vi.fn();

    renderHook(() =>
      useCourseAuthoringSocket({
        courseId: "course-1",
        session: session(),
        onSnapshot,
        onEvent,
        onRefresh,
      }),
    );

    act(() => listeners.get("authoring.event")?.(event(2)));
    act(() => listeners.get("authoring.event")?.(event(3)));

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent.mock.calls[1]?.[0].snapshotSequence).toBe(3);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("coalesces a gap recovery and rejoins after the refresh completes", async () => {
    const { listeners, socket } = createSocket();
    mocks.acquireSocket.mockReturnValue(socket);
    let resolveRefresh: (snapshot: AuthoringSession) => void = () => undefined;
    const onRefresh = vi.fn(
      () =>
        new Promise<AuthoringSession>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const onSnapshot = vi.fn();

    renderHook(() =>
      useCourseAuthoringSocket({
        courseId: "course-1",
        session: session(),
        onSnapshot,
        onRefresh,
      }),
    );

    act(() => listeners.get("authoring.event")?.(event(3)));
    act(() => listeners.get("authoring.resync")?.({ sessionId: "session-1" }));
    expect(onRefresh).toHaveBeenCalledOnce();

    const recovered = { ...session(), snapshotSequence: 3, workspaceRevision: 3 };
    await act(async () => resolveRefresh(recovered));
    await waitFor(() => expect(onSnapshot).toHaveBeenCalledWith(recovered));

    const joinCalls = socket.emit.mock.calls.filter(([name]) => name === "join:course-authoring");
    expect(joinCalls.at(-1)?.[1]).toMatchObject({ afterSequence: 3 });
  });

  it("does not retry after permission revocation", async () => {
    const { listeners, socket } = createSocket();
    mocks.acquireSocket.mockReturnValue(socket);
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onPermissionRevoked = vi.fn();
    const onSnapshot = vi.fn();
    const { result } = renderHook(() =>
      useCourseAuthoringSocket({
        courseId: "course-1",
        session: session(),
        onSnapshot,
        onRefresh,
        onPermissionRevoked,
      }),
    );

    act(() =>
      listeners.get("authoring.error")?.({ sessionId: "session-1", code: "permission_revoked" }),
    );
    act(() => listeners.get("authoring.resync")?.({ sessionId: "session-1" }));

    await waitFor(() => expect(result.current).toBe("permission_revoked"));
    expect(onRefresh).not.toHaveBeenCalled();
    expect(onPermissionRevoked).toHaveBeenCalledOnce();
  });

  it("leaves once and never rejoins a session the gateway says is missing", async () => {
    const { listeners, socket } = createSocket();
    mocks.acquireSocket.mockReturnValue(socket);
    const onSessionUnavailable = vi.fn();
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onSnapshot = vi.fn();

    renderHook(() =>
      useCourseAuthoringSocket({
        courseId: "course-1",
        session: session(),
        onSnapshot,
        onRefresh,
        onSessionUnavailable,
      }),
    );

    act(() =>
      listeners.get("authoring.error")?.({ sessionId: "session-1", code: "session_not_found" }),
    );
    act(() => listeners.get("connect")?.());
    act(() => listeners.get("authoring.resync")?.({ sessionId: "session-1" }));

    expect(onSessionUnavailable).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith("leave:course-authoring", { sessionId: "session-1" });
    expect(onRefresh).not.toHaveBeenCalled();
    expect(
      socket.emit.mock.calls.filter(([eventName]) => eventName === "join:course-authoring"),
    ).toHaveLength(1);
  });

  it("refreshes when the socket handshake fails before any authoring event arrives", async () => {
    const { listeners, socket } = createSocket();
    mocks.acquireSocket.mockReturnValue(socket);
    const recovered = { ...session(), snapshotSequence: 4 };
    const onRefresh = vi.fn().mockResolvedValue(recovered);
    const onSnapshot = vi.fn();

    renderHook(() =>
      useCourseAuthoringSocket({
        courseId: "course-1",
        session: session(),
        onSnapshot,
        onRefresh,
      }),
    );

    act(() => listeners.get("connect_error")?.(new Error("handshake failed")));

    await waitFor(() => expect(onSnapshot).toHaveBeenCalledWith(recovered));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("projects the delivered 182-184 terminal sequence into one completed turn", () => {
    const { listeners, socket } = createSocket();
    mocks.acquireSocket.mockReturnValue(socket);
    const onEvent = vi.fn();
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const onSnapshot = vi.fn();
    const routeRequestId = "2932f0a8-5025-4a75-af15-00274176b83d";
    const routeTaskId = "a6d87eee-75fe-4b64-af5b-26e003131e23";
    const messageId = `${routeRequestId}-assistant`;
    const turn = (sequence: number, status: "running" | "completed", part: unknown) => ({
      requestId: routeRequestId,
      messageId,
      status,
      taskIds: [routeTaskId],
      firstSequence: 178,
      updatedSequence: sequence,
      part,
    });
    const part = (sequence: number, status: "streaming" | "completed") => ({
      requestId: routeRequestId,
      messageId,
      partId: `assistant:${routeTaskId}:route`,
      partKind: "text",
      taskId: routeTaskId,
      status,
      firstSequence: 182,
      updatedSequence: sequence,
      text: "Hi!",
      tool: null,
      artifact: null,
    });
    const delivered = (sequence: number, status: "running" | "completed", turnPart: unknown) => ({
      schemaVersion: 1 as const,
      eventId: `event-${sequence}`,
      sessionId: "session-1",
      sequence,
      occurredAt: "2026-09-21T10:00:00.000Z",
      type:
        sequence === 184
          ? "task.succeeded"
          : sequence === 183
            ? "assistant.message"
            : "assistant.delta",
      payload: {
        turn: turn(sequence, status, turnPart),
        ...(sequence === 184 ? { taskId: routeTaskId, requestId: routeRequestId } : {}),
      },
    });
    renderHook(() =>
      useCourseAuthoringSocket({
        courseId: "course-1",
        session: { ...session(), snapshotSequence: 181 },
        onSnapshot,
        onEvent,
        onRefresh,
      }),
    );
    act(() =>
      listeners.get("authoring.event")?.(delivered(182, "running", part(182, "streaming"))),
    );
    act(() =>
      listeners.get("authoring.event")?.(delivered(183, "running", part(183, "completed"))),
    );
    act(() => listeners.get("authoring.event")?.(delivered(184, "completed", null)));

    expect(onEvent).toHaveBeenCalledTimes(3);
    expect(onEvent.mock.calls.at(-1)?.[0].turns).toEqual([
      expect.objectContaining({
        requestId: routeRequestId,
        status: "completed",
        updatedSequence: 184,
      }),
    ]);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("reconciles an active turn after the socket goes silent", async () => {
    vi.useFakeTimers();
    try {
      const { listeners, socket } = createSocket();
      mocks.acquireSocket.mockReturnValue(socket);
      const activeSnapshot = {
        ...session(),
        snapshotSequence: 182,
        turns: [
          {
            requestId: "request-1",
            messageId: "message-1",
            status: "running" as const,
            taskIds: [],
            parts: [],
            firstSequence: 2,
            updatedSequence: 182,
          },
        ],
      };
      const terminalSnapshot = {
        ...session(),
        snapshotSequence: 184,
        turns: [
          {
            requestId: "request-1",
            messageId: "message-1",
            status: "completed",
            taskIds: [],
            parts: [],
            firstSequence: 2,
            updatedSequence: 184,
          },
        ],
      };
      const onRefresh = vi
        .fn()
        .mockResolvedValueOnce(activeSnapshot)
        .mockResolvedValueOnce(terminalSnapshot);
      const onSnapshot = vi.fn();

      renderHook(() =>
        useCourseAuthoringSocket({
          courseId: "course-1",
          session: {
            ...session(),
            snapshotSequence: 181,
            turns: [
              {
                requestId: "request-1",
                messageId: "message-1",
                status: "running",
                taskIds: [],
                parts: [],
                firstSequence: 2,
                updatedSequence: 181,
              },
            ],
          },
          onSnapshot,
          onRefresh,
        }),
      );

      const streamingEvent: AuthoringEvent = {
        schemaVersion: 1,
        eventId: "event-182",
        sessionId: "session-1",
        sequence: 182,
        occurredAt: "2026-09-21T10:00:00.000Z",
        type: "assistant.delta",
        payload: {
          turn: {
            requestId: "request-1",
            messageId: "message-1",
            status: "running",
            taskIds: [],
            firstSequence: 2,
            updatedSequence: 182,
            part: {
              requestId: "request-1",
              messageId: "message-1",
              partId: "part-1",
              partKind: "text",
              taskId: null,
              status: "streaming",
              firstSequence: 182,
              updatedSequence: 182,
              text: "still working",
              tool: null,
              artifact: null,
            },
          },
        },
      };
      act(() => listeners.get("authoring.event")?.(streamingEvent));
      await act(async () => {
        vi.advanceTimersByTime(ACTIVE_TURN_RECONCILE_DELAY_MS);
        await Promise.resolve();
      });

      expect(onRefresh).toHaveBeenCalledOnce();
      act(() => listeners.get("authoring.snapshot")?.(activeSnapshot));
      await act(async () => {
        vi.advanceTimersByTime(ACTIVE_TURN_RECONCILE_DELAY_MS);
        await Promise.resolve();
      });
      expect(onRefresh).toHaveBeenCalledOnce();
      await act(async () => {
        vi.advanceTimersByTime(ACTIVE_TURN_RECONCILE_DELAY_MS);
        await Promise.resolve();
      });
      expect(onRefresh).toHaveBeenCalledTimes(2);
      expect(onSnapshot).toHaveBeenCalledWith(expect.objectContaining({ snapshotSequence: 184 }));
      const joinCalls = socket.emit.mock.calls.filter(([name]) => name === "join:course-authoring");
      expect(joinCalls).toHaveLength(1);
      await act(() => vi.advanceTimersByTimeAsync(60_000));
      expect(onRefresh).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
  it("refreshes active work without rejoining a healthy stream", async () => {
    vi.useFakeTimers();
    try {
      const { listeners, socket } = createSocket();
      mocks.acquireSocket.mockReturnValue(socket);
      const running = {
        ...session(),
        turns: [
          {
            requestId: "request-1",
            messageId: "message-1",
            status: "running",
            taskIds: [],
            parts: [],
            firstSequence: 1,
            updatedSequence: 1,
          },
        ],
      } as AuthoringSession;
      const onRefresh = vi.fn().mockResolvedValue(running);
      const onSnapshot = vi.fn();
      renderHook(() =>
        useCourseAuthoringSocket({ courseId: "course-1", session: running, onSnapshot, onRefresh }),
      );
      act(() => listeners.get("authoring.snapshot")?.(running));
      await act(() => vi.advanceTimersByTimeAsync(ACTIVE_TURN_RECONCILE_DELAY_MS));
      expect(onRefresh).toHaveBeenCalledOnce();
      expect(
        socket.emit.mock.calls.filter(([name]) => name === "join:course-authoring"),
      ).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps recovering an idle session after the fast retry budget is exhausted", async () => {
    vi.useFakeTimers();
    try {
      const { listeners, socket } = createSocket();
      mocks.acquireSocket.mockReturnValue(socket);
      const onSnapshot = vi.fn();
      const onRefresh = vi
        .fn()
        .mockRejectedValueOnce(new Error("network unavailable"))
        .mockRejectedValueOnce(new Error("network unavailable"))
        .mockRejectedValueOnce(new Error("network unavailable"))
        .mockRejectedValueOnce(new Error("network unavailable"))
        .mockResolvedValue(session());
      const { result, unmount } = renderHook(() =>
        useCourseAuthoringSocket({
          courseId: "course-1",
          session: session(),
          onSnapshot,
          onRefresh,
        }),
      );
      act(() => listeners.get("authoring.resync")?.({ sessionId: "session-1" }));
      await act(() => vi.advanceTimersByTimeAsync(4_000));
      expect(onRefresh).toHaveBeenCalledTimes(4);
      expect(result.current).toBe("offline");
      await act(() => vi.advanceTimersByTimeAsync(30_000));
      expect(onRefresh).toHaveBeenCalledTimes(5);
      act(() => listeners.get("authoring.snapshot")?.(session()));
      expect(result.current).toBe("live");
      unmount();
      await act(() => vi.advanceTimersByTimeAsync(60_000));
      expect(onRefresh).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovers when a connected socket never acknowledges joining the session", async () => {
    vi.useFakeTimers();
    try {
      const { socket } = createSocket();
      mocks.acquireSocket.mockReturnValue(socket);
      const onRefresh = vi.fn().mockResolvedValue(session());
      const { unmount } = renderHook(() =>
        useCourseAuthoringSocket({
          courseId: "course-1",
          session: session(),
          onSnapshot: vi.fn(),
          onRefresh,
        }),
      );
      await act(() => vi.advanceTimersByTimeAsync(10_000));
      expect(onRefresh).toHaveBeenCalledOnce();
      unmount();
      await act(() => vi.advanceTimersByTimeAsync(30_000));
      expect(onRefresh).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores late snapshots and events after confirmed permission revocation", () => {
    const { listeners, socket } = createSocket();
    mocks.acquireSocket.mockReturnValue(socket);
    const onSnapshot = vi.fn();
    const onEvent = vi.fn();
    const { result } = renderHook(() =>
      useCourseAuthoringSocket({
        courseId: "course-1",
        session: session(),
        onSnapshot,
        onEvent,
        onRefresh: vi.fn(),
      }),
    );
    act(() =>
      listeners.get("authoring.error")?.({ sessionId: "session-1", code: "permission_revoked" }),
    );
    act(() => listeners.get("authoring.snapshot")?.(session()));
    act(() => listeners.get("authoring.event")?.(event(2)));
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();
    expect(result.current).toBe("permission_revoked");
  });

  it("restores the same session across repeated two-minute disconnects and recovers completion", async () => {
    vi.useFakeTimers();
    try {
      const { listeners, socket } = createSocket();
      mocks.acquireSocket.mockReturnValue(socket);
      const completed = {
        ...session(),
        snapshotSequence: 4,
        turns: [
          {
            requestId: "request-1",
            messageId: "message-1",
            status: "completed",
            taskIds: [],
            parts: [],
            firstSequence: 2,
            updatedSequence: 4,
          },
        ],
      } as AuthoringSession;
      const onSnapshot = vi.fn();
      const onRefresh = vi.fn().mockResolvedValue(completed);
      const { unmount } = renderHook(() =>
        useCourseAuthoringSocket({
          courseId: "course-1",
          session: session(),
          onSnapshot,
          onRefresh,
        }),
      );
      act(() => listeners.get("authoring.snapshot")?.(session()));
      for (let cycle = 0; cycle < 3; cycle += 1) {
        await act(() => vi.advanceTimersByTimeAsync(120_000));
        socket.connected = false;
        act(() => listeners.get("disconnect")?.("transport close"));
        await act(async () => {
          await Promise.resolve();
        });
        socket.connected = true;
        act(() => listeners.get("connect")?.());
        await act(async () => {
          await Promise.resolve();
        });
        act(() => listeners.get("authoring.snapshot")?.(completed));
      }
      expect(onRefresh).toHaveBeenCalledTimes(3);
      expect(onSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "session-1",
          turns: [expect.objectContaining({ status: "completed" })],
        }),
      );
      for (const [name, payload] of socket.emit.mock.calls) {
        if (name === "join:course-authoring")
          expect(payload).toMatchObject({ sessionId: "session-1" });
      }
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });
  it("times out stalled snapshots and retries without losing the session", async () => {
    vi.useFakeTimers();
    try {
      const { listeners, socket } = createSocket();
      mocks.acquireSocket.mockReturnValue(socket);
      const onRefresh = vi.fn().mockImplementation(() => new Promise<AuthoringSession>(() => {}));
      const { result, unmount } = renderHook(() =>
        useCourseAuthoringSocket({
          courseId: "course-1",
          session: session(),
          onSnapshot: vi.fn(),
          onRefresh,
        }),
      );
      act(() => listeners.get("authoring.resync")?.({ sessionId: "session-1" }));
      await act(() => vi.advanceTimersByTimeAsync(44_000));
      expect(result.current).toBe("offline");
      expect(onRefresh).toHaveBeenCalledTimes(4);
      for (const [signal] of onRefresh.mock.calls)
        expect((signal as AbortSignal).aborted).toBe(true);
      onRefresh.mockResolvedValue(session());
      await act(() => vi.advanceTimersByTimeAsync(30_000));
      act(() => listeners.get("authoring.snapshot")?.(session()));
      expect(result.current).toBe("live");
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("arms silence recovery when a REST update first reveals running work", async () => {
    vi.useFakeTimers();
    try {
      const { listeners, socket } = createSocket();
      mocks.acquireSocket.mockReturnValue(socket);
      const onSnapshot = vi.fn();
      const onRefresh = vi.fn().mockResolvedValue(session());
      const { rerender, unmount } = renderHook(
        ({ current }) =>
          useCourseAuthoringSocket({
            courseId: "course-1",
            session: current,
            onSnapshot,
            onRefresh,
          }),
        { initialProps: { current: session() } },
      );
      act(() => listeners.get("authoring.snapshot")?.(session()));
      rerender({
        current: {
          ...session(),
          turns: [
            {
              requestId: "request-1",
              messageId: "message-1",
              status: "running",
              taskIds: [],
              parts: [],
              firstSequence: 1,
              updatedSequence: 1,
            },
          ],
        } as AuthoringSession,
      });
      await act(() => vi.advanceTimersByTimeAsync(ACTIVE_TURN_RECONCILE_DELAY_MS));
      expect(onRefresh).toHaveBeenCalledOnce();
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not restart a healthy subscription when callbacks change", () => {
    const { socket } = createSocket();
    mocks.acquireSocket.mockReturnValue(socket);
    const { rerender } = renderHook(() =>
      useCourseAuthoringSocket({
        courseId: "course-1",
        session: session(),
        onSnapshot: vi.fn(),
        onRefresh: vi.fn(),
      }),
    );
    rerender();
    expect(mocks.acquireSocket).toHaveBeenCalledOnce();
    expect(mocks.releaseSocket).not.toHaveBeenCalled();
  });

  it("retries manually within the same session and cancels the old snapshot read", async () => {
    const { listeners, socket } = createSocket();
    mocks.acquireSocket.mockReturnValue(socket);
    const onSnapshot = vi.fn();
    const onRefresh = vi.fn().mockImplementation(() => new Promise<AuthoringSession>(() => {}));
    const { rerender, unmount } = renderHook(
      ({ reconnectAttempt }) =>
        useCourseAuthoringSocket({
          courseId: "course-1",
          session: session(),
          onSnapshot,
          onRefresh,
          reconnectAttempt,
        }),
      { initialProps: { reconnectAttempt: 0 } },
    );
    act(() => listeners.get("authoring.resync")?.({ sessionId: "session-1" }));
    const signal = onRefresh.mock.calls[0]?.[0] as AbortSignal;
    rerender({ reconnectAttempt: 1 });
    expect(signal.aborted).toBe(true);
    expect(
      socket.emit.mock.calls.filter(([name]) => name === "join:course-authoring").at(-1)?.[1],
    ).toMatchObject({ sessionId: "session-1" });
    unmount();
    await act(async () => {
      await Promise.resolve();
    });
  });

  it.each([404, 403])(
    "stops automatic retries after a confirmed snapshot HTTP %s",
    async (status) => {
      vi.useFakeTimers();
      try {
        const { listeners, socket } = createSocket();
        mocks.acquireSocket.mockReturnValue(socket);
        const onRefresh = vi
          .fn()
          .mockRejectedValue({ isAxiosError: true, response: { status, data: {} } });
        const onSessionUnavailable = vi.fn();
        const { result, unmount } = renderHook(() =>
          useCourseAuthoringSocket({
            courseId: "course-1",
            session: session(),
            onSnapshot: vi.fn(),
            onRefresh,
            onSessionUnavailable,
          }),
        );
        act(() => listeners.get("authoring.resync")?.({ sessionId: "session-1" }));
        await act(() => vi.advanceTimersByTimeAsync(120_000));
        expect(onRefresh).toHaveBeenCalledOnce();
        expect(result.current).toBe(status === 404 ? "session_unavailable" : "permission_revoked");
        expect(onSessionUnavailable).toHaveBeenCalledTimes(status === 404 ? 1 : 0);
        unmount();
      } finally {
        vi.useRealTimers();
      }
    },
  );
  it("rejoins after a disconnect coalesced behind a superseded watchdog snapshot", async () => {
    vi.useFakeTimers();
    try {
      const { listeners, socket } = createSocket();
      mocks.acquireSocket.mockReturnValue(socket);
      const running = {
        ...session(),
        turns: [
          {
            requestId: "request-1",
            messageId: "message-1",
            status: "running",
            taskIds: [],
            parts: [],
            firstSequence: 1,
            updatedSequence: 1,
          },
        ],
      } as AuthoringSession;
      let resolveOld: (snapshot: AuthoringSession) => void = () => undefined;
      const completed = { ...session(), snapshotSequence: 2 };
      const onRefresh = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<AuthoringSession>((resolve) => {
              resolveOld = resolve;
            }),
        )
        .mockResolvedValue(completed);
      const { result, unmount } = renderHook(() =>
        useCourseAuthoringSocket({
          courseId: "course-1",
          session: running,
          onSnapshot: vi.fn(),
          onRefresh,
        }),
      );
      act(() => listeners.get("authoring.snapshot")?.(running));
      await act(() => vi.advanceTimersByTimeAsync(ACTIVE_TURN_RECONCILE_DELAY_MS));
      expect(onRefresh).toHaveBeenCalledOnce();
      act(() => listeners.get("authoring.event")?.(event(2)));
      socket.connected = false;
      act(() => listeners.get("disconnect")?.());
      socket.connected = true;
      act(() => listeners.get("connect")?.());
      await act(async () => {
        resolveOld(running);
        await Promise.resolve();
      });
      expect(onRefresh).toHaveBeenCalledTimes(2);
      expect(
        socket.emit.mock.calls.filter(([name]) => name === "join:course-authoring").at(-1)?.[1],
      ).toMatchObject({ afterSequence: 2 });
      act(() => listeners.get("authoring.snapshot")?.(completed));
      expect(result.current).toBe("live");
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});
