import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";

import { NewsController } from "./news.controller";
import { NewsService } from "./news.service";

@Module({
  exports: [NewsModule],
  imports: [LocalizationModule, FileModule],
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule {}
