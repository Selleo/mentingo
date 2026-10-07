import { describe, expect, it } from "vitest";

import { authoringPhaseLabel, authoringTaskDisplayLabels } from "./authoringTaskLabels";

import type { AuthoringTask } from "./courseAuthoring.types";

const task = (overrides: Partial<AuthoringTask>): AuthoringTask => ({
  taskId: "task-1",
  requestId: "request-1",
  kind: null,
  phase: null,
  status: "running",
  errorCode: null,
  outputId: null,
  ...overrides,
});

const t = (key: string, options?: Record<string, unknown>) => {
  const label = key
    .replace("courseAuthoring.conversation.", "")
    .replace("courseAuthoring.activityRail.taskKind.", "");
  if (label !== "distinctTaskLabel") return label;
  return `${String(options?.label)} (${String(options?.number)})`;
};

describe("authoringPhaseLabel", () => {
  it.each([
    ["route", "understandingRequest"],
    ["plan", "planningOutline"],
    ["detailed_plan", "planningLessons"],
    ["lesson", "writingLesson"],
    ["edit", "updatingCourse"],
    ["source", "readingSources"],
    ["asset", "creatingVisual"],
    ["course_review", "checkingCourse"],
  ])("names a running %s task by what it does", (kind, label) => {
    expect(authoringPhaseLabel(task({ kind }), t)).toBe(label);
  });

  it("does not call planning work lesson generation when the phase says so", () => {
    expect(authoringPhaseLabel(task({ kind: "plan", phase: "generating_lesson" }), t)).toBe(
      "planningOutline",
    );
  });

  it("shows a writer's current research phase and then returns to writing", () => {
    expect(authoringPhaseLabel(task({ kind: "lesson", phase: "researching" }), t)).toBe(
      "readingSources",
    );
    expect(authoringPhaseLabel(task({ kind: "lesson", phase: "writing" }), t)).toBe(
      "writingLesson",
    );
    expect(authoringPhaseLabel(task({ kind: "course_review", phase: "reviewing" }), t)).toBe(
      "checkingCourse",
    );
  });

  it("uses structured progress to distinguish the outline, lesson plan, writing, and repairs", () => {
    const workProgress = (
      stage: "outline" | "lesson_planning" | "lesson_generation" | "validation" | "repairing",
    ) => ({
      stage,
      chapterId: "chapter-1",
      chapterTitle: "Getting started",
      lessonTitle: "Welcome to the course",
    });

    expect(
      authoringPhaseLabel(task({ kind: "plan", workProgress: workProgress("outline") }), t),
    ).toBe("planningOutline");
    expect(
      authoringPhaseLabel(
        task({ kind: "detailed_plan", workProgress: workProgress("lesson_planning") }),
        t,
      ),
    ).toBe("planningLessons");
    expect(
      authoringPhaseLabel(
        task({ kind: "lesson", workProgress: workProgress("lesson_generation") }),
        t,
      ),
    ).toBe("writingLesson");
    expect(
      authoringPhaseLabel(
        task({ kind: "detailed_plan", phase: "writing", workProgress: workProgress("repairing") }),
        t,
      ),
    ).toBe("revisingLessonPlan");
  });

  it("falls back to the phase and then to a generic label", () => {
    expect(authoringPhaseLabel(task({ phase: "updating_course" }), t)).toBe("updatingCourse");
    expect(authoringPhaseLabel(task({}), t)).toBe("working");
  });

  it.each([
    ["route_working", "understandingRequest"],
    ["planning", "planningCourse"],
    ["writing", "writingLesson"],
    ["editing", "updatingCourse"],
    ["asset_working", "creatingVisual"],
    ["source_working", "readingSources"],
    ["researching", "readingSources"],
  ])("localizes the stable %s phase", (phase, label) => {
    expect(authoringPhaseLabel(task({ phase }), t)).toBe(label);
  });

  it("reports queued and waiting work instead of the task kind", () => {
    expect(authoringPhaseLabel(task({ kind: "lesson", status: "queued" }), t)).toBe(
      "preparingResponse",
    );
    expect(authoringPhaseLabel(task({ kind: "lesson", status: "waiting_author" }), t)).toBe(
      "waiting",
    );
  });

  it("gives concurrent same-phase tasks stable distinct labels", () => {
    const tasks = [
      task({ taskId: "task-b", requestId: "request-1", kind: "lesson" }),
      task({ taskId: "task-a", requestId: "request-1", kind: "lesson" }),
      task({ taskId: "task-c", requestId: "request-2", kind: "lesson" }),
    ];

    expect(authoringTaskDisplayLabels(tasks, {}, t)).toEqual({
      "task-a": "writingLesson (1)",
      "task-b": "writingLesson (2)",
    });
  });

  it("leaves a lone task out so its own view does not repeat its plain phase label", () => {
    const tasks = [task({ taskId: "task-a", requestId: "request-1", kind: "lesson" })];

    expect(authoringTaskDisplayLabels(tasks, {}, t)).toEqual({});
  });

  it("always keeps a known lesson title even when it is the only task in its phase", () => {
    const tasks = [task({ taskId: "task-a", requestId: "request-1", kind: "lesson" })];

    expect(
      authoringTaskDisplayLabels(tasks, { "task-a": "Getting started with Mentingo" }, t),
    ).toEqual({ "task-a": "Getting started with Mentingo" });
  });

  it("uses the current lesson title from progress metadata for tool context", () => {
    const tasks = [
      task({
        taskId: "task-a",
        requestId: "request-1",
        kind: "lesson",
        workProgress: {
          stage: "lesson_generation",
          chapterId: "chapter-1",
          chapterTitle: "Getting started",
          lessonTitle: "Welcome to the course",
        },
      }),
    ];

    expect(authoringTaskDisplayLabels(tasks, {}, t)).toEqual({
      "task-a": "Welcome to the course",
    });
  });
});
