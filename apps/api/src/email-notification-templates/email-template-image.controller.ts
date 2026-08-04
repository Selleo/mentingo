import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { ALLOWED_LESSON_IMAGE_FILE_TYPES, PERMISSIONS } from "@repo/shared";
import { Request } from "express";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse } from "src/common";
import { FILE_SIZE_BASE } from "src/common/constants";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";
import { TenantResolverService } from "src/storage/db/tenant-resolver.service";

import { EmailTemplateImageService } from "./email-template-image.service";
import {
  emailTemplateImageUploadResponseSchema,
  type EmailTemplateImageUploadResponse,
} from "./schemas/emailTemplateImage.schema";
import { buildEmailTemplateImageUrl } from "./utils/buildEmailTemplateImageUrl";

@UseGuards(PermissionsGuard)
@Controller("email-notification-templates/images")
export class EmailTemplateImageController {
  constructor(
    private readonly service: EmailTemplateImageService,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  @Post()
  @RequirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
      },
      required: ["file"],
    },
  })
  @Validate({
    response: baseResponse(emailTemplateImageUploadResponseSchema),
  })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() currentUser: CurrentUserType,
    @Req() req: Request,
  ): Promise<BaseResponse<EmailTemplateImageUploadResponse>> {
    validateEmailTemplateImage(file);

    const tenantHost = await this.tenantResolver.resolveTenantHost(req);
    if (!tenantHost) throw new ForbiddenException("tenant.error.unresolved");

    const { reference } = await this.service.uploadForTenant(file, currentUser);
    const url = buildEmailTemplateImageUrl({ tenantHost, reference });

    return new BaseResponse({ url });
  }
}

const validateEmailTemplateImage = (file?: Express.Multer.File): void => {
  if (!file?.buffer?.length) throw new BadRequestException("files.toast.invalidData");

  if (!file.size || file.size > FILE_SIZE_BASE) {
    throw new BadRequestException(
      `File size exceeds the maximum allowed size of ${FILE_SIZE_BASE} bytes`,
    );
  }

  const resolvedMime = detectImageMimeType(file.buffer);
  const providedMime = normalizeMime(file.mimetype);

  if (!resolvedMime || !ALLOWED_LESSON_IMAGE_FILE_TYPES.includes(resolvedMime)) {
    throw new BadRequestException("files.toast.invalidFileType");
  }

  if (providedMime && resolvedMime !== providedMime) {
    throw new BadRequestException("files.toast.contentTypeMismatch");
  }
};

const normalizeMime = (mime?: string): string | undefined => {
  if (!mime) return undefined;
  if (mime === "image/jpg") return "image/jpeg";
  return mime;
};

const detectImageMimeType = (buffer: Buffer): string | undefined => {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  const signature = buffer.subarray(0, 6).toString("ascii");
  if (signature === "GIF87a" || signature === "GIF89a") {
    return "image/gif";
  }

  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  if (buffer.subarray(0, 2).toString("ascii") === "BM") {
    return "image/bmp";
  }

  if (
    buffer.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) ||
    buffer.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))
  ) {
    return "image/tiff";
  }

  return undefined;
};
