import type {
  AiMentorGenerationMode,
  AiMentorGenerationViewState,
  AiMentorQualityResult,
} from "./aiMentorGeneration.types";

export const AI_MENTOR_AUTHORING_VIEW = {
  CLOSED: "closed",
  EDITOR: "editor",
  GENERATION: "generation",
  QUALITY: "quality",
} as const;

type AiMentorAuthoringState = {
  view: (typeof AI_MENTOR_AUTHORING_VIEW)[keyof typeof AI_MENTOR_AUTHORING_VIEW];
  mode?: AiMentorGenerationMode;
  generation?: AiMentorGenerationViewState;
  quality?: AiMentorQualityResult;
};

export const INITIAL_AI_MENTOR_AUTHORING_STATE: AiMentorAuthoringState = {
  view: AI_MENTOR_AUTHORING_VIEW.CLOSED,
};

export const AI_MENTOR_AUTHORING_ACTION = {
  OPEN_EDITOR: "open_editor",
  OPEN_GENERATION: "open_generation",
  OPEN_QUALITY: "open_quality",
  CLOSE: "close",
} as const;

type AiMentorAuthoringAction =
  | { type: "open_editor" }
  | { type: "open_generation"; mode: AiMentorGenerationMode }
  | { type: "open_quality"; quality?: AiMentorQualityResult }
  | { type: "close" };

export const aiMentorAuthoringReducer = (
  state: AiMentorAuthoringState,
  action: AiMentorAuthoringAction,
): AiMentorAuthoringState => {
  switch (action.type) {
    case AI_MENTOR_AUTHORING_ACTION.OPEN_EDITOR:
      return { view: AI_MENTOR_AUTHORING_VIEW.EDITOR };
    case AI_MENTOR_AUTHORING_ACTION.OPEN_GENERATION:
      return { view: AI_MENTOR_AUTHORING_VIEW.GENERATION, mode: action.mode };
    case AI_MENTOR_AUTHORING_ACTION.OPEN_QUALITY:
      return { view: AI_MENTOR_AUTHORING_VIEW.QUALITY, quality: action.quality };
    case AI_MENTOR_AUTHORING_ACTION.CLOSE:
      return INITIAL_AI_MENTOR_AUTHORING_STATE;
  }
};

export type { AiMentorAuthoringState };
