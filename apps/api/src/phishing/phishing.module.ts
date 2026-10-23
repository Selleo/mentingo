import { Module } from "@nestjs/common";

import { EmailModule } from "src/common/emails/emails.module";
import { CourseModule } from "src/courses/course.module";
import { LocalizationService } from "src/localization/localization.service";
import { SettingsModule } from "src/settings/settings.module";

import { PhishingClientService } from "./phishing-client.service";
import { PhishingEmailController } from "./phishing-email.controller";
import { PhishingEmailService } from "./phishing-email.service";
import { PhishingWebhookController } from "./phishing-webhook.controller";
import { PhishingController } from "./phishing.controller";
import { PhishingRepository } from "./phishing.repository";
import { PhishingService } from "./phishing.service";
@Module({
  imports: [CourseModule, EmailModule, SettingsModule],
  controllers: [PhishingController, PhishingWebhookController, PhishingEmailController],
  providers: [
    PhishingClientService,
    PhishingRepository,
    PhishingService,
    PhishingEmailService,
    LocalizationService,
  ],
})
export class PhishingModule {}
