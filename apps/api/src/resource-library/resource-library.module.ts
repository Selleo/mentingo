import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";

import { ResourceLibraryController } from "./resource-library.controller";
import { ResourceLibraryRepository } from "./resource-library.repository";
import { ResourceLibraryService } from "./resource-library.service";

@Module({
  imports: [FileModule, LocalizationModule],
  controllers: [ResourceLibraryController],
  providers: [ResourceLibraryService, ResourceLibraryRepository],
  exports: [ResourceLibraryService, ResourceLibraryRepository],
})
export class ResourceLibraryModule {}
