import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Loader } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { courseQueryOptions } from "~/api/queries/useCourse";
import { queryClient } from "~/api/queryClient";
import { Button } from "~/components/ui/button";
import { formatPrice } from "~/lib/formatters/priceFormatter";
import { getCurrencyLocale } from "~/utils/getCurrencyLocale";

type PaymentForm = {
  courseId: string;
  price: number;
  currency: string;
  onPaymentSuccess: () => void;
};

export const PaymentForm = ({ price, currency, onPaymentSuccess, courseId }: PaymentForm) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string>();
  const [processing, setProcessing] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (result.error) {
      setError(result.error.message);
      setProcessing(false);
    } else if (result.paymentIntent && result.paymentIntent.status === "succeeded") {
      setTimeout(() => {
        queryClient.invalidateQueries(courseQueryOptions(courseId));
        setProcessing(false);
        onPaymentSuccess();
      }, 4000);
    } else {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <Button
        disabled={!stripe || processing}
        className="w-full rounded-lg bg-secondary-500 py-2 text-white"
      >
        {processing ? (
          <Loader className="animate-spin" />
        ) : (
          `${t("paymentView.other.buyFor")} ${formatPrice(price, currency, getCurrencyLocale(currency))}`
        )}
      </Button>
      {error && (
        <div className="rounded-sm border border-destructive px-2 py-1 text-sm text-destructive">
          {error}
        </div>
      )}
    </form>
  );
};
