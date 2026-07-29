import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/api/queryClient", () => ({
  queryClient: {
    invalidateQueries: mocks.invalidateQueries,
  },
}));

import { invalidateGeneratedTranslationQueries } from "./invalidateGeneratedTranslationQueries";

describe("invalidateGeneratedTranslationQueries", () => {
  beforeEach(() => {
    mocks.invalidateQueries.mockClear();
  });

  it("invalidates AI Judge configurations after generating missing translations", async () => {
    await invalidateGeneratedTranslationQueries({
      courseId: "course-id",
      language: "pl",
    });

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["ai-judge-configuration"],
    });
  });
});
