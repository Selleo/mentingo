import { Module } from "@nestjs/common";

import { EmailModule } from "src/common/emails/emails.module";
import { CourseModule } from "src/courses/course.module";
import { LocalizationService } from "src/localization/localization.service";
import { SettingsModule } from "src/settings/settings.module";

import { PhishingEmailController } from "./controllers/phishing-email.controller";
import { PhishingWebhookController } from "./controllers/phishing-webhook.controller";
import { PhishingController } from "./controllers/phishing.controller";
import { PhishingRepository } from "./repositories/phishing.repository";
import { PhishingClientService } from "./services/phishing-client.service";
import { PhishingEmailService } from "./services/phishing-email.service";
import { PhishingEnrollmentService } from "./services/phishing-enrollment.service";
import { PhishingService } from "./services/phishing.service";

@Module({
  imports: [CourseModule, EmailModule, SettingsModule],
  controllers: [PhishingController, PhishingWebhookController, PhishingEmailController],
  providers: [
    PhishingClientService,
    PhishingRepository,
    PhishingService,
    PhishingEmailService,
    PhishingEnrollmentService,
    LocalizationService,
  ],
})
export class PhishingModule {}
