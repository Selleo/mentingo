import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { observeAuthoringWork } from "./authoringNotifications";

import type { AuthoringSession, AuthoringTurnStatus } from "./courseAuthoring.types";

const session = (
  status: AuthoringTurnStatus,
  sequence = 1,
  sessionId = "session-1",
): AuthoringSession => ({
  schemaVersion: 1,
  sessionId,
  courseId: "course-1",
  language: "en",
  status: "active",
  snapshotSequence: sequence,
  workspaceRevision: 1,
  records: [],
  tasks: [],
  turns: [
    {
      requestId: "request-1",
      messageId: "message-1",
      status,
      taskIds: [],
      parts: [],
      firstSequence: 1,
      updatedSequence: sequence,
    },
  ],
});
const key = (sessionId = "session-1") => ["course-authoring", "course-1", "session", sessionId];

describe("global authoring work observer", () => {
  let client: QueryClient;
  let dispose: () => void;
  const notify = vi.fn();
  const refresh = vi.fn();
  const start = (longRunningMs = 0) => {
    dispose = observeAuthoringWork({
      client,
      notify,
      refresh,
      isUnavailable: (error) => error === "denied",
      intervalMs: 100,
      longRunningMs,
    });
  };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    client = new QueryClient();
  });
  afterEach(() => {
    dispose?.();
    client.clear();
    vi.useRealTimers();
  });

  it("keeps historical completion silent and notifies each observed outcome once", () => {
    client.setQueryData(key("history"), session("completed", 1, "history"));
    start();
    client.setQueryData(key(), session("running"));
    client.setQueryData(key(), session("waiting_author", 2));
    client.setQueryData(key(), session("waiting_author", 2));
    client.setQueryData(key(), session("running", 3));
    client.setQueryData(key(), session("waiting_author", 4));
    client.setQueryData(key(), session("completed", 5));
    client.setQueryData(key(), session("completed", 6));
    expect(notify.mock.calls.map(([outcome]) => outcome)).toEqual([
      "waiting_author",
      "waiting_author",
      "completed",
    ]);
  });

  it("polls work after another session opens and after query garbage collection", async () => {
    client.setQueryData(key(), session("running"));
    start();
    client.setQueryData(key("other"), session("completed", 1, "other"));
    client.removeQueries({ queryKey: key(), exact: true });
    refresh.mockResolvedValue(session("completed", 2));
    await vi.advanceTimersByTimeAsync(100);
    expect(refresh).toHaveBeenCalledWith("course-1", "session-1");
    expect(notify).toHaveBeenCalledWith(
      "completed",
      expect.objectContaining({ sessionId: "session-1" }),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not report failure while sibling tasks are still running", () => {
    start();
    const snapshot = session("running");
    snapshot.tasks = [
      {
        taskId: "failed",
        requestId: "request-1",
        status: "failed",
        errorCode: null,
        outputId: null,
      },
      {
        taskId: "active",
        requestId: "request-1",
        status: "running",
        errorCode: null,
        outputId: null,
      },
    ];
    client.setQueryData(key(), snapshot);
    client.setQueryData(key(), {
      ...snapshot,
      snapshotSequence: 2,
      turns: session("completed").turns,
    });
    expect(notify).not.toHaveBeenCalled();
    client.setQueryData(key(), {
      ...snapshot,
      snapshotSequence: 3,
      turns: session("completed").turns,
      tasks: snapshot.tasks.map((task) => ({
        ...task,
        status: task.taskId === "active" ? "succeeded" : "failed",
      })),
    });
    expect(notify).toHaveBeenCalledWith("failed", expect.anything());
  });

  it("keeps short replies quiet and announces long-running completion", async () => {
    start(10_000);
    client.setQueryData(key(), session("running", 1));
    client.setQueryData(key(), session("completed", 2));
    expect(notify).not.toHaveBeenCalled();
    client.setQueryData(key(), session("running", 3));
    refresh.mockResolvedValue(session("running", 3));
    await vi.advanceTimersByTimeAsync(10_000);
    client.setQueryData(key(), session("completed", 4));
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("completed", expect.anything());
  });
  it("notifies again when a retried request fails again", () => {
    start();
    client.setQueryData(key(), session("running", 1));
    client.setQueryData(key(), session("failed", 2));
    client.setQueryData(key(), session("running", 3));
    client.setQueryData(key(), session("failed", 4));
    client.setQueryData(key(), session("failed", 4));
    expect(notify.mock.calls.map(([outcome]) => outcome)).toEqual(["failed", "failed"]);
  });
  it("does not announce source ingestion as a completed AI request", async () => {
    start();
    const snapshot = {
      ...session("running"),
      turns: [],
      tasks: [
        {
          taskId: "source",
          requestId: "source-upload",
          kind: "source",
          status: "running" as const,
          errorCode: null,
          outputId: null,
        },
      ],
    };
    client.setQueryData(key(), snapshot);
    client.setQueryData(key(), {
      ...snapshot,
      snapshotSequence: 2,
      tasks: [{ ...snapshot.tasks[0], status: "succeeded" }],
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(refresh).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
  it("stops polling denied sessions without reporting a task failure", async () => {
    start();
    client.setQueryData(key(), session("running"));
    refresh.mockRejectedValue("denied");
    await vi.advanceTimersByTimeAsync(500);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });

  it("ignores stale snapshots and suppresses in-flight outcomes after logout", async () => {
    start();
    client.setQueryData(key(), session("running", 5));
    client.setQueryData(key(), session("completed", 4));
    expect(notify).not.toHaveBeenCalled();
    let finish: (snapshot: AuthoringSession) => void = () => {};
    refresh.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await vi.advanceTimersByTimeAsync(100);
    dispose();
    finish(session("completed", 6));
    await Promise.resolve();
    expect(notify).not.toHaveBeenCalled();
  });
});
