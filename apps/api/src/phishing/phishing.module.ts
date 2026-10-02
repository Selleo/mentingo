import { Module } from "@nestjs/common";

import { CourseModule } from "src/courses/course.module";
import { LocalizationService } from "src/localization/localization.service";

import { PhishingClientService } from "./phishing-client.service";
import { PhishingWebhookController } from "./phishing-webhook.controller";
import { PhishingController } from "./phishing.controller";
import { PhishingRepository } from "./phishing.repository";
import { PhishingService } from "./phishing.service";
@Module({
  imports: [CourseModule],
  controllers: [PhishingController, PhishingWebhookController],
  providers: [PhishingClientService, PhishingRepository, PhishingService, LocalizationService],
})
export class PhishingModule {}
