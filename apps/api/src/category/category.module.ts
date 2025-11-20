import { Module } from "@nestjs/common";

import { LocalizationModule } from "src/localization/localization.module";
import { LocalizationService } from "src/localization/localization.service";

import { CategoryController } from "./category.controller";
import { CategoryService } from "./category.service";

@Module({
  imports: [LocalizationModule],
  controllers: [CategoryController],
  providers: [CategoryService, LocalizationService],
  exports: [],
})
export class CategoryModule {}
