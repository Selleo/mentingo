import { Injectable } from "@nestjs/common";

import { RESOURCE_CATEGORIES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";

import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class EmailTemplateImageService {
  constructor(private readonly fileService: FileService) {}

  async uploadForTenant(file: Express.Multer.File, currentUser: CurrentUserType) {
    const result = await this.fileService.uploadFile(
      file,
      RESOURCE_CATEGORIES.EMAIL_TEMPLATE_IMAGE,
      currentUser.tenantId,
      { skipVariants: true },
    );
    return { reference: result.fileKey };
  }

  async deleteByKey(key: string): Promise<void> {
    await this.fileService.deleteFile(key);
  }
}
