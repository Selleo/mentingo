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
      allowPromotionCode = false,
      quantity = 1,
      courseId,
      customerId,
      locale,
      priceId,
    } = body;

    const finalLocale: SupportedLocales = isSupportedLocale(locale) ? locale : "en";

    const session = await this.client.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
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

  async createProduct(
    data: Stripe.ProductCreateParams & { amountInCents: number; currency: string },
  ) {
    const product = await this.client.products.create({
      name: data?.name,
      description: data?.description,
    });

    const price = await this.createPrice({
      product: product.id,
      unit_amount: data.amountInCents,
      currency: data.currency,
    });

    return {
      productId: product.id,
      priceId: price.id,
    };
  }

  async searchProducts(params: Stripe.ProductSearchParams) {
    const products = await this.client.products.search(params);
    return products;
  }

  async searchPrices(params: Stripe.PriceSearchParams) {
    const prices = await this.client.prices.search(params);
    return prices;
  }

  async createPrice(data: Stripe.PriceCreateParams) {
    const price = await this.client.prices.create(data);
    return price;
  }

  async updateProduct(id: string, data: Stripe.ProductUpdateParams) {
    const product = await this.client.products.update(id, data);
    return product;
  }

  async updatePrice(id: string, data: Stripe.PriceUpdateParams) {
    const price = await this.client.prices.update(id, data);
    return price;
  }

  async getCoupon(id: string) {
    const coupon = await this.client.coupons.retrieve(id);
    return coupon;
  }

  async getPromotionCodes() {
    const promotionCodes = await this.client.promotionCodes.list();
    return promotionCodes?.data?.map(this.promotionCodeToCamelCase) ?? [];
  }

  async getPromotionCode(id: string) {
    const promotionCode = await this.client.promotionCodes.retrieve(id, {
      expand: ["coupon.applies_to"],
    });

    return this.promotionCodeToCamelCase(promotionCode);
  }

  async createPromotionCode(body: CreatePromotionCode) {
    const {
      amountOff,
      percentOff,
      maxRedemptions,
      code,
      assignedStripeCourseIds,
      currency,
      expiresAt,
    } = body;

    if (amountOff && percentOff) {
      throw new BadRequestException("You can't use both amount_off and percent_off");
    }

    try {
      const coupon = await this.client.coupons.create({
        amount_off: amountOff,
        percent_off: percentOff,
        applies_to: { products: assignedStripeCourseIds },
        currency: currency ?? "usd",
      });
      const stripeExpiresAt = Math.floor(new Date(expiresAt as string).getTime() / 1000);

      await this.client.promotionCodes.create({
        coupon: coupon.id,
        code,
        expires_at: expiresAt ? stripeExpiresAt : undefined,
        max_redemptions: maxRedemptions,
      });

      return "Promotion code created successfully";
    } catch (error) {
      if (error.raw.message) {
        throw new InternalServerErrorException(error.raw.message);
      }
      throw new InternalServerErrorException("Failed to create coupon");
    }
  }

  async updatePromotionCode(id: string, body: UpdatePromotionCode) {
    const { active } = body;

    const updatePromotionCodeData = {
      ...(active !== undefined && { active }),
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
      if (error.raw.message) {
        throw new InternalServerErrorException(error.raw.message);
      }
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
        maxRedemptions: promotionCode.coupon.max_redemptions,
        metadata: promotionCode.coupon.metadata,
        name: promotionCode.coupon.name,
        redeemBy: promotionCode.coupon.redeem_by,
        timesRedeemed: promotionCode.coupon.times_redeemed,
        valid: promotionCode.coupon.valid,
        appliesTo: promotionCode?.coupon?.applies_to?.products ?? [],
      },
      created: promotionCode.created,
      customer: promotionCode.customer,
      expiresAt: promotionCode.expires_at,
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
