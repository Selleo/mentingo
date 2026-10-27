import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  setQueriesData: vi.fn(),
  invalidateLearningPathProgressionData: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({ useMutation: mocks.useMutation }));

vi.mock("~/api/queryClient", () => ({
  queryClient: {
    invalidateQueries: mocks.invalidateQueries,
    setQueriesData: mocks.setQueriesData,
  },
}));

vi.mock("~/api/utils/invalidateLearningPathProgressionData", () => ({
  invalidateLearningPathProgressionData: mocks.invalidateLearningPathProgressionData,
}));

import {
  syncLessonVideoCompletionQueries,
  useLessonVideoProgress,
} from "../useLessonVideoProgress";

beforeEach(() => vi.clearAllMocks());

describe("useLessonVideoProgress", () => {
  it.each([
    ["current", "repetition", false],
    ["repetition", "repetition", true],
    [undefined, undefined, true],
  ])(
    "only completes cached lessons from the response state (%s, %s)",
    (responseState, cachedState, completed) => {
      const cached = { data: { learningStateId: cachedState, lessonCompleted: false } };
      mocks.setQueriesData.mockImplementation((_filter, update) => {
        expect(update(cached).data.lessonCompleted).toBe(completed);
      });
      useLessonVideoProgress();
      const { onSuccess } = mocks.useMutation.mock.calls[0][0];
      onSuccess(
        { lessonId: "lesson-id", lessonCompleted: true },
        { learningStateId: responseState },
      );
      expect(mocks.setQueriesData).toHaveBeenCalledOnce();
    },
  );
});

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
