import {
  InjectStripeClient,
  InjectStripeModuleConfig,
  StripeModuleConfig,
} from "@golevelup/nestjs-stripe";
import { Controller, Post, Query, Headers, Req, Get, Patch, Param, Body } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";
import Stripe from "stripe";

import { BaseResponse, baseResponse, UUIDType } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { Roles } from "src/common/decorators/roles.decorator";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { checkoutSessionSchema, CreateCheckoutSessionBody } from "./schemas/checkoutSession.schema";
import { CreatePromotionCode, createPromotionCodeSchema } from "./schemas/createPromotionCode";
import { paymentIntentSchema } from "./schemas/payment";
import { promotionCodeSchema } from "./schemas/promotionCode.schema";
import {
  UpdatePromotionCode,
  updatePromotionCodeSchema,
} from "./schemas/updatePromotionCode.schema";
import { StripeService } from "./stripe.service";
import { StripeWebhookHandler } from "./stripeWebhook.handler";

interface RequestWithRawBody extends Request {
  rawBody?: string;
}

@Controller("stripe")
export class StripeController {
  private readonly requestBodyProperty: string;

  constructor(
    @InjectStripeModuleConfig()
    config: StripeModuleConfig,
    @InjectStripeClient() private readonly stripeClient: Stripe,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    private readonly stripeWebhookHandler: StripeWebhookHandler,
  ) {
    this.requestBodyProperty = config.webhookConfig?.requestBodyProperty || "body";
  }

  @Post()
  @Roles(USER_ROLES.STUDENT)
  @Validate({
    response: baseResponse(paymentIntentSchema),
    request: [
      {
        type: "query",
        name: "amount",
        schema: Type.Number(),
        required: true,
      },
      {
        type: "query",
        name: "currency",
        schema: Type.String(),
        required: true,
      },
      {
        type: "query",
        name: "customerId",
        schema: Type.String(),
        required: true,
      },
      {
        type: "query",
        name: "courseId",
        schema: Type.String(),
        required: true,
      },
    ],
  })
  async createPaymentIntent(
    @Query("amount") amount: number,
    @Query("currency") currency: string,
    @Query("customerId") customerId: UUIDType,
    @Query("courseId") courseId: UUIDType,
  ) {
    return new BaseResponse({
      clientSecret: await this.stripeService.payment(amount, currency, customerId, courseId),
    });
  }

  @Post("checkout-session")
  @Roles(USER_ROLES.STUDENT)
  @Validate({
    response: baseResponse(Type.Object({ clientSecret: Type.String() })),
    request: [{ type: "body", schema: checkoutSessionSchema }],
  })
  async createCheckoutSession(@Body() body: CreateCheckoutSessionBody) {
    return new BaseResponse(await this.stripeService.createCheckoutSession(body));
  }

  @Public()
  @Post("webhook")
  async handleWebhook(
    @Headers("stripe-signature") sig: string,
    @Req() request: RequestWithRawBody,
  ) {
    try {
      if (!sig) {
        throw new Error("Missing stripe-signature header");
      }
      const rawBody = request.rawBody;
      if (!rawBody) {
        throw new Error("Missing raw body");
      }
      const rawBodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);

      const event = this.stripeClient.webhooks.constructEvent(
        rawBodyBuffer,
        sig,
        this.configService.get<string>("stripe.webhookSecret") || "",
      );

      if (event.type === "payment_intent.succeeded") {
        await this.stripeWebhookHandler.handlePaymentIntentSucceeded(event);
      } else {
        console.log(`Unhandled event type: ${event.type}`);
      }

      return new BaseResponse({
        clientSecret: 22,
      });
    } catch (err) {
      console.error("Error processing webhook:", err);
      return new BaseResponse({
        clientSecret: 22,
      });
    }
  }

  @Get("promotion-codes")
  @Validate({
    response: baseResponse(Type.Array(promotionCodeSchema)),
  })
  @Roles(USER_ROLES.ADMIN)
  async getPromotionCodes() {
    return new BaseResponse(await this.stripeService.getPromotionCodes());
  }

  @Public()
  @Get("promotion-code/:id")
  @Validate({
    response: baseResponse(promotionCodeSchema),
  })
  @Roles(USER_ROLES.ADMIN)
  async getPromotionCode(@Param("id") id: string) {
    return new BaseResponse(await this.stripeService.getPromotionCode(id));
  }

  @Post("promotion-code")
  @Validate({
    response: baseResponse(Type.String()),
    request: [{ type: "body", schema: createPromotionCodeSchema }],
  })
  @Roles(USER_ROLES.ADMIN)
  async createPromotionCoupon(
    @Body()
    body: CreatePromotionCode,
  ) {
    return new BaseResponse(await this.stripeService.createPromotionCode(body));
  }

  @Patch("promotion-code/:id")
  @Validate({
    response: baseResponse(promotionCodeSchema),
    request: [
      {
        type: "param",
        name: "id",
        schema: Type.String(),
      },
      {
        type: "body",
        schema: updatePromotionCodeSchema,
      },
    ],
  })
  @Roles(USER_ROLES.ADMIN)
  async updatePromotionCode(@Param("code") id: string, @Body() body: UpdatePromotionCode) {
    return new BaseResponse(await this.stripeService.updatePromotionCode(id, body));
  }
}
