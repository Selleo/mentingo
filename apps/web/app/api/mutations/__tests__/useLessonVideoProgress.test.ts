import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  setQueriesData: vi.fn(),
  invalidateLearningPathProgressionData: vi.fn(),
}));

vi.mock("~/api/queryClient", () => ({
  queryClient: {
    invalidateQueries: mocks.invalidateQueries,
    setQueriesData: mocks.setQueriesData,
  },
}));

vi.mock("~/api/utils/invalidateLearningPathProgressionData", () => ({
  invalidateLearningPathProgressionData: mocks.invalidateLearningPathProgressionData,
}));

import { syncLessonVideoCompletionQueries } from "../useLessonVideoProgress";

describe("syncLessonVideoCompletionQueries", () => {
  it("does not invalidate the active lesson query while syncing completion state", async () => {
    await syncLessonVideoCompletionQueries("lesson-id");

    expect(mocks.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ["lesson", "lesson-id"],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["lessons"] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["lessonProgress", "lesson-id"],
    });
    expect(mocks.invalidateLearningPathProgressionData).toHaveBeenCalled();
  });
});
