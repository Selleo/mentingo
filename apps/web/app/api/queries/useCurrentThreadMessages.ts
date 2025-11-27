import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

interface CurrentThreadQueryParams {
  lessonId: string;
  isThreadLoading: boolean;
  threadId?: string;
  studentId?: string | null;
}

export const getCurrentThreadQueryKey = (lessonId: string, studentId?: string | null) => [
  "threadMessages",
  { lessonId },
  studentId ? { studentId } : null,
];

export const currentThreadQueryOptions = ({
  lessonId,
  isThreadLoading,
  threadId,
  studentId,
}: CurrentThreadQueryParams) =>
  queryOptions({
    enabled: !!threadId && !isThreadLoading,
    queryKey: getCurrentThreadQueryKey(lessonId, studentId),
    queryFn: async () => {
      const response = await ApiClient.api.aiControllerGetThreadMessages({
        thread: threadId,
        studentId: studentId || "",
      });
      return response.data;
    },
  });

export function useCurrentThreadMessages({
  lessonId,
  isThreadLoading,
  threadId,
  studentId,
}: CurrentThreadQueryParams) {
  return useQuery(currentThreadQueryOptions({ lessonId, isThreadLoading, threadId, studentId }));
}
export function useSuspenseCurrentThreadMessages({
  lessonId,
  isThreadLoading,
  threadId,
  studentId,
}: CurrentThreadQueryParams) {
  return useSuspenseQuery(
    currentThreadQueryOptions({ lessonId, isThreadLoading, threadId, studentId }),
  );
}
