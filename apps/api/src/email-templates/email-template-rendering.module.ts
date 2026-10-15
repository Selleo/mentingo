import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";

import { EmailTemplateAssetRepository } from "./repositories/email-template-asset.repository";
import { EmailTemplateRepository } from "./repositories/email-template.repository";
import { EmailTemplateAssetService } from "./services/email-template-asset.service";
import { EmailTemplateRenderingService } from "./services/email-template-rendering.service";
import { EmailTemplateValidationService } from "./services/email-template-validation.service";
import { SampleEmailTemplateSetupService } from "./services/sample-email-template-setup.service";

@Module({
  imports: [FileModule, LocalizationModule],
  providers: [
    EmailTemplateRepository,
    EmailTemplateAssetRepository,
    EmailTemplateAssetService,
    EmailTemplateRenderingService,
    EmailTemplateValidationService,
    SampleEmailTemplateSetupService,
  ],
  exports: [
    EmailTemplateRepository,
    EmailTemplateAssetService,
    EmailTemplateRenderingService,
    EmailTemplateValidationService,
    SampleEmailTemplateSetupService,
  ],
})
export class EmailTemplateRenderingModule {}
