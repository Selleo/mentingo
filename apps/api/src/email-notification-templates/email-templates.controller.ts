import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  PERMISSIONS,
  SUPPORTED_LANGUAGES,
  type EmailTemplateStatus,
  type SupportedLanguages,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import {
  baseResponse,
  BaseResponse,
  paginatedResponse,
  PaginatedResponse,
  UUIDSchema,
  UUIDType,
} from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import { EmailNotificationTemplatesService } from "./email-templates.service";
import {
  createEmailNotificationTemplateSchema,
  type CreateEmailNotificationTemplate,
} from "./schemas/createEmailNotificationTemplate.schema";
import {
  emailNotificationTemplateSchema,
  emailNotificationTemplatesListSchema,
  emailTemplateStatusSchema,
} from "./schemas/emailNotificationTemplate.schema";
import { previewEmailNotificationTemplateSchema } from "./schemas/previewEmailNotificationTemplate.schema";
import {
  updateEmailNotificationTemplateSchema,
  type UpdateEmailNotificationTemplate,
} from "./schemas/updateEmailNotificationTemplate.schema";

@UseGuards(PermissionsGuard)
@Controller("email-notification-templates")
export class EmailNotificationTemplatesController {
  constructor(
    private readonly emailNotificationTemplatesService: EmailNotificationTemplatesService,
  ) {}

  @Get()
  @RequirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)
  @Validate({
    request: [
      { type: "query", name: "status", schema: Type.Optional(emailTemplateStatusSchema) },
      { type: "query", name: "name", schema: Type.Optional(Type.String()) },
      { type: "query", name: "page", schema: Type.Optional(Type.Number({ minimum: 1 })) },
      { type: "query", name: "perPage", schema: Type.Optional(Type.Number({ minimum: 1 })) },
    ],
    response: paginatedResponse(emailNotificationTemplatesListSchema),
  })
  async listTemplates(
    @Query("status") status?: EmailTemplateStatus,
    @Query("name") name?: string,
    @Query("page") page?: number,
    @Query("perPage") perPage?: number,
  ) {
    const result = await this.emailNotificationTemplatesService.listTemplates(
      { page, perPage },
      { status, name },
    );

    return new PaginatedResponse(result);
  }

  @Get("next-auto-name")
  @RequirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)
  @Validate({
    response: baseResponse(Type.Object({ name: Type.String() })),
  })
  async getNextAutoName() {
    const name = await this.emailNotificationTemplatesService.getNextAutoTemplateName();
    return new BaseResponse({ name });
  }

  @Delete("bulk")
  @RequirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)
  @Validate({
    request: [{ type: "body", schema: Type.Array(UUIDSchema, { minItems: 1 }) }],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async deleteManyTemplates(@Body() ids: UUIDType[]) {
    await this.emailNotificationTemplatesService.deleteManyTemplates(ids);

    return new BaseResponse({ message: "emailTemplates.toast.deletedSuccessfully" });
  }

  @Post()
  @RequirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)
  @Validate({
    request: [{ type: "body", schema: createEmailNotificationTemplateSchema }],
    response: baseResponse(emailNotificationTemplateSchema),
  })
  async createTemplate(@Body() body: CreateEmailNotificationTemplate) {
    const template = await this.emailNotificationTemplatesService.createTemplate(body);

    return new BaseResponse(template);
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(emailNotificationTemplateSchema),
  })
  async getTemplate(@Param("id") id: UUIDType) {
    const template = await this.emailNotificationTemplatesService.getTemplateById(id);

    return new BaseResponse(template);
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateEmailNotificationTemplateSchema },
    ],
    response: baseResponse(emailNotificationTemplateSchema),
  })
  async updateTemplate(@Param("id") id: UUIDType, @Body() body: UpdateEmailNotificationTemplate) {
    const template = await this.emailNotificationTemplatesService.updateTemplate(id, body);

    return new BaseResponse(template);
  }

  @Post(":id/publish")
  @RequirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(emailNotificationTemplateSchema),
  })
  async publishTemplate(@Param("id") id: UUIDType) {
    const template = await this.emailNotificationTemplatesService.publishTemplate(id);

    return new BaseResponse(template);
  }

  @Post(":id/make-draft")
  @RequirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(emailNotificationTemplateSchema),
  })
  async makeTemplateDraft(@Param("id") id: UUIDType) {
    const template = await this.emailNotificationTemplatesService.makeDraftTemplate(id);

    return new BaseResponse(template);
  }

  @Post(":id/archive")
  @RequirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(emailNotificationTemplateSchema),
  })
  async archiveTemplate(@Param("id") id: UUIDType) {
    const template = await this.emailNotificationTemplatesService.archiveTemplate(id);

    return new BaseResponse(template);
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async deleteTemplate(@Param("id") id: UUIDType) {
    await this.emailNotificationTemplatesService.deleteTemplate(id);

    return new BaseResponse({ message: "emailTemplates.toast.deletedSuccessfully" });
  }

  @Post(":id/unarchive")
  @RequirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(emailNotificationTemplateSchema),
  })
  async unarchiveTemplate(@Param("id") id: UUIDType) {
    const template = await this.emailNotificationTemplatesService.unarchiveTemplate(id);

    return new BaseResponse(template);
  }

  @Post(":id/preview")
  @RequirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)) },
    ],
    response: baseResponse(previewEmailNotificationTemplateSchema),
  })
  async previewTemplate(
    @Param("id") id: UUIDType,
    @Query("language") language?: SupportedLanguages,
  ) {
    const preview = await this.emailNotificationTemplatesService.previewTemplate(id, language);

    return new BaseResponse(preview);
  }

  @Post(":id/test-send")
  @RequirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)) },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async sendTestEmail(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    await this.emailNotificationTemplatesService.sendTestEmail(id, currentUser, language);
    return new BaseResponse({ message: "emailTemplates.toast.testEmailSentSuccessfully" });
  }

  @Post(":id/duplicate")
  @RequirePermission(PERMISSIONS.EMAIL_TEMPLATE_MANAGE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(emailNotificationTemplateSchema),
  })
  async duplicateTemplate(@Param("id") id: UUIDType) {
    const template = await this.emailNotificationTemplatesService.duplicateTemplate(id);

    return new BaseResponse(template);
  }
}
