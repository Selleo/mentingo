import { describe, expect, it } from "vitest";

import {
  attachAuthoringTaskFailures,
  canRetryAuthoringTask,
  parseAuthoringTaskFailure,
} from "./authoringTaskFailure";

import type { AuthoringTask, AuthoringTaskFailure } from "./courseAuthoring.types";

const failure: AuthoringTaskFailure = {
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
const task: AuthoringTask = {
  taskId: "task-1",
  requestId: "request-1",
  status: "failed",
  errorCode: "task_execution_failed",
  outputId: null,
};

describe("authoring task recovery", () => {
  it("allows failed-part and provider retries but never service fixes or author answers", () => {
    expect(canRetryAuthoringTask({ ...task, failure })).toBe(true);
    expect(
      canRetryAuthoringTask({ ...task, failure: { ...failure, recoveryAction: "retry_provider" } }),
    ).toBe(true);
    expect(
      canRetryAuthoringTask({ ...task, failure: { ...failure, recoveryAction: "service_fix" } }),
    ).toBe(false);
    expect(
      canRetryAuthoringTask({
        ...task,
        failure: { ...failure, recoveryAction: "answer_question" },
      }),
    ).toBe(false);
    expect(canRetryAuthoringTask({ ...task, failure: { ...failure, retryable: false } })).toBe(
      false,
    );
    expect(canRetryAuthoringTask({ ...task, status: "running", failure })).toBe(false);
    expect(canRetryAuthoringTask(task)).toBe(true);
  });

  it("rejects malformed failure contracts and drops arbitrary payload fields", () => {
    expect(parseAuthoringTaskFailure({ ...failure, generationRevision: -1 })).toBeNull();
    expect(
      parseAuthoringTaskFailure({ ...failure, recoveryAction: "restart_everything" }),
    ).toBeNull();
    expect(parseAuthoringTaskFailure({ ...failure, rawMessage: "private source" })).toEqual(
      failure,
    );
  });

  it("restores safe failures from durable records without leaking them into retried tasks", () => {
    const records = [
      {
        id: "failure-1",
        kind: "task.failed",
        payload: {
          taskId: task.taskId,
          requestId: task.requestId,
          sequence: 10,
          failure,
        },
      },
    ];
    expect(attachAuthoringTaskFailures([task], records)[0].failure).toEqual(failure);
    expect(
      attachAuthoringTaskFailures([{ ...task, status: "running" }], records)[0].failure,
    ).toBeUndefined();
    expect(
      attachAuthoringTaskFailures([{ ...task, requestId: "another-request" }], records)[0].failure,
    ).toBeUndefined();
    expect(
      attachAuthoringTaskFailures([{ ...task, failure: null }], records)[0].failure,
    ).toBeNull();
  });
});
