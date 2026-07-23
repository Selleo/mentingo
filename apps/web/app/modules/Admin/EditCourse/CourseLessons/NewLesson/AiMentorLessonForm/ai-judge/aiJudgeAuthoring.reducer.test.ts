import {
  AI_JUDGE_DRAFT_CHANGE_FIELD,
  AI_JUDGE_GENERATION_MODE,
  AI_JUDGE_VALIDATION_SEVERITY,
  AI_JUDGE_VALIDATION_TARGET,
} from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  AI_JUDGE_AUTHORING_ACTION,
  AI_JUDGE_AUTHORING_VIEW,
  aiJudgeAuthoringReducer,
  getAiJudgeGenerationMode,
  getLatestAiJudgeValidation,
  INITIAL_AI_JUDGE_AUTHORING_STATE,
} from "./aiJudgeAuthoring.reducer";

import type { AiJudgeValidationResult } from "./aiJudgeConfiguration.types";

const validation: AiJudgeValidationResult = {
  passed: false,
  summary: "The task goal is not measurable.",
  issues: [
    {
      code: "goal_not_measurable",
      severity: AI_JUDGE_VALIDATION_SEVERITY.ERROR,
      target: {
        type: AI_JUDGE_VALIDATION_TARGET.CONFIGURATION,
        field: AI_JUDGE_DRAFT_CHANGE_FIELD.TASK_GOAL,
      },
      message: "The result cannot be observed.",
      correction: "Describe what the learner must demonstrate.",
    },
  ],
};

describe("aiJudgeAuthoringReducer", () => {
  it("opens generation in create mode without stale validation context", () => {
    const state = aiJudgeAuthoringReducer(INITIAL_AI_JUDGE_AUTHORING_STATE, {
      type: AI_JUDGE_AUTHORING_ACTION.OPEN_CREATE,
    });

    expect(state).toEqual({
      view: AI_JUDGE_AUTHORING_VIEW.GENERATION,
      mode: AI_JUDGE_GENERATION_MODE.CREATE,
    });
    expect(getLatestAiJudgeValidation(state)).toBeUndefined();
  });

  it("keeps validation context only in the improve generation state", () => {
    const state = aiJudgeAuthoringReducer(INITIAL_AI_JUDGE_AUTHORING_STATE, {
      type: AI_JUDGE_AUTHORING_ACTION.OPEN_IMPROVE,
      latestValidation: validation,
    });

    expect(getAiJudgeGenerationMode(state)).toBe(AI_JUDGE_GENERATION_MODE.IMPROVE);
    expect(getLatestAiJudgeValidation(state)).toBe(validation);
  });

  it("moves atomically between generation, editor, and closed views", () => {
    const generationState = aiJudgeAuthoringReducer(INITIAL_AI_JUDGE_AUTHORING_STATE, {
      type: AI_JUDGE_AUTHORING_ACTION.OPEN_IMPROVE,
      latestValidation: validation,
    });
    const editorState = aiJudgeAuthoringReducer(generationState, {
      type: AI_JUDGE_AUTHORING_ACTION.OPEN_EDITOR,
    });
    const closedState = aiJudgeAuthoringReducer(editorState, {
      type: AI_JUDGE_AUTHORING_ACTION.CLOSE,
    });

    expect(editorState).toEqual({ view: AI_JUDGE_AUTHORING_VIEW.EDITOR });
    expect(closedState).toEqual(INITIAL_AI_JUDGE_AUTHORING_STATE);
  });
});
