import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export type LessonSequenceParams = {
  courseId?: string;
  enabled?: boolean;
};

export const getLessonSequenceQueryKey = (searchParams: LessonSequenceParams) => [
  "lessons-sequence",
  { courseId: searchParams.courseId },
];

export const lessonSequenceQueryOptions = (searchParams: LessonSequenceParams) => ({
  queryKey: getLessonSequenceQueryKey(searchParams),
  queryFn: async () => {
    const response = await ApiClient.api.courseControllerGetLessonSequenceEnabled(
      searchParams.courseId!,
    );
    return response.data;
  },
  enabled: !!searchParams.courseId && searchParams.enabled !== false,
});

export function useLessonSequence(searchParams: LessonSequenceParams) {
  return useQuery(lessonSequenceQueryOptions(searchParams));
}

export function useLessonSequenceSuspense(searchParams: LessonSequenceParams) {
  return useSuspenseQuery(lessonSequenceQueryOptions(searchParams));
}
