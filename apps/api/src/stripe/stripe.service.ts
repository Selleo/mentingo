import { Injectable, InternalServerErrorException } from "@nestjs/common";
import Stripe from "stripe";

import type { UUIDType } from "src/common";

@Injectable()
export class StripeService {
  private stripeClient: Stripe | null;

  constructor() {
    const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = process.env;

    if (STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET) {
      this.stripeClient = new Stripe(STRIPE_SECRET_KEY);
    } else {
      this.stripeClient = null;
    }
  }

  get client(): Stripe {
    if (!this.stripeClient) {
      throw new InternalServerErrorException("Stripe is not configured");
    }
    return this.stripeClient;
  }

  async payment(amount: number, currency: string, customerId: UUIDType, courseId: UUIDType) {
    const { client_secret } = await this.client.paymentIntents.create({
      amount,
      currency,
      metadata: {
        courseId,
        customerId,
      },
    });

    return client_secret;
  }
}
