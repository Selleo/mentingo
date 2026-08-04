import { useMemo } from "react";

import { useCourses as useCourseQuery } from "~/api/queries/useCourses";

import type { Option } from "~/components/ui/multiselect";

export function useCoursesOptions() {
  const { data: courses, isLoading } = useCourseQuery();

  const options: Option[] = useMemo(
    () =>
      (courses ?? []).map((course: { id: string; title: string; thumbnailUrl: string | null }) => ({
        value: course.id,
        label: course.title,
        imageUrl: course.thumbnailUrl ?? undefined,
      })),
    [courses],
  );

  return { options, isLoading };
}
