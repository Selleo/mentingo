import { beforeEach, describe, expect, it } from "vitest";

import { getCourseQueryKey } from "~/api/queries/useCourse";
import { queryClient } from "~/api/queryClient";

import { updateCourseOverviewCache } from "./updateCourseOverviewCache";

import type { GetCourseResponse } from "~/api/generated-api";

const course = {
  category: "Analytics",
  categoryId: "category-1",
  description: "Original description",
  id: "course-1",
  learningOutcomes: ["Original outcome"],
  title: "Original title",
} as GetCourseResponse["data"];
const courseIdOrSlug = "course-slug";
const courseResponse = { data: course } as GetCourseResponse;

describe("updateCourseOverviewCache", () => {
  beforeEach(() => {
    queryClient.clear();
    queryClient.setQueryData<GetCourseResponse>(
      getCourseQueryKey(courseIdOrSlug, "en"),
      courseResponse,
    );
    queryClient.setQueryData<GetCourseResponse>(getCourseQueryKey(courseIdOrSlug, "pl"), {
      data: {
        ...course,
        description: "Polish description",
        learningOutcomes: ["Polish outcome"],
        title: "Polish title",
      },
    });
  });

  it("patches only the submitted localized overview fields", () => {
    updateCourseOverviewCache({
      categoryTitle: "Data",
      data: {
        categoryId: "category-2",
        description: "Updated description",
        language: "en",
        title: "Updated title",
      },
      language: "en",
      idOrSlug: courseIdOrSlug,
    });

    expect(
      queryClient.getQueryData<GetCourseResponse>(getCourseQueryKey(courseIdOrSlug, "en")),
    ).toEqual({
      data: {
        ...course,
        category: "Data",
        categoryId: "category-2",
        description: "Updated description",
        title: "Updated title",
      },
    });
    expect(
      queryClient.getQueryData<GetCourseResponse>(getCourseQueryKey(course.id, "en")),
    ).toBeUndefined();
  });

  it("preserves an intentionally empty learning-outcomes save", () => {
    updateCourseOverviewCache({
      data: {
        language: "en",
        learningOutcomes: [],
      },
      language: "en",
      idOrSlug: courseIdOrSlug,
    });

    expect(
      queryClient.getQueryData<GetCourseResponse>(getCourseQueryKey(courseIdOrSlug, "en"))?.data
        .learningOutcomes,
    ).toEqual([]);
  });

  it("updates only the cache for the submitted course language", () => {
    updateCourseOverviewCache({
      data: {
        language: "pl",
        learningOutcomes: ["Zaktualizowany efekt"],
      },
      language: "pl",
      idOrSlug: courseIdOrSlug,
    });

    expect(
      queryClient.getQueryData<GetCourseResponse>(getCourseQueryKey(courseIdOrSlug, "pl"))?.data
        .learningOutcomes,
    ).toEqual(["Zaktualizowany efekt"]);
    expect(
      queryClient.getQueryData<GetCourseResponse>(getCourseQueryKey(courseIdOrSlug, "en"))?.data
        .learningOutcomes,
    ).toEqual(["Original outcome"]);
  });
});
