import {
  ASSISTANT_MESSAGE_ROLES,
  ASSISTANT_MESSAGE_STATUSES,
  ASSISTANT_RUN_STATUSES,
  ASSISTANT_SOCKET_EVENTS,
  type AssistantTranscriptUpdate,
} from "@repo/shared";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryClient } from "~/api/queryClient";

import { useAssistantMessagesRealtime } from "./useAssistantMessagesRealtime";

import type { AssistantTranscriptCache } from "./assistantTranscriptCache";

const auth = vi.hoisted(() => ({ assertCurrent: vi.fn() }));
const connection = vi.hoisted(() => {
  const listeners = new Map<string, (payload?: unknown) => void>();
  const timeout = vi.fn();
  const socket = {
    connected: true,
    timeout,
    on: vi.fn((event: string, listener: (payload?: unknown) => void) => {
      listeners.set(event, listener);
    }),
    off: vi.fn((event: string) => {
      listeners.delete(event);
    }),
    connect: vi.fn(),
    emit: vi.fn<
      (
        event: string,
        payload: unknown,
        reply: (error: unknown, result: { success: boolean }) => void,
      ) => void
    >(),
  };
  timeout.mockReturnValue(socket);
  return { listeners, socket, releaseSocket: vi.fn() };
});

vi.mock("~/api/assistantIdentity", () => ({
  captureAssistantSession: () => ({ assertCurrent: auth.assertCurrent }),
  useAssistantSessionGeneration: () => 1,
}));
vi.mock("~/api/socket", () => ({
  acquireSocket: () => connection.socket,
  releaseSocket: connection.releaseSocket,
}));

const threadId = "thread";
const queryKey = ["assistant", "messages", threadId];
const scope = ["assistant", "https://example.test", "tenant", "user"] as const;
const startedAt = "2026-11-20T10:00:00.000Z";
const checkpointAt = "2026-11-20T10:00:00.001Z";
const runId = "run";
const update: AssistantTranscriptUpdate = {
  threadId,
  run: {
    id: runId,
    threadId,
    status: ASSISTANT_RUN_STATUSES.RUNNING,
    activity: null,
    errorCode: null,
    workflowRunId: null,
    createdAt: startedAt,
    updatedAt: checkpointAt,
  },
  assistantMessage: {
    id: "message",
    threadId,
    role: ASSISTANT_MESSAGE_ROLES.ASSISTANT,
    status: ASSISTANT_MESSAGE_STATUSES.RUNNING,
    clientMessageId: null,
    text: "Persisted partial",
    sources: [],
    createdAt: startedAt,
    updatedAt: checkpointAt,
  },
};

describe("Assistant transcript socket lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    connection.socket.connected = true;
    connection.socket.timeout.mockReturnValue(connection.socket);
    connection.listeners.clear();
    connection.socket.emit.mockReset();
    connection.socket.emit.mockImplementation((event, _payload, reply) => {
      if (event === ASSISTANT_SOCKET_EVENTS.JOIN) reply(null, { success: true });
    });
    auth.assertCurrent.mockReset();
    queryClient.setQueryData<AssistantTranscriptCache>(queryKey, {
      pages: [
        {
          items: [{ ...update.assistantMessage, text: "", updatedAt: startedAt }],
          latestRun: { ...update.run, updatedAt: startedAt },
          page: 1,
          perPage: 50,
          totalItems: 1,
        },
      ],
      pageParams: [1],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    queryClient.clear();
  });

  it("applies saved updates in place, ignores expired sessions, and reconciles on reconnect", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const mounted = renderHook(() => useAssistantMessagesRealtime({ threadId, scope, queryKey }));
    expect(invalidate).toHaveBeenCalledTimes(1);

    act(() => connection.listeners.get(ASSISTANT_SOCKET_EVENTS.TRANSCRIPT_UPDATED)?.(update));
    expect(
      queryClient.getQueryData<AssistantTranscriptCache>(queryKey)?.pages[0].items[0].text,
    ).toBe("Persisted partial");

    await act(async () => vi.advanceTimersByTimeAsync(120_000));
    expect(invalidate).toHaveBeenCalledTimes(1);

    act(() => connection.listeners.get("disconnect")?.());
    act(() => connection.listeners.get("connect")?.());
    expect(invalidate).toHaveBeenCalledTimes(2);

    auth.assertCurrent.mockImplementation(() => {
      throw new Error("session changed");
    });
    const later = {
      ...update,
      run: { ...update.run, updatedAt: "2026-11-20T10:00:00.002Z" },
      assistantMessage: {
        ...update.assistantMessage,
        text: "Stale identity",
        updatedAt: "2026-11-20T10:00:00.002Z",
      },
    };
    act(() => connection.listeners.get(ASSISTANT_SOCKET_EVENTS.TRANSCRIPT_UPDATED)?.(later));
    expect(
      queryClient.getQueryData<AssistantTranscriptCache>(queryKey)?.pages[0].items[0].text,
    ).toBe("Persisted partial");

    mounted.unmount();
    expect(connection.listeners.size).toBe(0);
    expect(connection.releaseSocket).toHaveBeenCalled();
  });

  it("waits for a new socket join without polling during a disconnect", async () => {
    connection.socket.connected = false;
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const mounted = renderHook(() => useAssistantMessagesRealtime({ threadId, scope, queryKey }));

    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(invalidate).not.toHaveBeenCalled();
    connection.socket.connected = true;
    act(() => connection.listeners.get("connect")?.());
    expect(invalidate).toHaveBeenCalledTimes(1);
    mounted.unmount();
  });
});
