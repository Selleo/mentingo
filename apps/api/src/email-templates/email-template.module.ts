import { Module } from "@nestjs/common";

import { EmailModule } from "src/common/emails/emails.module";

import { EmailTemplateController } from "./controllers/email-template.controller";
import { EmailTemplateRenderingModule } from "./email-template-rendering.module";
import { EmailTemplateTestWorker } from "./email-template-test.worker";
import { EmailTemplateTestService } from "./services/email-template-test.service";
import { EmailTemplateService } from "./services/email-template.service";

@Module({
  imports: [EmailModule, EmailTemplateRenderingModule],
  controllers: [EmailTemplateController],
  providers: [EmailTemplateService, EmailTemplateTestService, EmailTemplateTestWorker],
  exports: [EmailTemplateService],
})
export class EmailTemplateModule {}
