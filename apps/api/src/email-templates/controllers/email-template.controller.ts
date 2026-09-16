import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { EmailTemplateEvent } from "@repo/email-templates";
import { PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { BaseResponse, PaginatedResponse, UUIDSchema, UUIDType, baseResponse } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { parsePagination } from "src/common/pagination";
import { CurrentUserType } from "src/common/types/current-user.type";

import { EMAIL_TEMPLATE_IMAGE_MAX_BYTES } from "../email-template.constants";
import {
  createEmailTemplateSchema,
  emailTemplateEventSchema,
  emailTemplatePreviewResponseSchema,
  emailTemplateSchema,
  paginatedEmailTemplateSchema,
  previewEmailTemplateSchema,
  updateEmailTemplateBaseLanguageSchema,
  updateEmailTemplateSchema,
  type CreateEmailTemplateBody,
  type EmailTemplatePreviewResponse,
  type EmailTemplateResponse,
  type PreviewEmailTemplateBody,
  type UpdateEmailTemplateBaseLanguageBody,
  type UpdateEmailTemplateBody,
  emailTemplateImageResponseSchema,
  emailTemplateTestResponseSchema,
  type EmailTemplateImageResponse,
  type EmailTemplateTestResponse,
} from "../schemas/email-template.schema";
import { EmailTemplateAssetService } from "../services/email-template-asset.service";
import { EmailTemplateTestService } from "../services/email-template-test.service";
import { EmailTemplateService } from "../services/email-template.service";

@Controller("email-templates")
@RequirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)
export class EmailTemplateController {
  constructor(
    private readonly emailTemplateService: EmailTemplateService,
    private readonly emailTemplateAssetService: EmailTemplateAssetService,
    private readonly emailTemplateTestService: EmailTemplateTestService,
  ) {}

  @Get("images/:id")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(emailTemplateImageResponseSchema),
  })
  async getEmailTemplateImage(
    @Param("id") id: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<EmailTemplateImageResponse>> {
    return new BaseResponse(
      await this.emailTemplateAssetService.getEmailTemplateImage(id, currentUser.tenantId),
    );
  }

  @Post("test-send")
  @Validate({
    request: [{ type: "body", schema: previewEmailTemplateSchema }],
    response: baseResponse(emailTemplateTestResponseSchema),
  })
  async sendTestEmailTemplate(
    @Body() body: PreviewEmailTemplateBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<EmailTemplateTestResponse>> {
    return new BaseResponse(
      await this.emailTemplateTestService.enqueueTestEmailTemplate(body, currentUser),
    );
  }

  @Post("images")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: EMAIL_TEMPLATE_IMAGE_MAX_BYTES, files: 1 } }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @Validate({ response: baseResponse(emailTemplateImageResponseSchema) })
  async uploadEmailTemplateImage(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<EmailTemplateImageResponse>> {
    return new BaseResponse(
      await this.emailTemplateAssetService.uploadEmailTemplateImage(file, currentUser),
    );
  }

  @Post(":id/duplicate")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(emailTemplateSchema),
  })
  async duplicateEmailTemplate(
    @Param("id") id: UUIDType,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(await this.emailTemplateService.duplicateEmailTemplate(id));
  }

  @Get()
  @Validate({
    request: [
      { type: "query", name: "page", schema: Type.Optional(Type.Number({ minimum: 1 })) },
      {
        type: "query",
        name: "perPage",
        schema: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
      },
    ],
    response: paginatedEmailTemplateSchema,
  })
  async getEmailTemplates(
    @Query("page") page?: number,
    @Query("perPage") perPage?: number,
  ): Promise<PaginatedResponse<EmailTemplateResponse[]>> {
    const pagination = parsePagination(page, perPage);
    return new PaginatedResponse(
      await this.emailTemplateService.getEmailTemplates(pagination.page, pagination.perPage),
    );
  }

  @Get("defaults/:event")
  @Validate({
    request: [{ type: "param", name: "event", schema: emailTemplateEventSchema }],
    response: baseResponse(emailTemplateSchema),
  })
  async getDefaultEmailTemplate(
    @Param("event") event: EmailTemplateEvent,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(await this.emailTemplateService.getDefaultEmailTemplate(event));
  }

  @Post("defaults/:event/copy")
  @Validate({
    request: [{ type: "param", name: "event", schema: emailTemplateEventSchema }],
    response: baseResponse(emailTemplateSchema),
  })
  async copyDefaultEmailTemplate(
    @Param("event") event: EmailTemplateEvent,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(await this.emailTemplateService.copyDefaultEmailTemplate(event));
  }

  @Get(":id")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(emailTemplateSchema),
  })
  async getEmailTemplate(@Param("id") id: UUIDType): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(await this.emailTemplateService.getEmailTemplate(id));
  }

  @Post()
  @Validate({
    request: [{ type: "body", schema: createEmailTemplateSchema }],
    response: baseResponse(emailTemplateSchema),
  })
  async createEmailTemplate(
    @Body() body: CreateEmailTemplateBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(
      await this.emailTemplateService.createEmailTemplate(body, currentUser.tenantId),
    );
  }

  @Patch(":id")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateEmailTemplateSchema },
    ],
    response: baseResponse(emailTemplateSchema),
  })
  async updateEmailTemplate(
    @Param("id") id: UUIDType,
    @Body() body: UpdateEmailTemplateBody,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(await this.emailTemplateService.updateEmailTemplate(id, body));
  }

  @Patch(":id/base-language")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateEmailTemplateBaseLanguageSchema },
    ],
    response: baseResponse(emailTemplateSchema),
  })
  async updateBaseLanguage(
    @Param("id") id: UUIDType,
    @Body() body: UpdateEmailTemplateBaseLanguageBody,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(await this.emailTemplateService.updateBaseLanguage(id, body));
  }

  @Post(":id/publish")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(emailTemplateSchema),
  })
  async publishEmailTemplate(
    @Param("id") id: UUIDType,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(await this.emailTemplateService.publishEmailTemplate(id));
  }

  @Post(":id/archive")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(emailTemplateSchema),
  })
  async archiveEmailTemplate(
    @Param("id") id: UUIDType,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(await this.emailTemplateService.archiveEmailTemplate(id));
  }

  @Delete(":id")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(Type.Boolean()),
  })
  async deleteEmailTemplate(@Param("id") id: UUIDType): Promise<BaseResponse<boolean>> {
    await this.emailTemplateService.deleteEmailTemplate(id);
    return new BaseResponse(true);
  }

  @Post(":id/restore")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(emailTemplateSchema),
  })
  async restoreEmailTemplate(
    @Param("id") id: UUIDType,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(await this.emailTemplateService.restoreEmailTemplate(id));
  }

  @Post("preview")
  @Validate({
    request: [{ type: "body", schema: previewEmailTemplateSchema }],
    response: baseResponse(emailTemplatePreviewResponseSchema),
  })
  async previewEmailTemplate(
    @Body() body: PreviewEmailTemplateBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<EmailTemplatePreviewResponse>> {
    return new BaseResponse(
      await this.emailTemplateService.previewEmailTemplate(
        body,
        currentUser.tenantId,
        currentUser.userId,
      ),
    );
  }
}
