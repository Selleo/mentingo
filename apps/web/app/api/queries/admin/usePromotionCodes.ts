import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const PROMOTION_CODES_QUERY_KEY = "promotionCode";

export const promotionCodesQuery = () => {
  return {
    queryKey: [PROMOTION_CODES_QUERY_KEY],
    queryFn: async () => {
      const { data } = await ApiClient.api.stripeControllerGetPromotionCodes();

      return data;
    },
  };
};

export function usePromotionCodesQuery() {
  return useQuery(promotionCodesQuery());
}

export const usePromotionCodesQuerySuspense = () => {
  return useSuspenseQuery(promotionCodesQuery());
};
