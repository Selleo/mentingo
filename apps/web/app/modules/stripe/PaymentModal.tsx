import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { courseQueryOptions } from "~/api/queries";
import { currentUserQueryOptions, useCurrentUser } from "~/api/queries/useCurrentUser";
import { queryClient } from "~/api/queryClient";
import { Enroll } from "~/assets/svgs";
import { Button } from "~/components/ui/button";
import { formatPrice } from "~/lib/formatters/priceFormatter";

import { useStripePromise } from "./hooks/useStripePromise";

export const clientLoader = async () => {
  await queryClient.prefetchQuery(currentUserQueryOptions);
  return null;
};

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
  const { data: currentUser } = useCurrentUser();
  const [showCheckout, setShowCheckout] = useState(false);
  const stripePromise = useStripePromise();
  const { t, i18n } = useTranslation();

  const fetchClientSecret = async () => {
    const response = await ApiClient.api.stripeControllerCreateCheckoutSession({
      amountInCents: coursePrice,
      allowPromotionCode: true,
      productName: courseTitle,
      productDescription: courseDescription,
      courseId: courseId,
      customerId: currentUser?.id as string,
      locale: i18n.language,
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
            {t("paymentView.other.enrollCourse")} - {formatPrice(coursePrice, courseCurrency)}
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
