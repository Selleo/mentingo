import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const PROMOTION_CODES_QUERY_KEY = "promotionCode";

export const promotionCodesQuery = (isStripeConfigured?: boolean) => {
  return {
    enabled: isStripeConfigured,
    queryKey: [PROMOTION_CODES_QUERY_KEY],
    queryFn: async () => {
      const { data } = await ApiClient.api.stripeControllerGetPromotionCodes();

      return data;
    },
  };
};

export function usePromotionCodesQuery(isStripeConfigured?: boolean) {
  return useQuery(promotionCodesQuery(isStripeConfigured));
}

export const usePromotionCodesQuerySuspense = (isStripeConfigured?: boolean) => {
  return useSuspenseQuery(promotionCodesQuery(isStripeConfigured));
};
