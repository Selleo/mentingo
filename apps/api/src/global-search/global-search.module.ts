import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";

import { GlobalSearchController } from "./global-search.controller";
import { GlobalSearchRepository } from "./global-search.repository";
import { GlobalSearchService } from "./global-search.service";
import { SearchIndexModule } from "./search-index.module";

@Module({
  imports: [FileModule, LocalizationModule, SearchIndexModule],
  controllers: [GlobalSearchController],
  providers: [GlobalSearchService, GlobalSearchRepository],
})
export class GlobalSearchModule {}
