import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetStudentsWithEnrollmentDateResponse } from "~/api/generated-api";
import type { Option } from "~/components/ui/multiselect";

export type LearningPathEnrolledUsersSearchParams = {
  keyword?: string;
  sort?:
    | "enrolledAt"
    | "-enrolledAt"
    | "firstName"
    | "-firstName"
    | "lastName"
    | "-lastName"
    | "email"
    | "-email"
    | "isEnrolledByGroup"
    | "-isEnrolledByGroup";
  groups?: Option[];
  page?: number;
  perPage?: number;
};

export const LEARNING_PATH_ENROLLED_USERS_QUERY_KEY = "learning-path-users-enrollments";

export const learningPathEnrolledUsersQueryOptions = (
  learningPathId: string,
  searchParams?: LearningPathEnrolledUsersSearchParams,
) => ({
  queryKey: [LEARNING_PATH_ENROLLED_USERS_QUERY_KEY, learningPathId, searchParams],
  queryFn: async () => {
    const { data } =
      await ApiClient.api.learningPathEnrollmentControllerGetStudentsWithEnrollmentDate(
        learningPathId,
        {
          ...(searchParams?.keyword && { keyword: searchParams.keyword }),
          ...(searchParams?.sort && { sort: searchParams.sort }),
          ...(searchParams?.groups && { groups: searchParams.groups.map(({ value }) => value) }),
          ...(searchParams?.page && { page: searchParams.page }),
          ...(searchParams?.perPage && { perPage: searchParams.perPage }),
        },
      );

    return data;
  },
  select: (response: GetStudentsWithEnrollmentDateResponse) => response,
  enabled: !!learningPathId,
});

export function useLearningPathEnrolledUsers(
  learningPathId: string,
  searchParams?: LearningPathEnrolledUsersSearchParams,
) {
  return useQuery(learningPathEnrolledUsersQueryOptions(learningPathId, searchParams));
}
