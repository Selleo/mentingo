import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { courseQueryOptions } from "~/api/queries";
import { useCurrentUserSessionSuspense } from "~/api/queries/useCurrentUserSessionSuspense";
import { queryClient } from "~/api/queryClient";
import { Enroll } from "~/assets/svgs";
import { Button } from "~/components/ui/button";
import { formatPrice } from "~/lib/formatters/priceFormatter";
import { getCurrencyLocale } from "~/utils/getCurrencyLocale";

import { useLanguageStore } from "../Dashboard/Settings/Language/LanguageStore";

import { useStripePromise } from "./hooks/useStripePromise";

type PaymentModalProps = {
  coursePrice: number;
  courseCurrency: string;
  courseTitle: string;
  courseDescription: string;
  courseId: string;
  coursePriceId: string;
};

export function PaymentModal({
  coursePrice,
  courseCurrency,
  courseId,
  courseTitle,
  courseDescription,
  coursePriceId,
}: PaymentModalProps) {
  const { data: currentUser } = useCurrentUserSessionSuspense();
  const [showCheckout, setShowCheckout] = useState(false);
  const stripePromise = useStripePromise();
  const { t } = useTranslation();
  const { language } = useLanguageStore();

  const fetchClientSecret = async () => {
    const response = await ApiClient.api.stripeControllerCreateCheckoutSession({
      amountInCents: coursePrice,
      allowPromotionCode: true,
      productName: courseTitle,
      productDescription: courseDescription,
      courseId: courseId,
      customerId: currentUser?.id as string,
      locale: language,
      priceId: coursePriceId,
    });

    return response.data.data.clientSecret;
  };

  const handleEnrollCourse = () => setShowCheckout(true);

  const handleCheckoutChange = () => queryClient.invalidateQueries(courseQueryOptions(courseId));

  return (
    <>
      {!showCheckout ? (
        <Button onClick={handleEnrollCourse} className="gap-x-2" variant="primary">
          <Enroll />
          <span>
            {" "}
            {t("paymentView.other.enrollCourse")} -{" "}
            {formatPrice(coursePrice, courseCurrency, getCurrencyLocale(courseCurrency))}
          </span>
        </Button>
      ) : (
        <EmbeddedCheckoutProvider
          stripe={stripePromise}
          options={{
            fetchClientSecret,
            onComplete: handleCheckoutChange,
          }}
        >
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      )}
    </>
  );
}
