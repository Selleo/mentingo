import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export type CourseSettingsParams = {
  courseId?: string;
};

export const getCourseSettingsQueryKey = (searchParams: CourseSettingsParams) => [
  "course-settings",
  searchParams,
];

export const courseSettingsQueryOptions = (searchParams: CourseSettingsParams) => ({
  queryKey: getCourseSettingsQueryKey(searchParams),
  queryFn: async () => {
    const response = await ApiClient.api.courseControllerGetCourseSettings(searchParams.courseId!);
    return response.data.data;
  },
  enabled: !!searchParams.courseId,
});

export function useCourseSettings(searchParams: CourseSettingsParams) {
  return useQuery(courseSettingsQueryOptions(searchParams));
}

export function useCourseSettingsSuspense(searchParams: CourseSettingsParams) {
  return useSuspenseQuery(courseSettingsQueryOptions(searchParams));
}
