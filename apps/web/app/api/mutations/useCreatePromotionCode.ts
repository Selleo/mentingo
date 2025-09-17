import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { t } from "i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { PROMOTION_CODES_QUERY_KEY } from "../queries/admin/usePromotionCodes";
import { queryClient } from "../queryClient";

import type { CreatePromotionCouponBody } from "../generated-api";

export const useCreatePromotionCode = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreatePromotionCouponBody) => {
      const response = await ApiClient.api.stripeControllerCreatePromotionCoupon(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [PROMOTION_CODES_QUERY_KEY],
      });
      toast({
        description: t("adminPromotionCodesView.notifications.createdSuccessfully"),
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
