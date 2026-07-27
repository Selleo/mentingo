import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/api/queryClient", () => ({
  queryClient: {
    invalidateQueries: mocks.invalidateQueries,
  },
}));

import { invalidateAiJudgeTranslationQueries } from "./useUpdateAiJudgeConfigurationTranslation";

describe("invalidateAiJudgeTranslationQueries", () => {
  beforeEach(() => {
    mocks.invalidateQueries.mockClear();
  });

  it("refreshes the Judge configuration and course translation status", async () => {
    await invalidateAiJudgeTranslationQueries({
      courseId: "course-id",
      lessonId: "lesson-id",
      language: "pl",
    });

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["ai-judge-configuration", "lesson-id"],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: [["missing-translations"], { id: "course-id", language: "pl" }],
    });
  });
});
