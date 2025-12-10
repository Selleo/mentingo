import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { useUpdateCourse } from "~/api/mutations/admin/useUpdateCourse";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";

import { courseStatusFormSchema } from "../validators/courseStatusFormSchema";

import type { CourseStatusFormValues } from "../validators/courseStatusFormSchema";
import type { SupportedLanguages } from "@repo/shared";
import type { UpdateCourseBody } from "~/api/generated-api";
import type { CourseStatus } from "~/api/queries/useCourses";

type UseCourseStatusFormProps = {
  courseId: string;
  status?: CourseStatus;
  language: SupportedLanguages;
};

export const useCourseStatusForm = ({ courseId, status, language }: UseCourseStatusFormProps) => {
  const { mutateAsync: updateCourse } = useUpdateCourse();
  const form = useForm<CourseStatusFormValues>({
    resolver: zodResolver(courseStatusFormSchema),
    defaultValues: {
      status: status || "draft",
    },
  });
  const onSubmit = async (data: UpdateCourseBody) => {
    updateCourse({
      data: { ...data, language },
      courseId,
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY, { id: courseId }] });
    });
  };

  return { form, onSubmit };
};
