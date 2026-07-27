import {
  AI_JUDGE_DRAFT_CHANGE_FIELD,
  AI_JUDGE_DRAFT_CHANGE_TYPE,
  AI_JUDGE_GENERATION_MAX_ATTEMPTS,
  AI_JUDGE_GENERATION_STATUS,
  AI_JUDGE_VALIDATION_SEVERITY,
} from "@repo/shared";
import { describe, expect, it } from "vitest";

import { AI_JUDGE_GENERATION_CHECK_STATUS } from "./aiJudgeConfiguration.types";
import { mapAiJudgeGenerationSnapshotToViewState } from "./aiJudgeGeneration.mappers";

import type { AiJudgeGenerationSnapshot } from "./aiJudgeGeneration.mappers";
import type { TFunction } from "i18next";

const t = ((key: string) => key) as TFunction;

const configuration = {
  taskGoal: "Resolve the customer's concern",
  passingThresholdPercent: 70,
  criteria: [
    {
      title: "Clarifies the concern",
      expectedBehavior: "Asks a focused follow-up question",
      maxScore: 1,
      scoreGuidance: [
        { score: 0, description: "Does not clarify", example: null },
        { score: 1, description: "Clarifies the concern", example: "What happened next?" },
      ],
    },
  ],
  blockingErrors: [{ description: "Invents a company policy" }],
};

describe("mapAiJudgeGenerationSnapshotToViewState", () => {
  it("maps the initial drafting state without inventing completed artifacts", () => {
    const snapshot = {
      generationId: "86a373e3-323e-48e5-809d-13ef66833113",
      progress: {
        status: AI_JUDGE_GENERATION_STATUS.DRAFTING,
        attempt: 1,
        attemptHistory: [],
      },
    } satisfies AiJudgeGenerationSnapshot;

    expect(mapAiJudgeGenerationSnapshotToViewState(snapshot, t)).toMatchObject({
      status: AI_JUDGE_GENERATION_STATUS.DRAFTING,
      attempt: 1,
      maxAttempts: AI_JUDGE_GENERATION_MAX_ATTEMPTS,
      completedArtifacts: [],
      evaluatorChecks: [],
      changes: [],
      attemptHistory: [],
    });
  });

  it("maps a revision draft and exposes the validator correction", () => {
    const snapshot = {
      generationId: "86a373e3-323e-48e5-809d-13ef66833113",
      progress: {
        status: AI_JUDGE_GENERATION_STATUS.REVISING,
        attempt: 2,
        draft: configuration,
        validation: {
          passed: false,
          summary: "One criterion is not observable",
          issues: [
            {
              code: "criterion_not_observable",
              severity: AI_JUDGE_VALIDATION_SEVERITY.ERROR,
              target: { type: "criterion", ref: "C1" },
              message: "C1 is too broad and must not duplicate B1",
              correction: "Describe one behavior C1 can assess without repeating B1",
            },
          ],
        },
        attemptHistory: [
          {
            attempt: 1,
            changes: [],
            validation: {
              passed: false,
              summary: "The first draft was too broad",
              issues: [],
            },
          },
        ],
        changes: [
          {
            type: AI_JUDGE_DRAFT_CHANGE_TYPE.CHANGED,
            targetRef: "C1",
            field: AI_JUDGE_DRAFT_CHANGE_FIELD.EXPECTED_BEHAVIOR,
            before: "Understands the concern",
            after: "Asks a focused follow-up question",
          },
        ],
      },
    } satisfies AiJudgeGenerationSnapshot;

    const state = mapAiJudgeGenerationSnapshotToViewState(snapshot, t);

    expect(state.currentCorrection).toBe(
      "Describe one behavior Clarifies the concern can assess without repeating Invents a company policy",
    );
    expect(state.draft?.criteria[0]?.scoreGuidance[0]?.example).toBeUndefined();
    expect(state.evaluatorChecks).toEqual([
      {
        id: "criterion_not_observable-0",
        label: "Clarifies the concern is too broad and must not duplicate Invents a company policy",
        detail:
          "Describe one behavior Clarifies the concern can assess without repeating Invents a company policy",
        targetRef: "C1",
        targetTypeLabel: "adminCourseView.curriculum.lesson.aiJudge.generation.target.criterion",
        targetLabel: "Clarifies the concern",
        status: AI_JUDGE_GENERATION_CHECK_STATUS.NEEDS_ATTENTION,
      },
    ]);
    expect(state.completedArtifacts).toHaveLength(4);
    expect(state.changes).toEqual([
      {
        ...snapshot.progress.changes[0],
        targetTypeLabel: "adminCourseView.curriculum.lesson.aiJudge.generation.target.criterion",
        targetLabel: "Clarifies the concern",
      },
    ]);
    expect(state.attemptHistory).toEqual([
      {
        attempt: 1,
        passed: false,
        summary: "The first draft was too broad",
        corrections: [],
        changes: [],
      },
    ]);
  });

  it("maps a completed configuration and its passing validation summary", () => {
    const snapshot = {
      generationId: "86a373e3-323e-48e5-809d-13ef66833113",
      progress: {
        status: AI_JUDGE_GENERATION_STATUS.COMPLETED,
        attempt: 1,
        configuration,
        validation: {
          passed: true,
          summary: "The assessment is measurable and coherent",
          issues: [],
        },
        attemptHistory: [],
      },
    } satisfies AiJudgeGenerationSnapshot;

    const state = mapAiJudgeGenerationSnapshotToViewState(snapshot, t);

    expect(state.draft?.taskGoal).toBe(configuration.taskGoal);
    expect(state.evaluatorChecks).toEqual([
      {
        id: "validation-summary",
        label: "The assessment is measurable and coherent",
        status: AI_JUDGE_GENERATION_CHECK_STATUS.PASSED,
      },
    ]);
  });

  it("maps deterministic findings to localized product copy", () => {
    const snapshot = {
      generationId: "86a373e3-323e-48e5-809d-13ef66833113",
      progress: {
        status: AI_JUDGE_GENERATION_STATUS.AWAITING_REVISION,
        attempt: 1,
        configuration,
        validation: {
          passed: false,
          summary: "The generated assessment structure needs correction.",
          issues: [
            {
              code: "missing_guidance_scores",
              severity: AI_JUDGE_VALIDATION_SEVERITY.ERROR,
              target: { type: "criterion", ref: "C1", field: "scoreGuidance" },
              message: "Scoring guidance is missing scores 1.",
              correction: "Add one guidance item for each missing score: 1.",
            },
          ],
        },
        attemptHistory: [],
      },
    } satisfies AiJudgeGenerationSnapshot;

    const state = mapAiJudgeGenerationSnapshotToViewState(snapshot, t);

    expect(state.evaluatorChecks[0]).toMatchObject({
      label:
        "adminCourseView.curriculum.lesson.aiJudge.generation.deterministicValidation.missing_guidance_scores.message",
      detail:
        "adminCourseView.curriculum.lesson.aiJudge.generation.deterministicValidation.missing_guidance_scores.correction",
    });
  });

  it("does not expose backend failure details in the view state", () => {
    const snapshot = {
      generationId: "86a373e3-323e-48e5-809d-13ef66833113",
      progress: {
        status: AI_JUDGE_GENERATION_STATUS.FAILED,
        attempt: 1,
        message: "Invalid schema for response_format: missing example",
        attemptHistory: [],
      },
    } satisfies AiJudgeGenerationSnapshot;

    const state = mapAiJudgeGenerationSnapshotToViewState(snapshot, t);

    expect(state).not.toHaveProperty("errorMessage");
  });
});
