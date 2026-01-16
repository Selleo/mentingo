import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";
import { SettingsModule } from "src/settings/settings.module";

import { NewsController } from "./news.controller";
import { NewsService } from "./news.service";

@Module({
  exports: [NewsModule],
  imports: [LocalizationModule, FileModule, SettingsModule],
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule {}
