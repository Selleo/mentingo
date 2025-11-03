import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useUpdateCourse } from "~/api/mutations/admin/useUpdateCourse";
import { courseQueryOptions } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import { courseSettingsFormSchema } from "~/modules/Admin/EditCourse/CourseSettings/validators/courseSettingsFormSchema";

import type { UpdateCourseBody } from "~/api/generated-api";
import type { CourseSettingsFormValues } from "~/modules/Admin/EditCourse/CourseSettings/validators/courseSettingsFormSchema";

type CourseSettingsProps = {
  title?: string;
  description?: string;
  categoryId?: string;
  thumbnailS3Key?: string;
  courseId: string;
};

export const useCourseSettingsForm = ({
  title,
  description,
  categoryId,
  thumbnailS3Key,
  courseId,
}: CourseSettingsProps) => {
  const { t } = useTranslation();
  const { mutateAsync: updateCourse } = useUpdateCourse();

  const form = useForm<CourseSettingsFormValues>({
    resolver: zodResolver(courseSettingsFormSchema(t)),
    defaultValues: {
      title: title || "",
      description: description || "",
      categoryId: categoryId || "",
      thumbnailS3Key: thumbnailS3Key || "",
    },
  });

  const onSubmit = async (data: UpdateCourseBody) => {
    updateCourse({
      data: { ...data },
      courseId,
    }).then(() => {
      queryClient.invalidateQueries(courseQueryOptions(courseId));
    });
  };

  return { form, onSubmit };
};
