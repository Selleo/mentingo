import { Injectable } from "@nestjs/common";

import { RESOURCE_CATEGORIES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";

import type { UUIDType } from "src/common";

@Injectable()
export class PublicEmailTemplateImageService {
  constructor(private readonly fileService: FileService) {}

  async resolveSignedUrl(reference: string, tenantId: UUIDType): Promise<string | null> {
    let decoded: string;
    try {
      decoded = decodeURIComponent(reference);
    } catch {
      return null;
    }
    const expectedPrefix = `${tenantId}/${RESOURCE_CATEGORIES.EMAIL_TEMPLATE_IMAGE}/`;

    if (!decoded.startsWith(expectedPrefix)) return null;

    return this.fileService.getImageUrlByQuality(decoded);
  }
}
