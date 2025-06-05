import { useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetStudentsWithEnrollmentDateResponse } from "~/api/generated-api";

export type UsersEnrolledSearchParams = {
  keyword?: string;
  sort?: "enrolledAt" | "-enrolledAt" | undefined;
};

export const ENROLLED_USERS_QUERY_KEY = "users-enrollments";

export const useUsersEnrolledQuery = (
  courseId: string,
  searchParams?: UsersEnrolledSearchParams,
) => ({
  queryKey: [ENROLLED_USERS_QUERY_KEY, searchParams],
  queryFn: async () => {
    const response = await ApiClient.api.courseControllerGetStudentsWithEnrollmentDate(courseId, {
      ...(searchParams?.keyword && { keyword: searchParams.keyword }),
      ...(searchParams?.sort && { sort: searchParams.sort }),
    });
    return response.data;
  },
  select: ({ data }: GetStudentsWithEnrollmentDateResponse) => data,
});

export function useAllUsersEnrolledSuspense(
  courseId = "",
  searchParams?: UsersEnrolledSearchParams,
) {
  return useSuspenseQuery(useUsersEnrolledQuery(courseId, searchParams));
}
