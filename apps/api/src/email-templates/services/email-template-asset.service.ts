import { BadRequestException, Injectable } from "@nestjs/common";
import {
  EMAIL_TEMPLATE_BLOCK_TYPES,
  type EmailTemplateDocument,
  type LocalizedEmailTemplateContent,
} from "@repo/email-templates";
import { ALLOWED_LESSON_IMAGE_FILE_TYPES, RESOURCE_VISIBILITY } from "@repo/shared";
import sharp from "sharp";

import { RESOURCE_CATEGORIES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { FileGuard } from "src/file/guards/file.guard";

import {
  EMAIL_TEMPLATE_ASSET_FOLDER,
  EMAIL_TEMPLATE_ASSET_PATTERN,
  EMAIL_TEMPLATE_IMAGE_MAX_BYTES,
  EMAIL_TEMPLATE_IMAGE_MAX_PIXELS,
} from "../email-template.constants";
import { EmailTemplateAssetRepository } from "../repositories/email-template-asset.repository";

import type { UUIDType } from "src/common";
import type { Attachment } from "src/common/emails/email.interface";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class EmailTemplateAssetService {
  constructor(
    private readonly fileService: FileService,
    private readonly emailTemplateAssetRepository: EmailTemplateAssetRepository,
  ) {}

  async getEmailTemplateImage(id: UUIDType, tenantId: UUIDType) {
    const resource = await this.getOwnedEmailTemplateAsset(id, tenantId);

    return {
      resourceId: id,
      src: `asset:${id}`,
      previewUrl: await this.fileService.getFileUrl(resource.reference),
    };
  }

  async uploadEmailTemplateImage(file: Express.Multer.File, currentUser: CurrentUserType) {
    if (!file) throw new BadRequestException("files.toast.invalidData");

    await FileGuard.validateFile(file, {
      allowedTypes: ALLOWED_LESSON_IMAGE_FILE_TYPES,
      maxSize: EMAIL_TEMPLATE_IMAGE_MAX_BYTES,
    });
    try {
      await sharp(file.buffer, { limitInputPixels: EMAIL_TEMPLATE_IMAGE_MAX_PIXELS }).metadata();
    } catch {
      throw new BadRequestException("files.toast.invalidData");
    }

    const uploaded = await this.fileService.uploadResource({
      file,
      folder: EMAIL_TEMPLATE_ASSET_FOLDER,
      resource: RESOURCE_CATEGORIES.EMAIL_TEMPLATE,
      currentUser,
      options: { folderIncludesResource: true, visibility: RESOURCE_VISIBILITY.PRIVATE },
    });

    return {
      resourceId: uploaded.resourceId,
      src: `asset:${uploaded.resourceId}`,
      previewUrl: uploaded.fileUrl,
    };
  }

  async validateEmailTemplateAssets(content: LocalizedEmailTemplateContent, tenantId: UUIDType) {
    const assetIds = new Set(
      Object.values(content).flatMap((document) =>
        document.content.flatMap((block) => {
          if (block.type !== EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE) return [];
          const match = block.attrs.src.match(EMAIL_TEMPLATE_ASSET_PATTERN);
          return match ? [match[1]] : [];
        }),
      ),
    );
    for (const id of assetIds) await this.getOwnedEmailTemplateAsset(id, tenantId);
  }

  async resolveEmailTemplateAssets(
    document: EmailTemplateDocument,
    tenantId: UUIDType,
    preview = false,
  ) {
    const resolvedDocument = structuredClone(document);
    const attachments = new Map<string, Attachment>();
    const sources = new Map<string, string>();
    for (const block of resolvedDocument.content) {
      if (block.type !== EMAIL_TEMPLATE_BLOCK_TYPES.IMAGE) continue;
      const match = block.attrs.src.match(EMAIL_TEMPLATE_ASSET_PATTERN);
      if (!match) continue;
      const id = match[1];
      if (!sources.has(id)) {
        const resource = await this.getOwnedEmailTemplateAsset(id, tenantId);
        const buffer = await this.fileService.getRawFileBuffer(resource.reference);
        if (!buffer) throw new BadRequestException("files.toast.invalidData");
        const content = await sharp(buffer, { limitInputPixels: EMAIL_TEMPLATE_IMAGE_MAX_PIXELS })
          .resize({ width: 1200, withoutEnlargement: true })
          .png()
          .toBuffer();
        const cid = `email-template-${id}`;
        sources.set(
          id,
          preview ? `data:image/png;base64,${content.toString("base64")}` : `cid:${cid}`,
        );
        attachments.set(id, { filename: `${cid}.png`, content, contentType: "image/png", cid });
      }
      block.attrs.src = sources.get(id)!;
    }
    return { document: resolvedDocument, attachments: [...attachments.values()] };
  }

  private async getOwnedEmailTemplateAsset(id: UUIDType, tenantId: UUIDType) {
    const resource = await this.emailTemplateAssetRepository.findEmailTemplateAsset(id, tenantId);
    if (
      !resource ||
      !resource.reference.startsWith(`${tenantId}/${EMAIL_TEMPLATE_ASSET_FOLDER}/`) ||
      !ALLOWED_LESSON_IMAGE_FILE_TYPES.includes(resource.contentType)
    ) {
      throw new BadRequestException("files.toast.invalidData");
    }
    return resource;
  }
}
