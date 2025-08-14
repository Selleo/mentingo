import { useNavigate } from "@remix-run/react";
import { Elements } from "@stripe/react-stripe-js";
import { useTranslation } from "react-i18next";

import { useStripePaymentIntent } from "~/api/mutations/useStripePaymentIntent";
import { currentUserQueryOptions, useCurrentUser } from "~/api/queries/useCurrentUser";
import { queryClient } from "~/api/queryClient";
import { Enroll } from "~/assets/svgs";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";
import { formatPrice } from "~/lib/formatters/priceFormatter";

import { useStripePromise } from "./hooks/useStripePromise";
import { PaymentForm } from "./PaymentForm";

import type { Appearance } from "@stripe/stripe-js";

export const clientLoader = async () => {
  await queryClient.prefetchQuery(currentUserQueryOptions);
  return null;
};

type PaymentModalProps = {
  coursePrice: number;
  courseCurrency: string;
  courseTitle: string;
  courseId: string;
};

const appearance: Appearance = {
  theme: "stripe",
  variables: {},
  rules: {},
};

export function PaymentModal({ coursePrice, courseCurrency, courseId }: PaymentModalProps) {
  const { data: currentUser } = useCurrentUser();
  const stripePromise = useStripePromise();
  const { clientSecret, createPaymentIntent, resetClientSecret } = useStripePaymentIntent();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handlePayment = async () => {
    if (!currentUser) {
      return navigate("/auth/register");
    }

    try {
      await createPaymentIntent({
        amount: coursePrice,
        currency: courseCurrency,
        customerId: currentUser?.id ?? "",
        courseId,
      });
    } catch (error) {
      console.error("Error creating payment intent:", error);
    }
  };

  const handlePaymentSuccess = async () => {
    resetClientSecret();
    toast({
      description: t("paymentView.toast.successful"),
    });
  };

  return (
    <>
      <Button onClick={handlePayment} className="gap-x-2" variant="primary">
        <Enroll />
        <span>
          {" "}
          {t("paymentView.other.enrollCourse")} - {formatPrice(coursePrice, courseCurrency)}
        </span>
      </Button>

      {clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
          <PaymentForm
            currency={courseCurrency}
            courseId={courseId}
            price={coursePrice}
            onPaymentSuccess={handlePaymentSuccess}
          />
        </Elements>
      )}
    </>
  );
}
