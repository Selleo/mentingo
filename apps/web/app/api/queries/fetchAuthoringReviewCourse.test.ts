/** Reproduce a fresh cached plain body while the server has just prepared stable anchors. */
import { afterEach, describe, expect, it, vi } from "vitest";

import { queryClient } from "../queryClient";

import { courseQueryOptions } from "./admin/useBetaCourse";
import { fetchAuthoringReviewCourse } from "./fetchAuthoringReviewCourse";

import type { QueryKey } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({ fetchCourse: vi.fn() }));
vi.mock("~/api/api-client", () => ({
  ApiClient: { api: { courseControllerGetBetaCourseById: mocks.fetchCourse } },
}));

afterEach(() => {
  queryClient.clear();
  vi.resetAllMocks();
});

describe("fetchAuthoringReviewCourse", () => {
  it("refreshes a still-fresh course cache so review receives server-prepared anchor identities", async () => {
    const key: QueryKey = courseQueryOptions("course", "en").queryKey;
    queryClient.setQueryData(key, {
      data: { chapters: [{ lessons: [{ id: "lesson", description: "Existing words" }] }] },
    });
    const prepared = {
      chapters: [
        {
          lessons: [
            { id: "lesson", description: '<p data-authoring-block-id="anchor">Existing words</p>' },
          ],
        },
      ],
    };
    mocks.fetchCourse.mockResolvedValue({ data: { data: prepared } });
    const current = await fetchAuthoringReviewCourse("course", "en");
    expect(mocks.fetchCourse).toHaveBeenCalledWith({ id: "course", language: "en" });
    expect(current).toEqual(prepared);
    expect(queryClient.getQueryData(key)).toEqual({ data: prepared });
  });
});
