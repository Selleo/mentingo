import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";

import { EmailTemplateAssetRepository } from "./repositories/email-template-asset.repository";
import { EmailTemplateRepository } from "./repositories/email-template.repository";
import { EmailTemplateAssetService } from "./services/email-template-asset.service";
import { EmailTemplateExampleService } from "./services/email-template-example.service";
import { EmailTemplateRenderingService } from "./services/email-template-rendering.service";
import { EmailTemplateValidationService } from "./services/email-template-validation.service";

@Module({
  imports: [FileModule],
  providers: [
    EmailTemplateRepository,
    EmailTemplateAssetRepository,
    EmailTemplateAssetService,
    EmailTemplateRenderingService,
    EmailTemplateValidationService,
    EmailTemplateExampleService,
  ],
  exports: [
    EmailTemplateRepository,
    EmailTemplateAssetService,
    EmailTemplateRenderingService,
    EmailTemplateValidationService,
    EmailTemplateExampleService,
  ],
})
export class EmailTemplateRenderingModule {}
