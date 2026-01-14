import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { invalidateCourseOwnershipData } from "~/api/utils/invalidateCourseOwnershipData";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "~/api/types";

export type TransferCourseOwnershipOptions = {
  courseId: string;
  userId: string;
};

export function useTransferCourseOwnership() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: TransferCourseOwnershipOptions) => {
      const response = await ApiClient.api.courseControllerTransferCourseOwnership(options);

      return response.data;
    },
    onSuccess: async () => {
      toast({ description: t("adminCourseView.toast.successfullyTransferredCourseOwnership") });

      await invalidateCourseOwnershipData();
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;

      toast({ description: t(message), variant: "destructive" });
    },
  });
}
