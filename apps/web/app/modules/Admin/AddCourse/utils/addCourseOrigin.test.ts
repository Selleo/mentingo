import { describe, expect, it } from "vitest";

import { COURSES_TABLE_PATH } from "~/modules/Courses/utils/coursesView";

import {
  buildAddCourseFromCategoryPath,
  getAddCourseExitPath,
  withAddCourseContext,
} from "./addCourseOrigin";

describe("addCourseOrigin", () => {
  it("returns to the catalogue only when creation started there", () => {
    const fromCourses = new URL(buildAddCourseFromCategoryPath("category-1"), "http://local")
      .searchParams;

    expect(getAddCourseExitPath(fromCourses)).toBe("/courses");
    expect(getAddCourseExitPath(new URLSearchParams())).toBe(COURSES_TABLE_PATH);
    expect(getAddCourseExitPath(new URLSearchParams({ from: "https://evil.test" }))).toBe(
      COURSES_TABLE_PATH,
    );
  });

  it("carries only the category preset and origin between creation steps", () => {
    const searchParams = new URLSearchParams({
      categoryId: "category-1",
      from: "courses",
      unrelated: "value",
    });

    expect(withAddCourseContext("/admin/beta-courses/new", searchParams)).toBe(
      "/admin/beta-courses/new?categoryId=category-1&from=courses",
    );
    expect(withAddCourseContext("/admin/beta-courses/new", new URLSearchParams())).toBe(
      "/admin/beta-courses/new",
    );
  });
});
