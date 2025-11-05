import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetStripePublishableKeyResponse } from "../generated-api";

export const STRIPE_PUBLISHABLE_KEY_QUERY_KEY = ["env", "stripe", "publishableKey"];

export const stripePublishableKeyQueryOptions = () => {
  return {
    queryKey: STRIPE_PUBLISHABLE_KEY_QUERY_KEY,
    queryFn: async () => {
      const response = await ApiClient.api.envControllerGetStripePublishableKey();

      return response.data;
    },
    select: (data: GetStripePublishableKeyResponse) => data.data,
  };
};

export function useStripePublishableKey() {
  return useQuery(stripePublishableKeyQueryOptions());
}
