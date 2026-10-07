import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/api/queryClient", () => ({
  queryClient: {
    invalidateQueries: mocks.invalidateQueries,
  },
}));

import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";

import { invalidateCourseCurriculumData } from "./invalidateCourseCurriculumData";

describe("invalidateCourseCurriculumData", () => {
  beforeEach(() => {
    mocks.invalidateQueries.mockClear();
  });

  it("awaits refetches for every curriculum query family after application", async () => {
    await invalidateCourseCurriculumData();

    expect(mocks.invalidateQueries).toHaveBeenCalledTimes(5);
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: [COURSE_QUERY_KEY],
      refetchType: "all",
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["course"],
      refetchType: "all",
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["lesson"],
      refetchType: "all",
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["lessons"],
      refetchType: "all",
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["lessons-sequence"],
      refetchType: "all",
    });
  });
});
