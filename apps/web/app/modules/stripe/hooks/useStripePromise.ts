import { loadStripe } from "@stripe/stripe-js";
import { useMemo } from "react";

import { stripePublishableKeyQueryOptions } from "~/api/queries/useStripePublishableKey";
import { queryClient } from "~/api/queryClient";

export const useStripePromise = () => {
  const stripePromise = useMemo(async () => {
    try {
      const {
        data: { publishableKey },
      } = await queryClient.fetchQuery(stripePublishableKeyQueryOptions());

      return loadStripe((publishableKey || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) ?? "");
    } catch {
      return Promise.resolve(null);
    }
  }, []);

  return stripePromise;
};
