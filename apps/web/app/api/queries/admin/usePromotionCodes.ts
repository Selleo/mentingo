import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const PROMOTION_CODES_QUERY_KEY = "promotionCode";

export type PromotionCodesParams = NonNullable<
  Parameters<typeof ApiClient.api.stripeControllerGetPromotionCodes>[0]
>;

export const promotionCodesQuery = (params: PromotionCodesParams, isStripeConfigured?: boolean) => {
  return {
    enabled: isStripeConfigured,
    queryKey: [PROMOTION_CODES_QUERY_KEY, params],
    queryFn: async () => {
      const { data } = await ApiClient.api.stripeControllerGetPromotionCodes(params);

      return data;
    },
  };
};

export function usePromotionCodesQuery(params: PromotionCodesParams, isStripeConfigured?: boolean) {
  return useQuery({
    ...promotionCodesQuery(params, isStripeConfigured),
    placeholderData: keepPreviousData,
  });
}

export const usePromotionCodesQuerySuspense = (
  params: PromotionCodesParams,
  isStripeConfigured?: boolean,
) => {
  return useSuspenseQuery(promotionCodesQuery(params, isStripeConfigured));
};
