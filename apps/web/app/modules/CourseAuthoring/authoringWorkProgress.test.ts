import { describe, expect, it } from "vitest";

import { attachAuthoringWorkProgress } from "./authoringWorkProgress";

import type { AuthoringRecord, AuthoringTask } from "./courseAuthoring.types";

const task = (overrides: Partial<AuthoringTask> = {}): AuthoringTask => ({
  taskId: "task-1",
  requestId: "request-1",
  kind: "lesson",
  status: "running",
  errorCode: null,
  outputId: null,
  ...overrides,
});

const progress = (overrides: Record<string, unknown> = {}) => ({
  stage: "lesson_generation",
  chapters: [
    { chapterId: "chapter-1", title: "Getting started", lessonCount: 2, status: "running" },
  ],
  completedLessons: 1,
  totalLessons: 4,
  chapterId: "chapter-1",
  chapterTitle: "Getting started",
  lessonTitle: "Welcome to the course",
  ...overrides,
});

const record = (
  sequence: number,
  workProgress: Record<string, unknown>,
  overrides: Partial<AuthoringRecord> = {},
): AuthoringRecord => ({
  id: `progress-${sequence}`,
  kind: "assistant.progress",
  payload: {
    sequence,
    requestId: "request-1",
    taskId: "task-1",
    workProgress,
  },
  ...overrides,
});

describe("attachAuthoringWorkProgress", () => {
  it("uses the latest sequenced progress record for each matching task", () => {
    const tasks = [task(), task({ taskId: "task-2" })];
    const records = [
      record(12, progress({ stage: "validation" })),
      record(8, progress({ lessonTitle: "Older title" })),
      record(9, progress(), { payload: { ...record(9, progress()).payload, taskId: "task-2" } }),
    ];

    expect(attachAuthoringWorkProgress(tasks, records)).toEqual([
      { ...tasks[0], workProgress: progress({ stage: "validation" }) },
      { ...tasks[1], workProgress: progress() },
    ]);
  });

  it("accepts the retry stage and keeps the current lesson context", () => {
    const retryProgress = progress({ stage: "repairing" });

    expect(attachAuthoringWorkProgress([task()], [record(13, retryProgress)])).toEqual([
      { ...task(), workProgress: retryProgress },
    ]);
  });

  it("keeps lesson writer progress when it carries context without course totals", () => {
    const writerProgress = {
      stage: "lesson_generation",
      lessonId: "lesson-1",
      chapterId: "chapter-1",
      chapterTitle: "Getting started",
      lessonTitle: "Welcome to the course",
    };

    expect(attachAuthoringWorkProgress([task()], [record(14, writerProgress)])).toEqual([
      { ...task(), workProgress: writerProgress },
    ]);
  });

  it.each(["task.queued", "task.running"])("accepts progress carried by %s records", (kind) => {
    const lesson = task({ status: kind === "task.queued" ? "queued" : "running" });
    const workProgress = {
      stage: "lesson_generation",
      chapterId: "chapter-1",
      chapterTitle: "Getting started",
      lessonTitle: "Welcome to the course",
    };

    expect(attachAuthoringWorkProgress([lesson], [record(15, workProgress, { kind })])).toEqual([
      { ...lesson, workProgress },
    ]);
  });

  it("ignores records from another request or records with malformed metadata", () => {
    const wrongRequest = record(20, progress(), {
      payload: { ...record(20, progress()).payload, requestId: "request-other" },
    });
    const malformed = record(21, progress({ completedLessons: 5 }));
    const missingSequence = record(22, progress(), {
      payload: { ...record(22, progress()).payload, sequence: undefined },
    });

    expect(
      attachAuthoringWorkProgress([task()], [wrongRequest, malformed, missingSequence]),
    ).toEqual([task()]);
  });

  it("ignores malformed chapter entries while retaining valid progress totals", () => {
    const currentProgress = progress({ chapters: [null, ...progress().chapters] });

    expect(
      attachAuthoringWorkProgress([task()], [record(23, currentProgress)])[0].workProgress,
    ).toEqual({
      ...currentProgress,
      chapters: progress().chapters,
    });
  });
});
