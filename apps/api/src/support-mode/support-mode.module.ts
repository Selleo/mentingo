import { Global, Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";

import { SupportModeExpiredSessionsCron } from "./support-mode-expired-sessions.cron";
import { SupportModeRepository } from "./support-mode.repository";
import { SupportModeService } from "./support-mode.service";

@Global()
@Module({
  imports: [FileModule],
  providers: [SupportModeRepository, SupportModeService, SupportModeExpiredSessionsCron],
  exports: [SupportModeService],
})
export class SupportModeModule {}
