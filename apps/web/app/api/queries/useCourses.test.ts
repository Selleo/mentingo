import { describe, expect, it, vi } from "vitest";

import { allCoursesQueryOptions } from "./useCourses";

const getCourses = vi.hoisted(() => vi.fn());
vi.mock("../api-client", () => ({
  ApiClient: { api: { courseControllerGetAllCourses: getCourses } },
}));

describe("allCoursesQueryOptions archive filter", () => {
  it.each([
    [{ isArchived: false }, "false"],
    [{ isArchived: true }, "true"],
    [{ includeArchived: true }, "all"],
  ])("requests courses with the matching archive filter", async (params, expected) => {
    getCourses.mockResolvedValue({ data: { data: [] } });

    await allCoursesQueryOptions(params).queryFn();

    expect(getCourses).toHaveBeenCalledWith(expect.objectContaining({ isArchived: expected }));
  });

  it("omits the archive filter when no archive state is selected", async () => {
    getCourses.mockResolvedValue({ data: { data: [] } });

    await allCoursesQueryOptions().queryFn();

    expect(getCourses).toHaveBeenCalledWith(
      expect.not.objectContaining({ isArchived: expect.anything() }),
    );
  });
});
