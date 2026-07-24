import { AI_JUDGE_GENERATION_MODE } from "./aiJudgeConfiguration.types";

import type { AiJudgeGenerationMode, AiJudgeValidationResult } from "./aiJudgeConfiguration.types";

export const AI_JUDGE_AUTHORING_VIEW = {
  CLOSED: "closed",
  EDITOR: "editor",
  GENERATION: "generation",
} as const;

export const AI_JUDGE_AUTHORING_ACTION = {
  CLOSE: "close",
  OPEN_EDITOR: "open_editor",
  OPEN_CREATE: "open_create",
  OPEN_IMPROVE: "open_improve",
} as const;

export type AiJudgeAuthoringState =
  | { view: typeof AI_JUDGE_AUTHORING_VIEW.CLOSED }
  | { view: typeof AI_JUDGE_AUTHORING_VIEW.EDITOR }
  | {
      view: typeof AI_JUDGE_AUTHORING_VIEW.GENERATION;
      mode: typeof AI_JUDGE_GENERATION_MODE.CREATE;
    }
  | {
      view: typeof AI_JUDGE_AUTHORING_VIEW.GENERATION;
      mode: typeof AI_JUDGE_GENERATION_MODE.IMPROVE;
      latestValidation?: AiJudgeValidationResult;
    };

export type AiJudgeAuthoringAction =
  | { type: typeof AI_JUDGE_AUTHORING_ACTION.CLOSE }
  | { type: typeof AI_JUDGE_AUTHORING_ACTION.OPEN_EDITOR }
  | { type: typeof AI_JUDGE_AUTHORING_ACTION.OPEN_CREATE }
  | {
      type: typeof AI_JUDGE_AUTHORING_ACTION.OPEN_IMPROVE;
      latestValidation?: AiJudgeValidationResult;
    };

export const INITIAL_AI_JUDGE_AUTHORING_STATE: AiJudgeAuthoringState = {
  view: AI_JUDGE_AUTHORING_VIEW.CLOSED,
};

export const aiJudgeAuthoringReducer = (
  _state: AiJudgeAuthoringState,
  action: AiJudgeAuthoringAction,
): AiJudgeAuthoringState => {
  switch (action.type) {
    case AI_JUDGE_AUTHORING_ACTION.CLOSE:
      return INITIAL_AI_JUDGE_AUTHORING_STATE;
    case AI_JUDGE_AUTHORING_ACTION.OPEN_EDITOR:
      return { view: AI_JUDGE_AUTHORING_VIEW.EDITOR };
    case AI_JUDGE_AUTHORING_ACTION.OPEN_CREATE:
      return {
        view: AI_JUDGE_AUTHORING_VIEW.GENERATION,
        mode: AI_JUDGE_GENERATION_MODE.CREATE,
      };
    case AI_JUDGE_AUTHORING_ACTION.OPEN_IMPROVE:
      return {
        view: AI_JUDGE_AUTHORING_VIEW.GENERATION,
        mode: AI_JUDGE_GENERATION_MODE.IMPROVE,
        latestValidation: action.latestValidation,
      };
  }
};

export const getAiJudgeGenerationMode = (state: AiJudgeAuthoringState): AiJudgeGenerationMode => {
  if (state.view === AI_JUDGE_AUTHORING_VIEW.GENERATION) return state.mode;
  return AI_JUDGE_GENERATION_MODE.CREATE;
};

export const getLatestAiJudgeValidation = (state: AiJudgeAuthoringState) => {
  if (
    state.view === AI_JUDGE_AUTHORING_VIEW.GENERATION &&
    state.mode === AI_JUDGE_GENERATION_MODE.IMPROVE
  )
    return state.latestValidation;

  return undefined;
};
