import { Module } from "@nestjs/common";

import { SearchIndexRepository } from "./search-index.repository";
import { SearchIndexService } from "./search-index.service";

@Module({
  providers: [SearchIndexService, SearchIndexRepository],
  exports: [SearchIndexService],
})
export class SearchIndexModule {}
