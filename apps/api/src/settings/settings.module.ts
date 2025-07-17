import { Module } from "@nestjs/common";

import { EmailModule } from "src/common/emails/emails.module";
import { UserService } from "src/user/user.service";

import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  imports: [EmailModule],
  controllers: [SettingsController],
  providers: [SettingsService, UserService],
})
export class SettingsModule {}
