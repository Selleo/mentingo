import {
  Controller,
  ForbiddenException,
  HttpStatus,
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
import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";
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
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: FILE_SIZE_BASE } }))
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
    @UploadedFile(
      getBaseFileTypePipe(
        buildFileTypeRegex(ALLOWED_LESSON_IMAGE_FILE_TYPES),
        FILE_SIZE_BASE,
      ).build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    file: Express.Multer.File,
    @CurrentUser() currentUser: CurrentUserType,
    @Req() req: Request,
  ): Promise<BaseResponse<EmailTemplateImageUploadResponse>> {
    const tenantHost = await this.tenantResolver.resolveTenantHost(req);
    if (!tenantHost) throw new ForbiddenException("tenant.error.unresolved");

    const { reference } = await this.service.uploadForTenant(file, currentUser);
    const url = buildEmailTemplateImageUrl({ tenantHost, reference });

    return new BaseResponse({ url });
  }
}
