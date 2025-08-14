import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import type { UpdateHasCertificateBody } from "~/types/certificate";

type UpdateCertificateParams = {
  courseId: string;
  data: UpdateHasCertificateBody;
};

export function useUpdateHasCertificate() {
  const { t } = useTranslation();
  const { currentUser } = useCurrentUserStore();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ courseId, data }: UpdateCertificateParams) => {
      const response = await ApiClient.api.courseControllerUpdateHasCertificate(courseId, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["available-courses"] });
      toast({
        variant: "default",
        description: t("adminCourseView.toast.certificateUpdatedSuccessfully"),
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: t("adminCourseView.toast.certificateUpdateError"),
      });
    },
    meta: {
      currentUserId: currentUser?.id as string,
    },
  });
}
