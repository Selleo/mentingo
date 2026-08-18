import { AI_MENTOR_TYPE } from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  AI_MENTOR_AUTHORING_ACTION,
  AI_MENTOR_AUTHORING_VIEW,
  aiMentorAuthoringReducer,
  INITIAL_AI_MENTOR_AUTHORING_STATE,
} from "./aiMentorAuthoring.reducer";
import { AI_MENTOR_GENERATION_MODE } from "./aiMentorGeneration.types";

describe("aiMentorAuthoringReducer", () => {
  it("keeps generation and quality review mutually exclusive", () => {
    const generation = aiMentorAuthoringReducer(INITIAL_AI_MENTOR_AUTHORING_STATE, {
      type: AI_MENTOR_AUTHORING_ACTION.OPEN_GENERATION,
      mode: AI_MENTOR_GENERATION_MODE.CREATE,
    });
    const quality = aiMentorAuthoringReducer(generation, {
      type: AI_MENTOR_AUTHORING_ACTION.OPEN_QUALITY,
      quality: { passed: false, summary: "Needs a clearer goal.", findings: [] },
    });

    expect(generation).toMatchObject({ view: AI_MENTOR_AUTHORING_VIEW.GENERATION });
    expect(quality).toMatchObject({ view: AI_MENTOR_AUTHORING_VIEW.QUALITY });
    expect(quality.generation).toBeUndefined();
    expect(AI_MENTOR_TYPE.TEACHER).toBe("teacher");
  });
});
