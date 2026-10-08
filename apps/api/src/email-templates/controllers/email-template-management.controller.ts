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
import {
  type AutomationEventDefinition,
  PERMISSIONS,
  SUPPORTED_IMAGE_VARIANT_MIME_TYPES,
  type SupportedLanguages,
  BuiltInEmailTemplateKey,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { buildAutomationEventCatalogWithSamples } from "src/automations/mappers/automation-event-preview.mapper";
import { automationEventSchema } from "src/automations/schema/automation.schema";
import { BaseResponse, PaginatedResponse, UUIDSchema, UUIDType, baseResponse } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { parsePagination } from "src/common/pagination";
import { CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";

import { EMAIL_TEMPLATE_IMAGE_MAX_BYTES } from "../email-template.constants";
import {
  publishEmailTemplateSchema,
  type PublishEmailTemplateBody,
  createEmailTemplateSchema,
  builtInEmailTemplateKeySchema,
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
import { EmailTemplateManagementService } from "../services/email-template-management.service";
import { EmailTemplateTestDeliveryService } from "../services/email-template-test-delivery.service";

@Controller("email-templates")
@RequirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)
export class EmailTemplateManagementController {
  constructor(
    private readonly emailTemplateManagementService: EmailTemplateManagementService,
    private readonly emailTemplateAssetService: EmailTemplateAssetService,
    private readonly emailTemplateTestDeliveryService: EmailTemplateTestDeliveryService,
  ) {}

  @Get("events")
  @Validate({
    request: [{ type: "query", name: "language", schema: Type.Optional(supportedLanguagesSchema) }],
    response: baseResponse(Type.Array(automationEventSchema)),
  })
  listEmailTemplateEvents(
    @Query("language") language?: SupportedLanguages,
  ): BaseResponse<AutomationEventDefinition[]> {
    return new BaseResponse(buildAutomationEventCatalogWithSamples(language));
  }

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
  async enqueueEmailTemplateTest(
    @Body() body: PreviewEmailTemplateBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<EmailTemplateTestResponse>> {
    return new BaseResponse(
      await this.emailTemplateTestDeliveryService.enqueueEmailTemplateTest(body, currentUser),
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
    @UploadedFile(
      getBaseFileTypePipe(
        buildFileTypeRegex(SUPPORTED_IMAGE_VARIANT_MIME_TYPES),
        EMAIL_TEMPLATE_IMAGE_MAX_BYTES,
      ).build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
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
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(
      await this.emailTemplateManagementService.duplicateEmailTemplate(id, currentUser),
    );
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
      { type: "query", name: "search", schema: Type.Optional(Type.String({ maxLength: 200 })) },
      { type: "query", name: "language", schema: Type.Optional(supportedLanguagesSchema) },
    ],
    response: paginatedEmailTemplateSchema,
  })
  async listEmailTemplates(
    @Query("page") page?: number,
    @Query("perPage") perPage?: number,
    @Query("search") search?: string,
    @Query("language") language?: SupportedLanguages,
  ): Promise<PaginatedResponse<EmailTemplateResponse[]>> {
    const pagination = parsePagination(page, perPage);

    return new PaginatedResponse(
      await this.emailTemplateManagementService.listEmailTemplates(
        pagination.page,
        pagination.perPage,
        search,
        language,
      ),
    );
  }

  @Get("defaults/:event")
  @Validate({
    request: [{ type: "param", name: "event", schema: builtInEmailTemplateKeySchema }],
    response: baseResponse(emailTemplateSchema),
  })
  async getBuiltInEmailTemplate(
    @Param("event") event: BuiltInEmailTemplateKey,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(
      await this.emailTemplateManagementService.getBuiltInEmailTemplate(event),
    );
  }

  @Post("defaults/:event/copy")
  @Validate({
    request: [{ type: "param", name: "event", schema: builtInEmailTemplateKeySchema }],
    response: baseResponse(emailTemplateSchema),
  })
  async createDraftFromBuiltInEmailTemplate(
    @Param("event") event: BuiltInEmailTemplateKey,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(
      await this.emailTemplateManagementService.createDraftFromBuiltInEmailTemplate(
        event,
        currentUser,
      ),
    );
  }

  @Get(":id")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(emailTemplateSchema),
  })
  async getEmailTemplate(@Param("id") id: UUIDType): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(await this.emailTemplateManagementService.getEmailTemplate(id));
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
      await this.emailTemplateManagementService.createEmailTemplate(
        body,
        currentUser.tenantId,
        currentUser,
      ),
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
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(
      await this.emailTemplateManagementService.updateEmailTemplate(id, body, currentUser),
    );
  }

  @Patch(":id/base-language")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateEmailTemplateBaseLanguageSchema },
    ],
    response: baseResponse(emailTemplateSchema),
  })
  async updateEmailTemplateBaseLanguage(
    @Param("id") id: UUIDType,
    @Body() body: UpdateEmailTemplateBaseLanguageBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(
      await this.emailTemplateManagementService.updateEmailTemplateBaseLanguage(
        id,
        body,
        currentUser,
      ),
    );
  }

  @Post(":id/publish")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: publishEmailTemplateSchema },
    ],
    response: baseResponse(emailTemplateSchema),
  })
  async publishEmailTemplate(
    @Param("id") id: UUIDType,
    @Body() body: PublishEmailTemplateBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(
      await this.emailTemplateManagementService.publishEmailTemplate(id, currentUser, body),
    );
  }

  @Post(":id/archive")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(emailTemplateSchema),
  })
  async archiveEmailTemplate(
    @Param("id") id: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(
      await this.emailTemplateManagementService.archiveEmailTemplate(id, currentUser),
    );
  }

  @Delete(":id")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(Type.Boolean()),
  })
  async deleteEmailTemplate(
    @Param("id") id: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<boolean>> {
    await this.emailTemplateManagementService.deleteEmailTemplate(id, currentUser);

    return new BaseResponse(true);
  }

  @Delete(":id/languages/:language")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "param", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(emailTemplateSchema),
  })
  async removeEmailTemplateLanguage(
    @Param("id") id: UUIDType,
    @Param("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(
      await this.emailTemplateManagementService.removeEmailTemplateLanguage(
        id,
        language,
        currentUser,
      ),
    );
  }

  @Post(":id/restore")
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(emailTemplateSchema),
  })
  async restoreEmailTemplate(
    @Param("id") id: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<EmailTemplateResponse>> {
    return new BaseResponse(
      await this.emailTemplateManagementService.restoreEmailTemplate(id, currentUser),
    );
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
      await this.emailTemplateManagementService.previewEmailTemplate(
        body,
        currentUser.tenantId,
        currentUser.userId,
      ),
    );
  }
}
