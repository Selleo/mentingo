import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import Stripe from "stripe";

import { isSupportedLocale } from "src/utils/isSupportedLocale";

import type { CreateCheckoutSessionBody } from "./schemas/checkoutSession.schema";
import type { CreatePromotionCode } from "./schemas/createPromotionCode";
import type { PromotionCode } from "./schemas/promotionCode.schema";
import type { UpdatePromotionCode } from "./schemas/updatePromotionCode.schema";
import type { UUIDType } from "src/common";
import type { SupportedLocales } from "src/common/types";

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

  async createCheckoutSession(body: CreateCheckoutSessionBody) {
    const {
      amountInCents,
      currency = "usd",
      allowPromotionCode = false,
      quantity = 1,
      productName,
      productDescription = "",
      courseId,
      customerId,
      locale,
    } = body;

    const finalLocale: SupportedLocales = isSupportedLocale(locale) ? locale : "en";

    const session = await this.client.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: amountInCents,
            product_data: {
              name: productName,
              description: productDescription,
            },
          },
          quantity,
        },
      ],
      mode: "payment",
      ui_mode: "embedded",
      allow_promotion_codes: allowPromotionCode,
      redirect_on_completion: "never",
      locale: finalLocale,
      payment_intent_data: {
        metadata: {
          courseId,
          customerId,
        },
      },
    });

    return { clientSecret: session.client_secret };
  }

  async getPromotionCodes() {
    const promotionCodes = await this.client.promotionCodes.list();

    return promotionCodes?.data?.map(this.promotionCodeToCamelCase) ?? [];
  }

  async getPromotionCode(id: string) {
    const promotionCode = await this.client.promotionCodes.retrieve(id);

    return this.promotionCodeToCamelCase(promotionCode);
  }

  async createPromotionCode(body: CreatePromotionCode) {
    const { amountOff, percentOff, maxRedemptions, code, assignedCourseIds, currency, expiresAt } =
      body;

    if (amountOff && percentOff) {
      throw new BadRequestException("You can't use both amount_off and percent_off");
    }
    try {
      const coupon = await this.client.coupons.create({
        amount_off: amountOff,
        percent_off: percentOff,
        currency: currency ?? "usd",
      });
      const stripeExpiresAt = Math.floor(new Date(expiresAt as string).getTime() / 1000);

      await this.client.promotionCodes.create({
        coupon: coupon.id,
        code,
        expires_at: expiresAt ? stripeExpiresAt : undefined,
        max_redemptions: maxRedemptions,
        metadata: {
          assignedCourseIds: assignedCourseIds ? assignedCourseIds?.join(",") : null,
        },
      });

      return "Promotion code created successfully";
    } catch (error) {
      throw new InternalServerErrorException("Failed to create coupon");
    }
  }

  async updatePromotionCode(id: string, body: UpdatePromotionCode) {
    const { active, assignedCourseIds } = body;

    const updatePromotionCodeData = {
      ...(active !== undefined && { active }),
      ...(assignedCourseIds && { metadata: { assignedCourseIds: assignedCourseIds?.join(",") } }),
    };

    const promotionCode = await this.client.promotionCodes.retrieve(id);

    if (!promotionCode) {
      throw new BadRequestException("Invalid promotion code");
    }

    try {
      const promoCode = await this.client.promotionCodes.update(
        promotionCode.id,
        updatePromotionCodeData,
      );
      return this.promotionCodeToCamelCase(promoCode);
    } catch (error) {
      throw new InternalServerErrorException("Failed to update coupon");
    }
  }

  promotionCodeToCamelCase(promotionCode: any): PromotionCode {
    return {
      id: promotionCode.id,
      active: promotionCode.active,
      code: promotionCode.code,
      coupon: {
        id: promotionCode.coupon.id,
        amountOff: promotionCode.coupon.amount_off,
        percentOff: promotionCode.coupon.percent_off,
        created: promotionCode.coupon.created,
        currency: promotionCode.coupon.currency,
        duration: promotionCode.coupon.duration,
        durationInMonths: promotionCode.coupon.duration_in_months,
        livemode: promotionCode.coupon.livemode,
        maxRedemptions: promotionCode.coupon.max_redemptions,
        metadata: promotionCode.coupon.metadata,
        name: promotionCode.coupon.name,
        redeemBy: promotionCode.coupon.redeem_by,
        timesRedeemed: promotionCode.coupon.times_redeemed,
        valid: promotionCode.coupon.valid,
      },
      created: promotionCode.created,
      customer: promotionCode.customer,
      expiresAt: promotionCode.expires_at,
      livemode: promotionCode.livemode,
      maxRedemptions: promotionCode.max_redemptions,
      metadata: promotionCode.metadata,
      restrictions: {
        firstTimeTransaction: promotionCode.restrictions.first_time_transaction,
        minimumAmount: promotionCode.restrictions.minimum_amount,
        minimumAmountCurrency: promotionCode.restrictions.minimum_amount_currency,
      },
      timesRedeemed: promotionCode.times_redeemed,
    };
  }
}
