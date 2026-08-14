import { getCourseQueryKey } from "~/api/queries/useCourse";
import { queryClient } from "~/api/queryClient";

import type { SupportedLanguages } from "@repo/shared";
import type { GetCourseResponse, UpdateCourseBody } from "~/api/generated-api";

type UpdateCourseOverviewCacheOptions = {
  categoryTitle?: string;
  data: UpdateCourseBody;
  idOrSlug: string;
  language: SupportedLanguages;
};

export function updateCourseOverviewCache({
  categoryTitle,
  data,
  idOrSlug,
  language,
}: UpdateCourseOverviewCacheOptions) {
  queryClient.setQueryData<GetCourseResponse>(
    getCourseQueryKey(idOrSlug, language),
    (cachedResponse) => {
      if (!cachedResponse) return cachedResponse;

      return {
        ...cachedResponse,
        data: {
          ...cachedResponse.data,
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.learningOutcomes !== undefined
            ? { learningOutcomes: data.learningOutcomes }
            : {}),
          ...(data.categoryId !== undefined
            ? {
                categoryId: data.categoryId,
                ...(categoryTitle !== undefined ? { category: categoryTitle } : {}),
              }
            : {}),
        },
      };
    },
  );
}
