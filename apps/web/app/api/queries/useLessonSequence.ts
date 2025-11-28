import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export type LessonSequenceParams = {
  courseId?: string;
};

export const getLessonSequenceQueryKey = (searchParams: LessonSequenceParams) => [
  "lessons-sequence",
  searchParams,
];

export const lessonSequenceQueryOptions = (searchParams: LessonSequenceParams) => ({
  queryKey: getLessonSequenceQueryKey(searchParams),
  queryFn: async () => {
    const response = await ApiClient.api.courseControllerGetLessonSequenceEnabled(
      searchParams.courseId!,
    );
    return response.data;
  },
  enabled: !!searchParams.courseId,
});

export function useLessonSequence(searchParams: LessonSequenceParams) {
  return useQuery(lessonSequenceQueryOptions(searchParams));
}

export function useLessonSequenceSuspense(searchParams: LessonSequenceParams) {
  return useSuspenseQuery(lessonSequenceQueryOptions(searchParams));
}
