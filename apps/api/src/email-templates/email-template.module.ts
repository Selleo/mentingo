import { Module } from "@nestjs/common";

import { EmailModule } from "src/common/emails/emails.module";

import { EmailTemplateManagementController } from "./controllers/email-template-management.controller";
import { EmailTemplateRenderingModule } from "./email-template-rendering.module";
import { EmailTemplateTestWorker } from "./email-template-test.worker";
import { EmailTemplateManagementService } from "./services/email-template-management.service";
import { EmailTemplateTestDeliveryService } from "./services/email-template-test-delivery.service";

@Module({
  imports: [EmailModule, EmailTemplateRenderingModule],
  controllers: [EmailTemplateManagementController],
  providers: [
    EmailTemplateManagementService,
    EmailTemplateTestDeliveryService,
    EmailTemplateTestWorker,
  ],
  exports: [EmailTemplateManagementService],
})
export class EmailTemplateModule {}
