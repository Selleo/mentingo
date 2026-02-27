import { useMutation } from "@tanstack/react-query";
import { get } from "lodash-es";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { getCourseSettingsQueryKey } from "../queries/useCourseSettings.js";
import { getLessonSequenceQueryKey } from "../queries/useLessonSequence.js";

import type { AxiosError } from "axios";

type UpdateCourseSettingsBody = {
  lessonSequenceEnabled?: boolean;
  quizFeedbackEnabled?: boolean;
  removeCertificateSignature?: boolean;
  certificateSignature?: File;
  certificateFontColor?: string;
};

type UpdateCourseSettingsParams = {
  courseId: string;
  data: UpdateCourseSettingsBody;
  showToast?: boolean;
};

export function useUpdateCourseSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ courseId, data }: UpdateCourseSettingsParams) => {
      const hasFile = data.certificateSignature instanceof File;
      const response = hasFile
        ? await (() => {
            const formData = new FormData();
            Object.entries(data).forEach(([key, value]) => {
              if (value === undefined || value === null) return;
              formData.append(key, value instanceof File ? value : String(value));
            });

            return ApiClient.instance.patch(`/api/course/settings/${courseId}`, formData, {
              headers: { "Content-Type": "multipart/form-data" },
            });
          })()
        : await ApiClient.instance.patch(`/api/course/settings/${courseId}`, data);

      return response.data;
    },
    onSuccess: (_, { courseId, data, showToast = true }) => {
      queryClient.invalidateQueries({ queryKey: getCourseSettingsQueryKey({ courseId }) });
      if (!showToast) return;
      const changedValues = Object.keys(data).filter(
        (key) => get(data, key) !== undefined,
      ) as (keyof UpdateCourseSettingsBody)[];
      const description = match(changedValues)
        .with(["lessonSequenceEnabled"], () => {
          queryClient.invalidateQueries({ queryKey: getLessonSequenceQueryKey({ courseId }) });
          return t("lessons.sequenceUpdatedSuccessfully");
        })
        .with(["quizFeedbackEnabled"], () => t("lessons.quizFeedbackUpdatedSuccessfully"))
        .with(["certificateSignature"], () =>
          t("adminCourseView.toast.certificateUpdatedSuccessfully"),
        )
        .with(["removeCertificateSignature"], () =>
          t("adminCourseView.toast.certificateUpdatedSuccessfully"),
        )
        .otherwise(() => t("lessons.settingsUpdatedSuccessfully"));
      toast({
        variant: "default",
        description,
      });
    },
    onError: (error: AxiosError, { data, showToast = true }) => {
      if (!showToast) return;
      const message = (error.response?.data as { message?: string })?.message;
      const changedValues = Object.keys(data).filter(
        (key) => get(data, key) !== undefined,
      ) as (keyof UpdateCourseSettingsBody)[];
      const description = match(changedValues)
        .with(["lessonSequenceEnabled"], () => t("lessons.sequenceUpdateFailed"))
        .with(["quizFeedbackEnabled"], () => t("lessons.quizFeedbackUpdateFailed"))
        .with(["certificateSignature"], () => t("adminCourseView.toast.certificateUpdateError"))
        .with(["removeCertificateSignature"], () =>
          t("adminCourseView.toast.certificateUpdateError"),
        )
        .otherwise(() => t("lessons.settingsUpdateFailed"));
      toast({
        variant: "destructive",
        description: message ?? description,
      });
    },
  });
}
