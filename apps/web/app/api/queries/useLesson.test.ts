import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { ApiClient } from "../api-client";

import { lessonQueryOptions } from "./useLesson";

vi.mock("../api-client", () => ({
  ApiClient: { api: { lessonControllerGetLessonById: vi.fn() } },
}));

const lessonId = "724f4bc2-9d22-44f1-9832-32fc262d5b18";

describe("lessonQueryOptions", () => {
  it("preserves a nonempty student UUID for student-specific requests", async () => {
    const studentId = "fcf07c1a-7a8e-4473-bbfa-d3dc848214b6";
    vi.mocked(ApiClient.api.lessonControllerGetLessonById).mockResolvedValueOnce({
      data: { data: { id: lessonId } },
    } as Awaited<ReturnType<typeof ApiClient.api.lessonControllerGetLessonById>>);
    const client = new QueryClient();

    try {
      await client.fetchQuery(lessonQueryOptions(lessonId, SUPPORTED_LANGUAGES.PL, studentId));
      expect(ApiClient.api.lessonControllerGetLessonById).toHaveBeenLastCalledWith(lessonId, {
        language: SUPPORTED_LANGUAGES.PL,
        studentId,
      });
    } finally {
      client.clear();
    }
  });

  it.each([undefined, ""])(
    "omits the optional student UUID for anonymous requests (%s)",
    async (studentId) => {
      const response = { data: { id: lessonId } };
      vi.mocked(ApiClient.api.lessonControllerGetLessonById).mockResolvedValueOnce({
        data: response,
      } as Awaited<ReturnType<typeof ApiClient.api.lessonControllerGetLessonById>>);
      const client = new QueryClient();

      try {
        await expect(
          client.fetchQuery(lessonQueryOptions(lessonId, SUPPORTED_LANGUAGES.EN, studentId)),
        ).resolves.toEqual(response);
        expect(ApiClient.api.lessonControllerGetLessonById).toHaveBeenLastCalledWith(lessonId, {
          language: SUPPORTED_LANGUAGES.EN,
          studentId: undefined,
        });
      } finally {
        client.clear();
      }
    },
  );
});
