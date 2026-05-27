import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { invalidateCertificateResetData } from "~/api/utils/invalidateCertificateResetData";
import { useToast } from "~/components/ui/use-toast";

import type { CertificateResetScope } from "@repo/shared";

type ResetCourseCertificatesBody = {
  scope: CertificateResetScope;
  groupIds?: string[];
  userIds?: string[];
  sendEmail?: boolean;
};

type ResetCourseCertificatesParams = {
  courseId: string;
  data: ResetCourseCertificatesBody;
};

export function useResetCourseCertificates() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ courseId, data }: ResetCourseCertificatesParams) => {
      const response = await ApiClient.api.certificatesControllerResetCourseCertificates(
        courseId,
        data,
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["users-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["course-settings"] });
      invalidateCertificateResetData();

      toast({
        variant: "default",
        description: t("adminCourseView.toast.certificatesResetSuccessfully", {
          count: data.affectedUserCount,
        }),
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: t("adminCourseView.toast.certificatesResetError"),
      });
    },
  });
}
