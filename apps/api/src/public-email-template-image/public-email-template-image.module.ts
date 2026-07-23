import { Module } from "@nestjs/common";

import { FileModule } from "src/file/files.module";

import { PublicEmailTemplateImageController } from "./public-email-template-image.controller";
import { PublicEmailTemplateImageService } from "./public-email-template-image.service";

@Module({
  imports: [FileModule],
  controllers: [PublicEmailTemplateImageController],
  providers: [PublicEmailTemplateImageService],
})
export class PublicEmailTemplateImageModule {}
