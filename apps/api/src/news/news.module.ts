import { Module } from "@nestjs/common";

import { LocalizationModule } from "src/localization/localization.module";

import { NewsController } from "./news.controller";
import { NewsService } from "./news.service";

@Module({
  exports: [NewsModule],
  imports: [LocalizationModule],
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule {}
