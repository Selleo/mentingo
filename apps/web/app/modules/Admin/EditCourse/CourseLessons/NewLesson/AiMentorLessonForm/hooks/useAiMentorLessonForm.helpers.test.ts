import { describe, expect, it } from "vitest";

import { getAiMentorLessonFormDefaultValues } from "./useAiMentorLessonForm.helpers";

describe("getAiMentorLessonFormDefaultValues", () => {
  it("keeps new structured configurations empty until the dialog is applied", () => {
    expect(getAiMentorLessonFormDefaultValues(null).aiMentorConfiguration).toBeUndefined();
  });
});
