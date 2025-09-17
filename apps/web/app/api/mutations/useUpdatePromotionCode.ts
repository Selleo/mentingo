import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { PROMOTION_CODE_QUERY_KEY } from "../queries/admin/usePromotionCodeById";
import { queryClient } from "../queryClient";

export type UpdatePromotionCode = {
  id: string;
  data: {
    active?: boolean;
    assignedCourseIds?: string[];
  };
};

export const useUpdatePromotionCode = () => {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: UpdatePromotionCode) => {
      const response = await ApiClient.api.stripeControllerUpdatePromotionCode(
        options.id,
        options.data,
      );

      return response.data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: [PROMOTION_CODE_QUERY_KEY, data?.data?.id],
      });
      toast({
        description: t("adminPromotionCodesView.notifications.updatedSuccessfully"),
      });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          description: error.response?.data.message,
          variant: "destructive",
        });
      }
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
