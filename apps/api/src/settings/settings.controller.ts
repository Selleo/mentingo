import {
  Controller,
  Get,
  Body,
  Patch,
  HttpStatus,
  UseGuards,
  Put,
  UseInterceptors,
  UploadedFile,
  Param,
  Delete,
  Req,
  Res,
  Query,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import {
  ALLOWED_ARTICLES_SETTINGS,
  ALLOWED_DISCUSSIONS_SETTINGS,
  ALLOWED_NEWS_SETTINGS,
  ALLOWED_QA_SETTINGS,
  ALLOWED_AVATAR_IMAGE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  LOGIN_PAGE_DOCUMENTS_FILE_TYPES,
  PERMISSIONS,
  type AllowedArticlesSettings,
  type AllowedDiscussionsSettings,
  type AllowedNewsSettings,
  type AllowedQASettings,
  SupportedLanguages,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Request, Response } from "express";
import { Validate } from "nestjs-typebox";

import { UUIDType, baseResponse, BaseResponse, UUIDSchema } from "src/common";
import { FILE_SIZE_BASE } from "src/common/constants";
import { Public } from "src/common/decorators/public.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { DisallowInSupportModeGuard } from "src/common/guards/disallow-support-mode.guard";
import { CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";

import { CompanyInformaitonJSONSchema } from "./schemas/company-information.schema";
import { loginBackgroundResponseSchema } from "./schemas/login-background.schema";
import { platformLogoResponseSchema } from "./schemas/platform-logo.schema";
import { platformSimpleLogoResponseSchema } from "./schemas/platform-simple-logo.schema";
import {
  localizedRegistrationFormResponseSchema,
  registrationFormResponseSchema,
  updateRegistrationFormSchema,
  type RegistrationFormResponse,
  type UpdateRegistrationFormBody,
} from "./schemas/registration-form.schema";
import {
  adminSettingsJSONContentSchema,
  companyInformationJSONSchema,
  globalSettingsJSONSchema,
  loginPageResourceResponseSchema,
  settingsJSONContentSchema,
  UploadFilesToLoginPageBody,
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
  updateAgeLimitSchema,
  UpdateAgeLimitBody,
} from "./schemas/update-settings.schema";
import { SETTINGS_IMAGE_ASSET, SettingsService } from "./settings.service";

import type {
  AdminSettingsJSONContentSchema,
  GlobalSettingsJSONContentSchema,
  SettingsJSONContentSchema,
} from "./schemas/settings.schema";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get("global")
  @Validate({
    response: baseResponse(globalSettingsJSONSchema),
  })
  async getPublicGlobalSettings(): Promise<BaseResponse<GlobalSettingsJSONContentSchema>> {
    return new BaseResponse(await this.settingsService.getPublicGlobalSettings());
  }

  @Public()
  @Get("registration-form")
  @Validate({
    request: [{ type: "query", name: "language", schema: supportedLanguagesSchema }],
    response: baseResponse(localizedRegistrationFormResponseSchema),
  })
  async getPublicRegistrationForm(@Query("language") language: SupportedLanguages) {
    return new BaseResponse(await this.settingsService.getLocalizedRegistrationForm(language));
  }

  @Get()
  @Validate({
    response: baseResponse(userSettingsJSONContentSchema),
  })
  async getUserSettings(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<SettingsJSONContentSchema>> {
    return new BaseResponse(await this.settingsService.getCurrentUserSettings(currentUser));
  }

  @Put()
  @UseGuards(DisallowInSupportModeGuard)
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
  @UseGuards(DisallowInSupportModeGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
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
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
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
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  @Validate({
    response: baseResponse(globalSettingsJSONSchema),
  })
  async updateEnforceSSO(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GlobalSettingsJSONContentSchema>> {
    const result = await this.settingsService.updateGlobalEnforceSSO(currentUser);
    return new BaseResponse(result);
  }

  @Patch("admin/modern-course-list")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  @Validate({
    response: baseResponse(globalSettingsJSONSchema),
  })
  async updateModernCourseListEnabled(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GlobalSettingsJSONContentSchema>> {
    const result = await this.settingsService.updateGlobalModernCourseListEnabled(currentUser);
    return new BaseResponse(result);
  }

  @Patch("admin/finished-course-notification")
  @UseGuards(DisallowInSupportModeGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
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
  @UseGuards(DisallowInSupportModeGuard)
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
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
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
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

  @Get("admin/registration-form")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  @Validate({
    response: baseResponse(registrationFormResponseSchema),
  })
  async getAdminRegistrationForm() {
    return new BaseResponse(await this.settingsService.getAdminRegistrationForm());
  }

  @Patch("admin/registration-form")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  @Validate({
    request: [{ type: "body", schema: updateRegistrationFormSchema }],
    response: baseResponse(registrationFormResponseSchema),
  })
  async updateRegistrationForm(
    @Body() body: UpdateRegistrationFormBody,
  ): Promise<BaseResponse<RegistrationFormResponse>> {
    return new BaseResponse(await this.settingsService.updateRegistrationForm(body));
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

  @Get("platform-logo/image")
  @Public()
  async getPlatformLogoImage(@Req() req: Request, @Res() res: Response) {
    return this.settingsService.streamSettingsImageByAssetType(
      req,
      res,
      SETTINGS_IMAGE_ASSET.PLATFORM_LOGO,
    );
  }

  @Patch("platform-logo")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
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
    @UploadedFile(
      getBaseFileTypePipe(buildFileTypeRegex(ALLOWED_AVATAR_IMAGE_TYPES), FILE_SIZE_BASE).build({
        fileIsRequired: false,
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    logo: Express.Multer.File | null,
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

  @Get("platform-simple-logo/image")
  @Public()
  async getPlatformSimpleLogoImage(@Req() req: Request, @Res() res: Response) {
    return this.settingsService.streamSettingsImageByAssetType(
      req,
      res,
      SETTINGS_IMAGE_ASSET.PLATFORM_SIMPLE_LOGO,
    );
  }

  @Patch("platform-simple-logo")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
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
    @UploadedFile(
      getBaseFileTypePipe(buildFileTypeRegex(ALLOWED_AVATAR_IMAGE_TYPES), FILE_SIZE_BASE).build({
        fileIsRequired: false,
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    logo: Express.Multer.File | null,
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

  @Get("login-background/image")
  @Public()
  async getLoginBackgroundImage(@Req() req: Request, @Res() res: Response) {
    return this.settingsService.streamSettingsImageByAssetType(
      req,
      res,
      SETTINGS_IMAGE_ASSET.LOGIN_BACKGROUND,
    );
  }

  @Patch("login-background")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
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
    @UploadedFile(
      getBaseFileTypePipe(
        buildFileTypeRegex(ALLOWED_LESSON_IMAGE_FILE_TYPES),
        FILE_SIZE_BASE,
      ).build({
        fileIsRequired: false,
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    loginBackground: Express.Multer.File | null,
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
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
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
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
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
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  @UseInterceptors(
    FileInterceptor("certificate-background", {
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
        "certificate-background": {
          type: "string",
          format: "binary",
          nullable: true,
        },
      },
    },
  })
  async updateCertificateBackground(
    @UploadedFile(
      getBaseFileTypePipe(
        buildFileTypeRegex(ALLOWED_LESSON_IMAGE_FILE_TYPES),
        FILE_SIZE_BASE,
      ).build({
        fileIsRequired: false,
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    certificateBackground: Express.Multer.File | null,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GlobalSettingsJSONContentSchema>> {
    return new BaseResponse(
      await this.settingsService.updateCertificateBackground(certificateBackground, currentUser),
    );
  }

  @Get("certificate-background/image")
  @Public()
  async getCertificateBackgroundImage(@Req() req: Request, @Res() res: Response) {
    return this.settingsService.streamSettingsImageByAssetType(
      req,
      res,
      SETTINGS_IMAGE_ASSET.CERTIFICATE_BACKGROUND,
    );
  }

  @Patch("admin/default-course-currency")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
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
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  async updateInviteOnlyRegistration(@CurrentUser() currentUser: CurrentUserType) {
    return new BaseResponse(
      await this.settingsService.updateGlobalInviteOnlyRegistration(currentUser),
    );
  }

  @Patch("admin/user-email-triggers/:triggerKey")
  @Validate({
    request: [{ type: "param", name: "triggerKey", schema: Type.String() }],
  })
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  async updateUserEmailTriggers(
    @Param("triggerKey") triggerKey: string,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return new BaseResponse(
      await this.settingsService.updateUserEmailTriggers(triggerKey, currentUser),
    );
  }

  @Patch("admin/config-warning-dismissed")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
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
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  async updateQaSetting(@Param("setting") setting: AllowedQASettings) {
    return new BaseResponse(await this.settingsService.updateQASetting(setting));
  }

  @Patch("admin/news/:setting")
  @Validate({
    request: [{ type: "param", name: "setting", schema: Type.Enum(ALLOWED_NEWS_SETTINGS) }],
  })
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  async updateNewsSetting(@Param("setting") setting: AllowedNewsSettings) {
    return new BaseResponse(await this.settingsService.updateNewsSetting(setting));
  }

  @Patch("admin/articles/:setting")
  @Validate({
    request: [{ type: "param", name: "setting", schema: Type.Enum(ALLOWED_ARTICLES_SETTINGS) }],
  })
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  async updateArticlesSetting(@Param("setting") setting: AllowedArticlesSettings) {
    return new BaseResponse(await this.settingsService.updateArticlesSetting(setting));
  }

  @Patch("admin/discussions/:setting")
  @Validate({
    request: [{ type: "param", name: "setting", schema: Type.Enum(ALLOWED_DISCUSSIONS_SETTINGS) }],
  })
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  async updateDiscussionsSetting(@Param("setting") setting: AllowedDiscussionsSettings) {
    return new BaseResponse(await this.settingsService.updateDiscussionsSetting(setting));
  }

  @Patch("admin/age-limit")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  @Validate({
    request: [{ type: "body", schema: updateAgeLimitSchema }],
  })
  async updateAgeLimit(
    @Body() body: UpdateAgeLimitBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GlobalSettingsJSONContentSchema>> {
    const updatedGlobalSettings = await this.settingsService.updateAgeLimit(
      body.ageLimit,
      currentUser,
    );

    return new BaseResponse(updatedGlobalSettings);
  }

  @Patch("admin/login-page-files")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        id: { type: "string", format: "uuid" },
        name: { type: "string", minLength: 1 },
      },
      required: ["file", "name"],
    },
  })
  async updateLoginPageFiles(
    @Body() uploadedData: UploadFilesToLoginPageBody,
    @UploadedFile(
      getBaseFileTypePipe(buildFileTypeRegex(LOGIN_PAGE_DOCUMENTS_FILE_TYPES)).build({
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return this.settingsService.uploadLoginPageFile(uploadedData, file, currentUser);
  }

  @Public()
  @Get("login-page-files")
  @Validate({
    response: loginPageResourceResponseSchema,
  })
  async getLoginPageFiles() {
    return this.settingsService.getLoginPageFiles();
  }

  @Delete("login-page-files/:id")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
  })
  async deleteLoginPageFile(@Param("id") id: UUIDType) {
    return this.settingsService.deleteLoginPageFile(id);
  }
}
