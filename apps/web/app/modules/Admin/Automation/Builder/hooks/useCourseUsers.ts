import { useQuery } from "@tanstack/react-query";
import { /*useEffect,*/ useMemo } from "react";

import { useUsersEnrolledQuery } from "../../../../../../app/api/queries/admin/useUsersEnrolled";

import type { GetStudentsWithEnrollmentDateResponse } from "~/api/generated-api";
import type { Option } from "~/components/ui/multiselect";

type EnrolledStudent = GetStudentsWithEnrollmentDateResponse["data"][number];

export function useCourseUsers(courseId?: string) {
  const queryDef = useUsersEnrolledQuery(courseId ?? "");

  const { data, isLoading } = useQuery({
    ...queryDef,
    enabled: Boolean(courseId),
  });

  const options: Option[] = useMemo(() => {
    if (!data?.data) return [];

    return data.data.map((student: EnrolledStudent) => {
      const fullName = [student.firstName, student.lastName].filter(Boolean).join(" ");
      const label = fullName || student.email || student.id;

      return {
        value: student.id,
        label,
        imageUrl: (student as { avatarUrl?: string }).avatarUrl ?? undefined,
      };
    });
  }, [data]);

  //   useEffect(() => {
  //     if (!courseId) {
  //       console.log("Nie wybrano żadnego kursu.");
  //       return;
  //     }

  //     if (isLoading) {
  //       console.log(`Ładowanie uczestników dla kursu ID: ${courseId}...`);
  //       return;
  //     }

  //     console.log(`Uczestnicy dla kursu [ID: ${courseId}]:`, {
  //       rawStudentsData: data?.data ?? [],
  //       asSelectOptions: options,
  //     });
  //   }, [courseId, data, options, isLoading]);

  return { options, isLoading: isLoading && Boolean(courseId) };
}
