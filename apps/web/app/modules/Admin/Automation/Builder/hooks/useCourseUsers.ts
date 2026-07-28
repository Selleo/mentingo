import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useUsersEnrolledQuery } from "~/api/queries/admin/useUsersEnrolled";

import type { GetStudentsWithEnrollmentDateResponse } from "~/api/generated-api";
import type { Option } from "~/components/ui/multiselect";

export type FetchMode = "all_enrolled" | "organization" | "in_progress" | "inactive_for_days";

export interface UseCourseUsersParams {
  courseId?: string;
  mode?: FetchMode;
  inactiveDaysThreshold?: number;
}

type EnrolledStudent = GetStudentsWithEnrollmentDateResponse["data"][number] & {
  isOrganizationMember?: boolean;
  completedAt?: string | null;
  lastLessonCompletedAt?: string | null;
};

export function useCourseUsers({
  courseId,
  mode = "all_enrolled",
  inactiveDaysThreshold = 7,
}: UseCourseUsersParams) {
  const queryDef = useUsersEnrolledQuery(courseId ?? "");

  const { data, isLoading } = useQuery({
    ...queryDef,
    enabled: Boolean(courseId),
  });

  const filteredStudents = useMemo(() => {
    const rawStudents = (data?.data ?? []) as EnrolledStudent[];
    if (!rawStudents.length) return [];

    const now = new Date().getTime();

    return rawStudents.filter((student) => {
      switch (mode) {
        case "organization":
          return Boolean(student.isOrganizationMember);

        case "in_progress":
          return !student.completedAt;

        case "inactive_for_days": {
          if (!student.lastLessonCompletedAt) return true;
          const lastActivityTime = new Date(student.lastLessonCompletedAt).getTime();
          const diffInDays = (now - lastActivityTime) / (1000 * 60 * 60 * 24);
          return diffInDays >= inactiveDaysThreshold;
        }

        case "all_enrolled":
        default:
          return true;
      }
    });
  }, [data, mode, inactiveDaysThreshold]);

  const options: Option[] = useMemo(() => {
    return filteredStudents.map((student) => {
      const fullName = [student.firstName, student.lastName].filter(Boolean).join(" ");
      const label = fullName || student.email || student.id;

      return {
        value: student.id,
        label,
        imageUrl: (student as { avatarUrl?: string }).avatarUrl ?? undefined,
      };
    });
  }, [filteredStudents]);

  return {
    options,
    students: filteredStudents,
    isLoading: isLoading && Boolean(courseId),
  };
}
