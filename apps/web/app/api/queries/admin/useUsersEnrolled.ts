import { useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetStudentsWithEnrollmentDateResponse } from "~/api/generated-api";
import type { Option } from "~/components/ui/multiselect";

export type UsersEnrolledSearchParams = {
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

export const ENROLLED_USERS_QUERY_KEY = "users-enrollments";

export const useUsersEnrolledQuery = (
  courseId: string,
  searchParams?: UsersEnrolledSearchParams,
) => ({
  queryKey: [ENROLLED_USERS_QUERY_KEY, courseId, searchParams],
  queryFn: async () => {
    const { data } = await ApiClient.api.courseControllerGetStudentsWithEnrollmentDate(courseId, {
      ...(searchParams?.keyword && { keyword: searchParams.keyword }),
      ...(searchParams?.sort && { sort: searchParams.sort }),
      ...(searchParams?.groups && { groups: searchParams.groups.map(({ value }) => value) }),
      ...(searchParams?.page && { page: searchParams.page }),
      ...(searchParams?.perPage && { perPage: searchParams.perPage }),
    });
    return data;
  },
  select: (response: GetStudentsWithEnrollmentDateResponse) => response,
});

export function useAllUsersEnrolledSuspense(
  courseId = "",
  searchParams?: UsersEnrolledSearchParams,
) {
  return useSuspenseQuery(useUsersEnrolledQuery(courseId, searchParams));
}
