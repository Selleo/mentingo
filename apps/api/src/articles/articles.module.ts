import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { SearchIndexModule } from "src/global-search/search-index.module";
import { LocalizationModule } from "src/localization/localization.module";
import { ResourceLibraryModule } from "src/resource-library/resource-library.module";
import { SettingsModule } from "src/settings/settings.module";

import { ArticlesController } from "./articles.controller";
import { ArticlesRepository } from "./repositories/articles.repository";
import { ArticlesService } from "./services/articles.service";

@Module({
  imports: [
    LocalizationModule,
    FileModule,
    SettingsModule,
    ResourceLibraryModule,
    SearchIndexModule,
  ],
  providers: [ArticlesService, ArticlesRepository],
  controllers: [ArticlesController],
})
export class ArticlesModule {}
