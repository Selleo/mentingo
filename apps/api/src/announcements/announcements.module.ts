import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { PermissionsModule } from "src/permissions/permissions.module";
import { UserModule } from "src/user/user.module";

import { AnnouncementsController } from "./announcements.controller";
import { AnnouncementsRepository } from "./announcements.repository";
import { AnnouncementsService } from "./announcements.service";

@Module({
  imports: [CqrsModule, UserModule, PermissionsModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService, AnnouncementsRepository],
})
export class AnnouncementsModule {}
