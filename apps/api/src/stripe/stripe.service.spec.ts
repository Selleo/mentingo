import { BadRequestException } from "@nestjs/common";

import { StripeService } from "./stripe.service";

import type { DatabasePg } from "src/common";
import type { EnvService } from "src/env/services/env.service";
import type Stripe from "stripe";

describe("StripeService archived course checkout", () => {
  const courseId = "00000000-0000-4000-8000-000000000001";
  const customerId = "00000000-0000-4000-8000-000000000002";

  const createService = (course: { isArchived: boolean } | undefined) => {
    const where = jest.fn().mockResolvedValue(course ? [course] : []);
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });
    const service = new StripeService({} as EnvService, { select } as unknown as DatabasePg);
    const paymentIntentCreate = jest.fn().mockResolvedValue({ client_secret: "payment-secret" });
    const checkoutCreate = jest.fn().mockResolvedValue({ client_secret: "checkout-secret" });
    const getClient = jest.spyOn(service, "getClient").mockResolvedValue({
      paymentIntents: { create: paymentIntentCreate },
      checkout: { sessions: { create: checkoutCreate } },
    } as unknown as Stripe);

    return { service, select, getClient, paymentIntentCreate, checkoutCreate };
  };

  const operations = [
    {
      name: "payment intent",
      run: (service: StripeService) => service.payment(1000, "usd", customerId, courseId),
      result: "payment-secret",
      stripeCall: "paymentIntentCreate" as const,
    },
    {
      name: "checkout session",
      run: (service: StripeService) =>
        service.createCheckoutSession({
          amountInCents: 1000,
          productName: "Course",
          courseId,
          customerId,
          locale: "en",
          priceId: "price_123",
        }),
      result: { clientSecret: "checkout-secret" },
      stripeCall: "checkoutCreate" as const,
    },
  ];

  describe.each(operations)("$name", ({ run, result, stripeCall }) => {
    it.each([undefined, { isArchived: true }])(
      "rejects a missing or archived course before contacting Stripe: %p",
      async (course) => {
        const { service, getClient, paymentIntentCreate, checkoutCreate } = createService(course);

        await expect(run(service)).rejects.toThrow(
          new BadRequestException("adminCourseView.errors.forbidden.archivedCourseEnrollment"),
        );
        expect(getClient).not.toHaveBeenCalled();
        expect(paymentIntentCreate).not.toHaveBeenCalled();
        expect(checkoutCreate).not.toHaveBeenCalled();
      },
    );

    it("allows an active course to proceed", async () => {
      const context = createService({ isArchived: false });

      await expect(run(context.service)).resolves.toEqual(result);
      expect(context[stripeCall]).toHaveBeenCalledTimes(1);
    });
  });
});
