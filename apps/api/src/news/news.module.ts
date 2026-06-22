import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { SearchIndexModule } from "src/global-search/search-index.module";
import { LocalizationModule } from "src/localization/localization.module";
import { ResourceLibraryModule } from "src/resource-library/resource-library.module";
import { SettingsModule } from "src/settings/settings.module";

import { NewsController } from "./news.controller";
import { NewsService } from "./news.service";

@Module({
  exports: [NewsModule],
  imports: [
    LocalizationModule,
    FileModule,
    SettingsModule,
    ResourceLibraryModule,
    SearchIndexModule,
  ],
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule {}
