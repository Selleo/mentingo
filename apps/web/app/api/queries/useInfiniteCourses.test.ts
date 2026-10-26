import { describe, expect, it, vi } from "vitest";

import { infiniteCoursesQueryOptions } from "./useInfiniteCourses";

import type { GetAllCoursesResponse } from "../generated-api";

const getCourses = vi.hoisted(() => vi.fn());
vi.mock("../api-client", () => ({
  ApiClient: { api: { courseControllerGetAllCourses: getCourses } },
}));

const pageOf = (page: number, perPage: number, totalItems: number) =>
  ({ data: [], pagination: { page, perPage, totalItems } }) as GetAllCoursesResponse;

describe("infiniteCoursesQueryOptions", () => {
  it("requests the given page of non-archived courses", async () => {
    getCourses.mockResolvedValue({ data: pageOf(2, 12, 30) });

    await infiniteCoursesQueryOptions({ language: "en", state: "published" }).queryFn({
      pageParam: 2,
    });

    expect(getCourses).toHaveBeenCalledWith(
      expect.objectContaining({
        isArchived: "false",
        status: "published",
        language: "en",
        page: 2,
        perPage: 12,
      }),
    );
  });

  it("continues until every course is loaded", () => {
    const { getNextPageParam } = infiniteCoursesQueryOptions({ language: "en" });

    expect(getNextPageParam(pageOf(1, 12, 30))).toBe(2);
    expect(getNextPageParam(pageOf(2, 12, 30))).toBe(3);
    expect(getNextPageParam(pageOf(3, 12, 30))).toBeUndefined();
  });
});
