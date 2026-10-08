import { describe, expect, it } from "vitest";

import { attachAuthoringWorkProgress } from "./authoringWorkProgress";
import { applyAuthoringEvent, decideEventCursor } from "./courseAuthoring.events";
import { projectWorkspaceRecords } from "./courseAuthoring.records";

import type { AuthoringEvent, AuthoringSession } from "./courseAuthoring.types";

const failure = {
  code: "planning_batch_invalid",
  category: "generation",
  stage: "generate",
  recoveryAction: "retry_failed_parts",
  retryable: true,
  affectedChapterIds: ["chapter-1"],
  affectedLessonIds: [],
  correlationId: null,
  detailKey: null,
  generationRevision: 0,
};

const session: AuthoringSession = {
  schemaVersion: 1,
  sessionId: "session-1",
  courseId: "course-1",
  language: "en",
  status: "active",
  snapshotSequence: 7,
  workspaceRevision: 7,
  records: [],
  tasks: [],
};

const event = (sequence: number, sessionId = "session-1"): AuthoringEvent => ({
  schemaVersion: 1,
  eventId: `event-${sequence}`,
  sessionId,
  sequence,
  occurredAt: "2026-09-16T12:00:00Z",
  type: "proposal.created",
  payload: {},
});

describe("course authoring event cursor", () => {
  it("retains raw work progress for the live chapter view without a snapshot refresh", () => {
    const current: AuthoringSession = {
      ...session,
      tasks: [
        {
          taskId: "task-1",
          requestId: "request-1",
          kind: "lesson",
          status: "queued",
          errorCode: null,
          outputId: null,
        },
      ],
    };
    const next = applyAuthoringEvent(current, {
      ...event(8),
      type: "assistant.progress",
      payload: {
        taskId: "task-1",
        requestId: "request-1",
        phase: "writing",
        workProgress: {
          stage: "lesson_generation",
          chapterId: "chapter-1",
          chapterTitle: "Getting started",
          lessonTitle: "Welcome",
        },
      },
    });
    const [task] = attachAuthoringWorkProgress(next.tasks, next.records);
    expect(task.workProgress?.chapterTitle).toBe("Getting started");
    expect(task.workProgress?.lessonTitle).toBe("Welcome");
    expect(next.records[0].payload.sequence).toBe(8);
  });

  it("updates an uploaded source from queued to ready on its processing event", () => {
    const queued = {
      id: "source-record",
      kind: "source",
      payload: { sourceVersionId: "source-1", filename: "guide.pdf", status: "queued" },
    };
    const current = { ...session, records: [queued] };
    const next = applyAuthoringEvent(current, {
      ...event(8),
      type: "source.processed",
      payload: {
        sourceVersionId: "source-1",
        status: "ready",
        record: { ...queued, payload: { ...queued.payload, status: "ready" } },
      },
    });

    expect(next.records).toEqual([{ ...queued, payload: { ...queued.payload, status: "ready" } }]);
  });
  it("applies the exact next event", () => {
    expect(decideEventCursor(session, event(8))).toEqual({ type: "apply", cursor: 8 });
  });

  it("deduplicates replayed events and ignores another session", () => {
    expect(decideEventCursor(session, event(7))).toEqual({ type: "ignore", cursor: 7 });
    expect(decideEventCursor(session, event(8, "other"))).toEqual({ type: "ignore", cursor: 7 });
  });

  it("requires a snapshot recovery when an event skips the durable cursor", () => {
    expect(decideEventCursor(session, event(10))).toEqual({ type: "gap", cursor: 7 });
  });

  it("projects canonical turn lifecycle and parts without a snapshot", () => {
    const first = applyAuthoringEvent(session, {
      ...event(8),
      type: "assistant.update",
      payload: {
        turn: {
          requestId: "request-1",
          messageId: "message-1",
          status: "running",
          taskIds: ["task-1"],
          firstSequence: 8,
          updatedSequence: 8,
          part: {
            requestId: "request-1",
            messageId: "message-1",
            partId: "part-1",
            partKind: "text",
            taskId: "task-1",
            status: "streaming",
            firstSequence: 8,
            updatedSequence: 8,
            text: "Preparing ",
            planSteps: ["Research Mentingo", "Write lessons"],
            tool: null,
            artifact: null,
          },
        },
      },
    });
    const second = applyAuthoringEvent(first, {
      ...event(9),
      type: "assistant.update",
      payload: {
        turn: {
          requestId: "request-1",
          messageId: "message-1",
          status: "completed",
          taskIds: ["task-1"],
          firstSequence: 8,
          updatedSequence: 9,
          part: {
            requestId: "request-1",
            messageId: "message-1",
            partId: "part-1",
            partKind: "text",
            taskId: "task-1",
            status: "completed",
            firstSequence: 8,
            updatedSequence: 9,
            text: "the lesson.",
            tool: null,
            artifact: null,
          },
        },
      },
    });

    expect(second.records).toEqual([]);
    expect(second.turns?.[0]?.parts[0]?.planSteps).toEqual(["Research Mentingo", "Write lessons"]);
    expect(second.turns).toEqual([
      {
        requestId: "request-1",
        messageId: "message-1",
        status: "completed",
        taskIds: ["task-1"],
        firstSequence: 8,
        updatedSequence: 9,
        parts: [
          {
            requestId: "request-1",
            messageId: "message-1",
            partId: "part-1",
            partKind: "text",
            taskId: "task-1",
            status: "completed",
            firstSequence: 8,
            updatedSequence: 9,
            text: "the lesson.",
            phase: null,
            planSteps: ["Research Mentingo", "Write lessons"],
            tool: null,
            artifact: null,
          },
        ],
      },
    ]);
  });

  it("preserves exact web search queries in canonical tool results", () => {
    const next = applyAuthoringEvent(session, {
      ...event(8),
      type: "assistant.update",
      payload: {
        turn: {
          requestId: "request-1",
          messageId: "message-1",
          status: "completed",
          taskIds: ["task-1"],
          firstSequence: 8,
          updatedSequence: 8,
          part: {
            requestId: "request-1",
            messageId: "message-1",
            partId: "search-1",
            partKind: "tool",
            taskId: "task-1",
            status: "completed",
            firstSequence: 8,
            updatedSequence: 8,
            tool: {
              toolCallId: "query-1",
              toolName: "web_search",
              display: "Searched the web",
              status: "completed",
              result: {
                query: "Exact query with punctuation?",
                queries: ["Older exact query", "Another query"],
                sourceCount: 2,
              },
            },
            artifact: null,
          },
        },
      },
    });

    expect(next.turns?.[0]?.parts[0]?.tool?.result).toEqual({
      query: "Exact query with punctuation?",
      queries: ["Older exact query", "Another query"],
      sourceCount: 2,
      findingCount: null,
    });
  });

  it("updates the owning task phase without creating a chat event", () => {
    const next = applyAuthoringEvent(
      {
        ...session,
        tasks: [
          {
            taskId: "task-1",
            requestId: "request-1",
            status: "running",
            errorCode: null,
            outputId: null,
          },
        ],
      },
      {
        ...event(8),
        type: "task.running",
        payload: { taskId: "task-1", requestId: "request-1", phase: "generating_lesson" },
      },
    );

    expect(next.tasks[0]?.phase).toBe("generating_lesson");
    expect(next.records).toHaveLength(0);
  });

  it("upserts a task from a durable task.updated event", () => {
    const queued = applyAuthoringEvent(session, {
      ...event(8),
      type: "task.updated",
      payload: {
        taskId: "task-2",
        requestId: "request-2",
        kind: "edit",
        status: "waiting_dependencies",
        phase: "updating_course",
      },
    });
    const running = applyAuthoringEvent(queued, {
      ...event(9),
      type: "task.updated",
      payload: {
        task: {
          taskId: "task-2",
          requestId: "request-2",
          kind: "edit",
          status: "running",
          phase: "updating_course",
        },
      },
    });

    expect(queued.tasks).toEqual([
      {
        taskId: "task-2",
        requestId: "request-2",
        kind: "edit",
        status: "waiting_dependencies",
        phase: "updating_course",
        errorCode: null,
        failure: null,
        outputId: null,
      },
    ]);
    expect(running.tasks).toHaveLength(1);
    expect(running.tasks[0]).toMatchObject({
      taskId: "task-2",
      status: "running",
      phase: "updating_course",
    });
  });

  it("replaces a failed task diagnostic when its retry succeeds", () => {
    const failed = applyAuthoringEvent(
      {
        ...session,
        tasks: [
          {
            taskId: "task-1",
            requestId: "request-1",
            status: "running",
            errorCode: null,
            outputId: null,
          },
        ],
      },
      {
        ...event(8),
        type: "task.failed",
        payload: {
          taskId: "task-1",
          requestId: "request-1",
          errorCode: "task_execution_failed",
          failure,
        },
      },
    );
    const queued = applyAuthoringEvent(failed, {
      ...event(9),
      type: "task.queued",
      payload: { taskId: "task-1", requestId: "request-1" },
    });
    const succeeded = applyAuthoringEvent(queued, {
      ...event(10),
      type: "task.succeeded",
      payload: { taskId: "task-1", requestId: "request-1", outputId: "proposal-1" },
    });

    expect(failed.tasks[0]).toMatchObject({
      status: "failed",
      errorCode: "task_execution_failed",
    });
    expect(failed.tasks[0].failure).toEqual(failure);
    expect(queued.tasks[0]).toMatchObject({ status: "queued", errorCode: null, failure: null });
    expect(succeeded.tasks[0]).toMatchObject({
      status: "succeeded",
      errorCode: null,
      outputId: "proposal-1",
    });
  });

  it("projects a streamed proposal review record without a snapshot refresh", () => {
    const next = applyAuthoringEvent(session, {
      ...event(8),
      payload: {
        record: {
          id: "proposal-record-1",
          kind: "proposal",
          payload: {
            id: "proposal-1",
            revision: 1,
            taskId: "task-1",
            title: "Add a scenario-based practice lesson",
            operations: [],
          },
        },
        turn: {
          requestId: "request-1",
          messageId: "message-1",
          status: "running",
          taskIds: ["task-1"],
          firstSequence: 8,
          updatedSequence: 8,
          part: {
            requestId: "request-1",
            messageId: "message-1",
            partId: "proposal:proposal-1",
            partKind: "proposal",
            taskId: "task-1",
            status: "review",
            firstSequence: 8,
            updatedSequence: 8,
            artifact: { artifactKind: "proposal", artifactId: "proposal-1" },
          },
        },
      },
    });

    expect(next.snapshotSequence).toBe(8);
    expect(next.records).toHaveLength(1);
    expect(projectWorkspaceRecords(next.records).proposals).toMatchObject([
      {
        id: "proposal-1",
        revision: 1,
        summary: "Add a scenario-based practice lesson",
        decision: "pending",
      },
    ]);
  });

  it("updates a proposal decision as soon as its durable status event arrives", () => {
    const proposal = {
      id: "proposal-record-1",
      kind: "proposal",
      payload: {
        id: "proposal-1",
        revision: 1,
        taskId: "task-1",
        title: "Rename the course",
        operations: [],
      },
    };
    const accepted = applyAuthoringEvent(
      { ...session, records: [proposal] },
      {
        ...event(8),
        type: "proposal.status",
        payload: { proposalId: "proposal-1", revision: 1, status: "accepted" },
      },
    );
    const applied = applyAuthoringEvent(accepted, {
      ...event(9),
      type: "proposal.status",
      payload: { proposalId: "proposal-1", status: "applied" },
    });

    expect(projectWorkspaceRecords(accepted.records).proposals[0]?.decision).toBe("accepted");
    expect(projectWorkspaceRecords(applied.records).proposals[0]?.decision).toBe("applied");
  });

  it("projects a live clarification answer into the turn and question snapshot", () => {
    const question = {
      id: "question-record-1",
      kind: "question",
      payload: {
        taskId: "task-1",
        requestId: "request-1",
        revision: 2,
        question: "Who is the course for?",
      },
    };
    const next = applyAuthoringEvent(
      { ...session, records: [question] },
      {
        ...event(8),
        type: "question.answered",
        payload: {
          taskId: "task-1",
          requestId: "request-1",
          revision: 2,
          answer: "First-time people managers.",
          recordId: "question-answer-record-1",
          turn: {
            requestId: "request-1",
            messageId: "message-1",
            status: "running",
            taskIds: ["task-1"],
            firstSequence: 4,
            updatedSequence: 8,
            part: {
              requestId: "request-1",
              messageId: "message-1",
              partId: "question:task-1:2",
              partKind: "question",
              taskId: "task-1",
              status: "completed",
              firstSequence: 6,
              updatedSequence: 8,
              answer: "First-time people managers.",
              artifact: { artifactKind: "question", artifactId: "task-1:2" },
            },
          },
        },
      },
    );

    expect(next.turns?.[0]?.parts[0]).toMatchObject({
      partId: "question:task-1:2",
      status: "completed",
      answer: "First-time people managers.",
    });
    expect(next.records).toContainEqual({
      id: "question-answer-record-1",
      kind: "question_answer",
      payload: {
        taskId: "task-1",
        requestId: "request-1",
        revision: 2,
        answer: "First-time people managers.",
      },
    });
    expect(projectWorkspaceRecords(next.records).questions[0]).toMatchObject({
      id: "question-record-1",
      answer: "First-time people managers.",
      answered: true,
    });
  });
});
