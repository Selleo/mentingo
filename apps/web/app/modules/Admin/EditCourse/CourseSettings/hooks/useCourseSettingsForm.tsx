import { zodResolver } from "@hookform/resolvers/zod";
import { type SubmitHandler, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useUpdateCourse } from "~/api/mutations/admin/useUpdateCourse";
import { courseQueryOptions as betaCourseQueryOptions } from "~/api/queries/admin/useBetaCourse";
import { courseQueryOptions as courseQueryOptions } from "~/api/queries/useCourse";
import { queryClient } from "~/api/queryClient";
import { courseSettingsFormSchema } from "~/modules/Admin/EditCourse/CourseSettings/validators/courseSettingsFormSchema";

import type { SupportedLanguages } from "@repo/shared";
import type { CourseSettingsFormValues } from "~/modules/Admin/EditCourse/CourseSettings/validators/courseSettingsFormSchema";

type CourseSettingsProps = {
  title?: string;
  description?: string;
  categoryId?: string;
  thumbnailS3Key?: string;
  courseId: string;
  courseLanguage: SupportedLanguages;
};

export const useCourseSettingsForm = ({
  title,
  description,
  categoryId,
  thumbnailS3Key,
  courseId,
  courseLanguage,
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
      language: courseLanguage,
    },
  });

  const onSubmit: SubmitHandler<CourseSettingsFormValues> = async (data) => {
    await updateCourse({
      data,
      courseId,
    });

    await queryClient.invalidateQueries(betaCourseQueryOptions(courseId));
    await queryClient.invalidateQueries(courseQueryOptions(courseId, courseLanguage));
  };

  return { form, onSubmit, reset: form.reset };
};
