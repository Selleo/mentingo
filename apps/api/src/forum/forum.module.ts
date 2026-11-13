import { Module } from "@nestjs/common";

import { CourseChatModule } from "src/course-chat/course-chat.module";
import { ForumController } from "src/forum/forum.controller";
import { ForumRepository } from "src/forum/forum.repository";
import { ForumService } from "src/forum/forum.service";
import { LocalizationModule } from "src/localization/localization.module";
import { SettingsModule } from "src/settings/settings.module";

@Module({
  imports: [CourseChatModule, LocalizationModule, SettingsModule],
  controllers: [ForumController],
  providers: [ForumService, ForumRepository],
})
export class ForumModule {}
