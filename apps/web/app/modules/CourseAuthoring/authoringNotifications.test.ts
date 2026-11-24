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

const reviewSession = (kind: "outline" | "changes"): AuthoringSession => ({
  ...session("completed", 2),
  tasks: [
    {
      taskId: "task-1",
      requestId: "request-1",
      kind: "plan",
      status: "waiting_author",
      errorCode: null,
      outputId: "proposal-1",
    },
  ],
  records: [
    {
      id: "proposal-1",
      kind: "proposal",
      payload: {
        id: "proposal-1",
        revision: 1,
        taskId: "task-1",
        outline:
          kind === "outline" ? [{ id: "chapter-1", title: "Introduction", lessons: [] }] : null,
        operations:
          kind === "changes"
            ? [
                {
                  operationId: "op-1",
                  type: "course.update",
                  targetId: "course-1",
                  dependencies: [],
                  payload: { title: "Updated course" },
                },
              ]
            : [],
      },
    },
  ],
});

describe("global authoring work observer", () => {
  let client: QueryClient;
  let dispose: () => void;
  const notify = vi.fn();
  const stopWatching = vi.fn();
  const watch = vi.fn(
    (_session: AuthoringSession, _publish: (next: AuthoringSession) => void) => stopWatching,
  );
  const start = (longRunningMs = 0) => {
    dispose = observeAuthoringWork({
      client,
      notify,
      watch,
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

  it("reports an unanswered question even when the turn is completed", () => {
    start();
    client.setQueryData(key(), session("running"));
    const waiting = {
      ...session("completed", 2),
      records: [
        {
          id: "question-1",
          kind: "question",
          payload: {
            taskId: "task-1",
            requestId: "request-1",
            revision: 1,
            question: "Who is the course for?",
          },
        },
      ],
    };
    client.setQueryData(key(), waiting);
    client.setQueryData(key(), { ...waiting, snapshotSequence: 3 });
    expect(notify.mock.calls.map(([outcome]) => outcome)).toEqual(["waiting_author"]);
  });

  it.each(["answered", "other request"])("ignores a question that belongs to %s", (kind) => {
    start();
    client.setQueryData(key(), session("running"));
    client.setQueryData(key(), {
      ...session("completed", 2),
      records: [
        {
          id: "question-1",
          kind: "question",
          payload: {
            taskId: "task-1",
            requestId: kind === "other request" ? "another-request" : "request-1",
            revision: 1,
            question: "Who is the course for?",
            answered: kind === "answered",
          },
        },
      ],
    });
    expect(notify).toHaveBeenCalledWith("completed", expect.anything());
  });

  it.each(["outline", "changes"] as const)(
    "announces %s review instead of generic input or completion",
    (kind) => {
      start();
      client.setQueryData(key(), session("running"));
      const ready = reviewSession(kind);
      client.setQueryData(key(), ready);
      client.setQueryData(key(), { ...ready, snapshotSequence: 3 });
      expect(notify.mock.calls.map(([outcome]) => outcome)).toEqual([`${kind}_ready`]);
    },
  );

  it("waits for sibling work before announcing reviewable changes", () => {
    start();
    client.setQueryData(key(), session("running"));
    const ready = reviewSession("changes");
    client.setQueryData(key(), {
      ...ready,
      tasks: [
        ...ready.tasks,
        {
          taskId: "task-2",
          requestId: "request-1",
          status: "running",
          errorCode: null,
          outputId: null,
        },
      ],
    });
    expect(notify).not.toHaveBeenCalled();
    client.setQueryData(key(), { ...ready, snapshotSequence: 3 });
    expect(notify).toHaveBeenCalledWith("changes_ready", expect.anything());
  });

  it("does not announce already applied changes as awaiting review", () => {
    start();
    client.setQueryData(key(), session("running"));
    const applied = reviewSession("changes");
    applied.tasks[0].status = "succeeded";
    applied.records[0].payload.status = "applied";
    client.setQueryData(key(), applied);
    expect(notify).toHaveBeenCalledWith("completed", expect.anything());
  });

  it("prioritizes an unresolved author action over another task's saved changes", () => {
    start();
    client.setQueryData(key(), session("running"));
    const waiting = reviewSession("changes");
    waiting.tasks.push({
      taskId: "asset-1",
      kind: "asset",
      requestId: "request-1",
      status: "waiting_author",
      errorCode: null,
      outputId: null,
    });
    client.setQueryData(key(), waiting);
    expect(notify).toHaveBeenCalledWith("waiting_author", expect.anything());
  });

  it("updates an observed completion when its review record arrives later", () => {
    start();
    client.setQueryData(key(), session("running"));
    client.setQueryData(key(), session("completed", 2));
    client.setQueryData(key(), { ...reviewSession("outline"), snapshotSequence: 3 });
    expect(notify.mock.calls.map(([outcome]) => outcome)).toEqual(["completed", "outline_ready"]);
  });

  it("keeps historical completed and review-ready requests quiet", () => {
    client.setQueryData(key(), session("completed"));
    client.setQueryData(key("older"), { ...reviewSession("outline"), sessionId: "older" });
    start();
    client.setQueryData(key(), reviewSession("changes"));
    expect(notify).not.toHaveBeenCalled();
  });

  it("replaces a review notice when a question arrives for the same observed request", () => {
    start();
    client.setQueryData(key(), session("running"));
    const ready = reviewSession("outline");
    client.setQueryData(key(), ready);
    client.setQueryData(key(), {
      ...ready,
      snapshotSequence: 3,
      records: [
        ...ready.records,
        {
          id: "question-1",
          kind: "question",
          payload: {
            taskId: "task-1",
            revision: 1,
            question: "May I research more sources?",
          },
        },
      ],
    });
    expect(notify.mock.calls.map(([outcome]) => outcome)).toEqual([
      "outline_ready",
      "waiting_author",
    ]);
  });

  it("keeps streaming after another session opens and after query garbage collection", () => {
    client.setQueryData(key(), session("running"));
    start();
    client.setQueryData(key("other"), session("completed", 1, "other"));
    client.removeQueries({ queryKey: key(), exact: true });
    expect(watch).toHaveBeenCalledOnce();
    const [initial, publish] = watch.mock.calls[0];
    expect(initial.sessionId).toBe("session-1");
    publish(session("completed", 2));
    expect(notify).toHaveBeenCalledWith(
      "completed",
      expect.objectContaining({ sessionId: "session-1" }),
    );
    expect(stopWatching).toHaveBeenCalledOnce();
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
  it.each(["source", "source_vision"])(
    "does not announce attachment job %s as a completed AI request",
    async (kind) => {
      start();
      const snapshot = {
        ...session("running"),
        turns: [],
        tasks: [
          {
            taskId: "source",
            requestId: "source-upload",
            kind,
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
      expect(watch).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
    },
  );
  it("ignores stale snapshots and suppresses a late event after logout", () => {
    start();
    client.setQueryData(key(), session("running", 5));
    const [, publish] = watch.mock.calls[0];
    publish(session("completed", 4));
    expect(notify).not.toHaveBeenCalled();
    dispose();
    publish(session("completed", 6));
    expect(client.getQueryData<AuthoringSession>(key())?.snapshotSequence).toBe(5);
    expect(notify).not.toHaveBeenCalled();
  });
});
