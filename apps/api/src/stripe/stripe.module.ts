import { StripeModule as StripeModuleConfig, StripeWebhookService } from "@golevelup/nestjs-stripe";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CourseModule } from "src/courses/course.module";

import { StripeController } from "./stripe.controller";
import { StripeService } from "./stripe.service";
import { StripeWebhookHandler } from "./stripeWebhook.handler";

@Module({
  imports: [
    StripeModuleConfig.forRootAsync(StripeModuleConfig, {
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        /**
         * This Stripe module is **optional**. It initializes using `STRIPE_SECRET_KEY`
         * and `STRIPE_WEBHOOK_SECRET` from environment variables.
         *
         * If these keys are not provided, the module will initialize with
         * fallback "empty" values. In this scenario, `StripeService` will be
         * instantiated with a `null` Stripe client, preventing startup errors and
         * allowing the application to run without active Stripe integration.
         */
        return {
          apiKey: configService.get<string>("stripe.secretKey") || "empty",
          webhookConfig: {
            stripeSecrets: {
              account: configService.get<string>("stripe.webhookSecret") || "empty",
            },
            loggingConfiguration: {
              logMatchingEventHandlers: true,
            },
            requestBodyProperty: "rawBody",
          },
        };
      },
    }),
    CourseModule,
  ],
  controllers: [StripeController],
  providers: [StripeService, StripeWebhookHandler, StripeWebhookService],
  exports: [],
})
export class StripeModule {}
