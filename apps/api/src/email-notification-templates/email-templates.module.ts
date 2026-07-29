import { Module } from "@nestjs/common";

import { EmailModule } from "src/common/emails/emails.module";
import { FileModule } from "src/file/files.module";
import { PermissionsModule } from "src/permissions/permissions.module";
import { SettingsModule } from "src/settings/settings.module";

import { EmailTemplateCleanupQueueService } from "./email-template-cleanup.queue.service";
import { EmailTemplateCleanupWorker } from "./email-template-cleanup.worker";
import { EmailTemplateImageController } from "./email-template-image.controller";
import { EmailTemplateImageService } from "./email-template-image.service";
import { EmailNotificationTemplatesController } from "./email-templates.controller";
import { EmailNotificationTemplatesRepository } from "./email-templates.repository";
import { EmailNotificationTemplatesService } from "./email-templates.service";

@Module({
  imports: [PermissionsModule, FileModule, EmailModule, SettingsModule],
  controllers: [EmailNotificationTemplatesController, EmailTemplateImageController],
  providers: [
    EmailNotificationTemplatesService,
    EmailNotificationTemplatesRepository,
    EmailTemplateImageService,
    EmailTemplateCleanupQueueService,
    EmailTemplateCleanupWorker,
  ],
  exports: [EmailNotificationTemplatesService],
})
export class EmailNotificationTemplatesModule {}
