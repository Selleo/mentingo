import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const COURSE_CHAT_USERS_QUERY_KEY = ["course-chat", "users"];

export const getCourseChatUsersQueryKey = (courseId: string) => [
  ...COURSE_CHAT_USERS_QUERY_KEY,
  courseId,
];

export const courseChatUsersQueryOptions = (courseId: string) =>
  queryOptions({
    enabled: Boolean(courseId),
    queryKey: getCourseChatUsersQueryKey(courseId),
    queryFn: async () => {
      const response = await ApiClient.api.courseChatControllerGetCourseChatUsers(courseId);

      return response.data.data;
    },
  });

export function useCourseChatUsers(courseId: string) {
  return useQuery(courseChatUsersQueryOptions(courseId));
}
