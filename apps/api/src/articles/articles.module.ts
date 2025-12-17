import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";

import { ArticlesController } from "./articles.controller";
import { ArticlesRepository } from "./repositories/articles.repository";
import { ArticlesService } from "./services/articles.service";

@Module({
  imports: [LocalizationModule, FileModule],
  providers: [ArticlesService, ArticlesRepository],
  controllers: [ArticlesController],
})
export class ArticlesModule {}
