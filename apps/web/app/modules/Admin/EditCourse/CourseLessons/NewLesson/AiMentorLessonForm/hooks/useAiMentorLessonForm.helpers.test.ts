import { AI_MENTOR_TYPE } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { getAiMentorLessonFormDefaultValues } from "./useAiMentorLessonForm.helpers";

describe("getAiMentorLessonFormDefaultValues", () => {
  it("defaults new AI Mentor lessons to Roleplay", () => {
    expect(getAiMentorLessonFormDefaultValues(null).type).toBe(AI_MENTOR_TYPE.ROLEPLAY);
  });
});
