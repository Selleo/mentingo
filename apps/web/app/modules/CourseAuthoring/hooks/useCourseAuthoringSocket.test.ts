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
    const onSnapshot = vi.fn();
    const { result } = renderHook(() =>
      useCourseAuthoringSocket({
        courseId: "course-1",
        session: session(),
        onSnapshot,
        onRefresh,
      }),
    );

    act(() =>
      listeners.get("authoring.error")?.({ sessionId: "session-1", code: "permission_revoked" }),
    );
    act(() => listeners.get("authoring.resync")?.({ sessionId: "session-1" }));

    await waitFor(() => expect(result.current).toBe("offline"));
    expect(onRefresh).not.toHaveBeenCalled();
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
      expect(joinCalls.at(-1)?.[1]).toMatchObject({ afterSequence: 184 });
    } finally {
      vi.useRealTimers();
    }
  });
});
