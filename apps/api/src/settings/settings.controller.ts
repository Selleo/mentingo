import {
  Controller,
  Get,
  Body,
  Patch,
  UseGuards,
  Put,
  UseInterceptors,
  UploadedFile,
  Param,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import {
  ALLOWED_ARTICLES_SETTINGS,
  ALLOWED_NEWS_SETTINGS,
  ALLOWED_QA_SETTINGS,
  type AllowedArticlesSettings,
  type AllowedNewsSettings,
  type AllowedQASettings,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { UUIDType, baseResponse, BaseResponse } from "src/common";
import { FILE_SIZE_BASE } from "src/common/constants";
import { Public } from "src/common/decorators/public.decorator";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { CompanyInformaitonJSONSchema } from "./schemas/company-information.schema";
import { loginBackgroundResponseSchema } from "./schemas/login-background.schema";
import { platformLogoResponseSchema } from "./schemas/platform-logo.schema";
import { platformSimpleLogoResponseSchema } from "./schemas/platform-simple-logo.schema";
import {
  adminSettingsJSONContentSchema,
  companyInformationJSONSchema,
  globalSettingsJSONSchema,
  settingsJSONContentSchema,
  userSettingsJSONContentSchema,
} from "./schemas/settings.schema";
import {
  UpdateDefaultCourseCurrencyBody,
  updateDefaultCourseCurrencySchema,
  updateGlobalColorSchema,
  UpdateGlobalColorSchemaBody,
  UpdateMFAEnforcedRolesRequest,
  updateMFAEnforcedRolesSchema,
  UpdateSettingsBody,
  updateSettingsBodySchema,
  updateConfigWarningDismissedSchema,
  UpdateConfigWarningDismissedBody,
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
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<AdminSettingsJSONContentSchema>> {
    const result = await this.settingsService.updateAdminNewUserNotification(currentUserId);
    return new BaseResponse(result);
  }

  @Patch("admin/unregistered-user-courses-accessibility")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    response: baseResponse(globalSettingsJSONSchema),
  })
  async updateUnregisteredUserCoursesAccessibility(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GlobalSettingsJSONContentSchema>> {
    const result =
      await this.settingsService.updateGlobalUnregisteredUserCoursesAccessibility(currentUser);
    return new BaseResponse(result);
  }

  @Patch("admin/enforce-sso")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    response: baseResponse(globalSettingsJSONSchema),
  })
  async updateEnforceSSO(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GlobalSettingsJSONContentSchema>> {
    const result = await this.settingsService.updateGlobalEnforceSSO(currentUser);
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

  @Patch("admin/overdue-course-notification")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    response: baseResponse(adminSettingsJSONContentSchema),
  })
  async updateAdminOverdueCourseNotification(
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<AdminSettingsJSONContentSchema>> {
    const result =
      await this.settingsService.updateAdminSetOverdueCourseNotificationForUser(userId);
    return new BaseResponse(result);
  }

  @Patch("admin/color-schema")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    response: baseResponse(globalSettingsJSONSchema),
    request: [{ type: "body", schema: updateGlobalColorSchema }],
  })
  async updateColorSchema(
    @Body() body: UpdateGlobalColorSchemaBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GlobalSettingsJSONContentSchema>> {
    const result = await this.settingsService.updateGlobalColorSchema(
      body.primaryColor,
      body.contrastColor,
      currentUser,
    );
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
        fileSize: FILE_SIZE_BASE,
      },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        logo: {
          type: "string",
          format: "binary",
          nullable: true,
        },
      },
    },
  })
  async updatePlatformLogo(
    @UploadedFile() logo: Express.Multer.File | null,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<void> {
    await this.settingsService.uploadPlatformLogo(logo, currentUser);
  }

  @Get("platform-simple-logo")
  @Public()
  @Validate({
    response: baseResponse(platformSimpleLogoResponseSchema),
  })
  async getPlatformSimpleLogo() {
    const url = await this.settingsService.getPlatformSimpleLogoUrl();
    return new BaseResponse({ url });
  }

  @Patch("platform-simple-logo")
  @Roles(USER_ROLES.ADMIN)
  @UseInterceptors(
    FileInterceptor("logo", {
      limits: {
        fileSize: FILE_SIZE_BASE,
      },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        logo: {
          type: "string",
          format: "binary",
          nullable: true,
        },
      },
    },
  })
  async updatePlatformSimpleLogo(
    @UploadedFile() logo: Express.Multer.File | null,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<void> {
    await this.settingsService.uploadPlatformSimpleLogo(logo, currentUser);
  }

  @Get("login-background")
  @Public()
  @Validate({
    response: baseResponse(loginBackgroundResponseSchema),
  })
  async getLoginBackground() {
    const loginBackgroundImageS3Key = await this.settingsService.getLoginBackgroundImageUrl();
    return new BaseResponse(loginBackgroundImageS3Key);
  }

  @Patch("login-background")
  @Roles(USER_ROLES.ADMIN)
  @UseInterceptors(
    FileInterceptor("login-background", {
      limits: {
        fileSize: FILE_SIZE_BASE,
      },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        "login-background": {
          type: "string",
          format: "binary",
          nullable: true,
        },
      },
    },
  })
  async updateLoginBackground(
    @UploadedFile() loginBackground: Express.Multer.File | null,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<void> {
    await this.settingsService.uploadLoginBackgroundImage(loginBackground, currentUser);
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
  async updateCompanyInformation(
    @Body() companyInfo: CompanyInformaitonJSONSchema,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return new BaseResponse(
      await this.settingsService.updateCompanyInformation(companyInfo, currentUser),
    );
  }

  @Patch("admin/mfa-enforced-roles")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "body", schema: updateMFAEnforcedRolesSchema }],
  })
  async updateMFAEnforcedRoles(
    @Body() rolesRequest: UpdateMFAEnforcedRolesRequest,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<GlobalSettingsJSONContentSchema> {
    return await this.settingsService.updateMFAEnforcedRoles(rolesRequest, currentUser);
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
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GlobalSettingsJSONContentSchema>> {
    return new BaseResponse(
      await this.settingsService.updateCertificateBackground(certificateBackground, currentUser),
    );
  }

  @Patch("admin/default-course-currency")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "body", schema: updateDefaultCourseCurrencySchema }],
  })
  async updateDefaultCourseCurrency(
    @Body() newSettings: UpdateDefaultCourseCurrencyBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GlobalSettingsJSONContentSchema>> {
    const updatedGlobalSettings = await this.settingsService.updateDefaultCourseCurrency(
      newSettings.defaultCourseCurrency,
      currentUser,
    );

    return new BaseResponse(updatedGlobalSettings);
  }

  @Patch("admin/invite-only-registration")
  @Roles(USER_ROLES.ADMIN)
  async updateInviteOnlyRegistration(@CurrentUser() currentUser: CurrentUserType) {
    return new BaseResponse(
      await this.settingsService.updateGlobalInviteOnlyRegistration(currentUser),
    );
  }

  @Patch("admin/user-email-triggers/:triggerKey")
  @Validate({
    request: [{ type: "param", name: "triggerKey", schema: Type.String() }],
  })
  @Roles(USER_ROLES.ADMIN)
  async updateUserEmailTriggers(
    @Param("triggerKey") triggerKey: string,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return new BaseResponse(
      await this.settingsService.updateUserEmailTriggers(triggerKey, currentUser),
    );
  }

  @Patch("admin/config-warning-dismissed")
  @Roles(USER_ROLES.ADMIN)
  @Validate({
    request: [{ type: "body", schema: updateConfigWarningDismissedSchema }],
    response: baseResponse(adminSettingsJSONContentSchema),
  })
  async updateConfigWarningDismissed(
    @Body() body: UpdateConfigWarningDismissedBody,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<AdminSettingsJSONContentSchema>> {
    const updatedSettings = await this.settingsService.updateConfigWarningDismissed(
      userId,
      body.dismissed,
    );
    return new BaseResponse(updatedSettings);
  }

  @Patch("admin/qa/:setting")
  @Validate({
    request: [{ type: "param", name: "setting", schema: Type.Enum(ALLOWED_QA_SETTINGS) }],
  })
  @Roles(USER_ROLES.ADMIN)
  async updateQaSetting(@Param("setting") setting: AllowedQASettings) {
    return new BaseResponse(await this.settingsService.updateQASetting(setting));
  }

  @Patch("admin/news/:setting")
  @Validate({
    request: [{ type: "param", name: "setting", schema: Type.Enum(ALLOWED_NEWS_SETTINGS) }],
  })
  @Roles(USER_ROLES.ADMIN)
  async updateNewsSetting(@Param("setting") setting: AllowedNewsSettings) {
    return new BaseResponse(await this.settingsService.updateNewsSetting(setting));
  }

  @Patch("admin/articles/:setting")
  @Validate({
    request: [{ type: "param", name: "setting", schema: Type.Enum(ALLOWED_ARTICLES_SETTINGS) }],
  })
  @Roles(USER_ROLES.ADMIN)
  async updateArticlesSetting(@Param("setting") setting: AllowedArticlesSettings) {
    return new BaseResponse(await this.settingsService.updateArticlesSetting(setting));
  }
}
