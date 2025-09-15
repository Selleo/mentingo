import {
  Controller,
  Get,
  Body,
  Patch,
  UseGuards,
  Put,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { Validate } from "nestjs-typebox";

import { UUIDType, baseResponse, BaseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { USER_ROLES } from "src/user/schemas/userRoles";

const PLATFORM_LOGO_MAX_SIZE_BYTES = 10 * 1024 * 1024;

import { CompanyInformaitonJSONSchema } from "./schemas/company-information.schema";
import { platformLogoResponseSchema } from "./schemas/platform-logo.schema";
import {
  adminSettingsJSONContentSchema,
  companyInformationJSONSchema,
  globalSettingsJSONSchema,
  settingsJSONContentSchema,
  userSettingsJSONContentSchema,
} from "./schemas/settings.schema";
import {
  UpdateMFAEnforcedRolesRequest,
  updateMFAEnforcedRolesSchema,
  UpdateSettingsBody,
  updateSettingsBodySchema,
} from "./schemas/update-settings.schema";
import { SettingsService } from "./settings.service";

import type {
  AdminSettingsJSONContentSchema,
  GlobalSettingsJSONContentSchema,
  SettingsJSONContentSchema,
} from "./schemas/settings.schema";

@Controller("settings")
@UseGuards(RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get("global")
  @Validate({
    response: baseResponse(globalSettingsJSONSchema),
  })
  async getPublicGlobalSettings(): Promise<BaseResponse<GlobalSettingsJSONContentSchema>> {
    return new BaseResponse(await this.settingsService.getGlobalSettings());
  }

  @Get()
  @Validate({
    response: baseResponse(userSettingsJSONContentSchema),
  })
  async getUserSettings(
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<SettingsJSONContentSchema>> {
    return new BaseResponse(await this.settingsService.getUserSettings(userId));
  }

  @Put()
  @Validate({
    request: [{ type: "body", schema: updateSettingsBodySchema }],
    response: baseResponse(settingsJSONContentSchema),
  })
  async updateUserSettings(
    @Body() updatedSettings: UpdateSettingsBody,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<SettingsJSONContentSchema>> {
    return new BaseResponse(await this.settingsService.updateUserSettings(userId, updatedSettings));
  }

  @Patch("admin/new-user-notification")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    response: baseResponse(adminSettingsJSONContentSchema),
  })
  async updateAdminNewUserNotification(
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<AdminSettingsJSONContentSchema>> {
    const result = await this.settingsService.updateAdminNewUserNotification(userId);
    return new BaseResponse(result);
  }

  @Patch("admin/unregistered-user-courses-accessibility")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    response: baseResponse(globalSettingsJSONSchema),
  })
  async updateUnregisteredUserCoursesAccessibility(): Promise<
    BaseResponse<GlobalSettingsJSONContentSchema>
  > {
    const result = await this.settingsService.updateGlobalUnregisteredUserCoursesAccessibility();
    return new BaseResponse(result);
  }

  @Patch("admin/enforce-sso")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    response: baseResponse(globalSettingsJSONSchema),
  })
  async updateEnforceSSO(): Promise<BaseResponse<GlobalSettingsJSONContentSchema>> {
    const result = await this.settingsService.updateGlobalEnforceSSO();
    return new BaseResponse(result);
  }

  @Patch("admin/finished-course-notification")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    response: baseResponse(adminSettingsJSONContentSchema),
  })
  async updateAdminFinishedCourseNotification(
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<AdminSettingsJSONContentSchema>> {
    const result = await this.settingsService.updateAdminFinishedCourseNotification(userId);
    return new BaseResponse(result);
  }

  @Get("platform-logo")
  @Public()
  @Validate({
    response: baseResponse(platformLogoResponseSchema),
  })
  async getPlatformLogo() {
    const url = await this.settingsService.getPlatformLogoUrl();
    return new BaseResponse({ url });
  }

  @Patch("platform-logo")
  @Roles(USER_ROLES.ADMIN)
  @UseInterceptors(
    FileInterceptor("logo", {
      limits: {
        fileSize: PLATFORM_LOGO_MAX_SIZE_BYTES,
      },
    }),
  )
  async updatePlatformLogo(@UploadedFile() logo: Express.Multer.File): Promise<void> {
    await this.settingsService.uploadPlatformLogo(logo);
  }

  @Get("company-information")
  @Public()
  @Validate({
    response: baseResponse(companyInformationJSONSchema),
  })
  async getCompanyInformation() {
    const result = await this.settingsService.getCompanyInformation();
    return new BaseResponse(result);
  }

  @Patch("company-information")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "body", schema: companyInformationJSONSchema }],
    response: baseResponse(companyInformationJSONSchema),
  })
  async updateCompanyInformation(@Body() companyInfo: CompanyInformaitonJSONSchema) {
    return new BaseResponse(await this.settingsService.updateCompanyInformation(companyInfo));
  }

  @Patch("admin/mfa-enforced-roles")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "body", schema: updateMFAEnforcedRolesSchema }],
  })
  async updateMFAEnforcedRoles(
    @Body() rolesRequest: UpdateMFAEnforcedRolesRequest,
  ): Promise<GlobalSettingsJSONContentSchema> {
    return await this.settingsService.updateMFAEnforcedRoles(rolesRequest);
  }

  @Patch("certificate-background")
  @Roles(USER_ROLES.ADMIN)
  @UseInterceptors(FileInterceptor("certificate-background"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        "certificate-background": {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  async updateCertificateBackground(
    @UploadedFile() certificateBackground: Express.Multer.File,
  ): Promise<BaseResponse<GlobalSettingsJSONContentSchema>> {
    return new BaseResponse(
      await this.settingsService.updateCertificateBackground(certificateBackground),
    );
  }
}
