import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetPromotionCodeResponse } from "~/api/generated-api";

export const PROMOTION_CODE_QUERY_KEY = ["promotionCode"];

export const promotionCodeByIdQueryOptions = (id: string) => {
  return {
    queryKey: [PROMOTION_CODE_QUERY_KEY, id],
    queryFn: async () => {
      const response = await ApiClient.api.stripeControllerGetPromotionCode(id);
      return response.data;
    },
    select: (response: GetPromotionCodeResponse) => response.data,
  };
};

export function usePromotionCodeById(id: string) {
  return useQuery(promotionCodeByIdQueryOptions(id));
}

export function usePromotionCodeByIdSuspense(id: string) {
  return useSuspenseQuery(promotionCodeByIdQueryOptions(id));
}
