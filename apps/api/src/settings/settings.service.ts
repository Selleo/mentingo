import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { eq, isNull, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { FileService } from "src/file/file.service";
import { settings } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { DEFAULT_ADMIN_SETTINGS, DEFAULT_STUDENT_SETTINGS } from "./constants/settings.constants";

import type { CompanyInformaitonJSONSchema } from "./schemas/company-information.schema";
import type {
  SettingsJSONContentSchema,
  GlobalSettingsJSONContentSchema,
  AdminSettingsJSONContentSchema,
  UserSettingsJSONContentSchema,
} from "./schemas/settings.schema";
import type {
  UpdateMFAEnforcedRolesRequest,
  UpdateSettingsBody,
} from "./schemas/update-settings.schema";
import type * as schema from "../storage/schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { UUIDType } from "src/common";
import type { UserRole } from "src/user/schemas/userRoles";

@Injectable()
export class SettingsService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly fileService: FileService,
  ) {}

  public async getGlobalSettings(): Promise<GlobalSettingsJSONContentSchema> {
    const [globalSettings] = await this.db
      .select({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(isNull(settings.userId));

    if (!globalSettings) {
      throw new NotFoundException("Global settings not found");
    }

    const parsedSettings = {
      ...globalSettings.settings,
      MFAEnforcedRoles: Array.isArray(globalSettings.settings.MFAEnforcedRoles)
        ? globalSettings.settings.MFAEnforcedRoles
        : JSON.parse(globalSettings.settings.MFAEnforcedRoles ?? "[]"),
    };

    const { certificateBackgroundImage, ...restOfSettings } = parsedSettings;

    const certificateBackgroundSignedUrl = certificateBackgroundImage
      ? await this.fileService.getFileUrl(certificateBackgroundImage)
      : null;

    return { ...restOfSettings, certificateBackgroundImage: certificateBackgroundSignedUrl };
  }

  public async createSettingsIfNotExists(
    userId: UUIDType | null,
    userRole: UserRole,
    customSettings?: Partial<SettingsJSONContentSchema>,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ): Promise<SettingsJSONContentSchema> {
    if (userId !== null && !userId) {
      throw new UnauthorizedException("User not authenticated");
    }

    const [existingSettings] = await dbInstance
      .select({ settings: sql<SettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(userId === null ? isNull(settings.userId) : eq(settings.userId, userId));

    if (existingSettings) {
      return existingSettings.settings;
    }

    const defaultSettings = this.getDefaultSettingsForRole(userRole);

    const finalSettings = {
      ...defaultSettings,
      ...customSettings,
    };

    const [{ settings: createdSettings }] = await dbInstance
      .insert(settings)
      .values({
        userId,
        settings: settingsToJSONBuildObject(finalSettings),
      })
      .returning({ settings: sql<SettingsJSONContentSchema>`${settings.settings}` });

    return createdSettings;
  }

  public async getUserSettings(userId: UUIDType): Promise<SettingsJSONContentSchema> {
    const [{ settings: userSettings }] = await this.db
      .select({ settings: sql<SettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(eq(settings.userId, userId));

    if (!userSettings) {
      throw new NotFoundException("User settings not found");
    }

    return userSettings;
  }

  public async updateUserSettings(
    userId: UUIDType,
    updatedSettings: UpdateSettingsBody,
  ): Promise<SettingsJSONContentSchema> {
    const [{ settings: currentSettings }] = await this.db
      .select({ settings: sql<SettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(eq(settings.userId, userId));

    if (!currentSettings) {
      throw new NotFoundException("User settings not found");
    }

    const mergedSettings = {
      ...currentSettings,
      ...updatedSettings,
    };

    const [{ settings: newUserSettings }] = await this.db
      .update(settings)
      .set({
        settings: settingsToJSONBuildObject(mergedSettings),
      })
      .where(eq(settings.userId, userId))
      .returning({ settings: sql<UserSettingsJSONContentSchema>`${settings.settings}` });

    return newUserSettings;
  }

  public async updateGlobalUnregisteredUserCoursesAccessibility(): Promise<GlobalSettingsJSONContentSchema> {
    const [globalSetting] = await this.db
      .select({
        unregisteredUserCoursesAccessibility: sql`settings.settings->>'unregisteredUserCoursesAccessibility'`,
      })
      .from(settings)
      .where(isNull(settings.userId));

    if (!globalSetting) {
      throw new NotFoundException("Global settings not found");
    }
    const current = globalSetting.unregisteredUserCoursesAccessibility === "true";

    const [{ settings: updatedGlobalSettings }] = await this.db
      .update(settings)
      .set({
        settings: sql`
        jsonb_set(
          settings.settings,
          '{unregisteredUserCoursesAccessibility}',
          to_jsonb(${!current}),
          true
        )
      `,
      })
      .where(isNull(settings.userId))
      .returning({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` });

    const parsedSettings = {
      ...updatedGlobalSettings,
      MFAEnforcedRoles: Array.isArray(updatedGlobalSettings.MFAEnforcedRoles)
        ? updatedGlobalSettings.MFAEnforcedRoles
        : JSON.parse(updatedGlobalSettings.MFAEnforcedRoles ?? "[]"),
    };

    return parsedSettings;
  }

  public async updateAdminNewUserNotification(
    userId: UUIDType,
  ): Promise<AdminSettingsJSONContentSchema> {
    const [userSetting] = await this.db
      .select({
        adminNewUserNotification: sql`settings.settings->>'adminNewUserNotification'`,
      })
      .from(settings)
      .where(eq(settings.userId, userId));

    if (!userSetting) {
      throw new NotFoundException("User settings not found");
    }
    const current = userSetting.adminNewUserNotification === "true";

    const [{ settings: updatedUserSettings }] = await this.db
      .update(settings)
      .set({
        settings: sql`
          jsonb_set(
            settings.settings,
            '{adminNewUserNotification}',
            to_jsonb(${!current}),
            true
          )
        `,
      })
      .where(eq(settings.userId, userId))
      .returning({ settings: sql<AdminSettingsJSONContentSchema>`${settings.settings}` });

    return updatedUserSettings;
  }

  public async updateGlobalEnforceSSO(): Promise<GlobalSettingsJSONContentSchema> {
    const [globalSettings] = await this.db
      .select({
        enforceSSO: sql<boolean>`(settings.settings->>'enforceSSO')::boolean`,
      })
      .from(settings)
      .where(isNull(settings.userId));

    if (!globalSettings) {
      throw new NotFoundException("Global settings not found");
    }

    const [{ settings: updatedGlobalSettings }] = await this.db
      .update(settings)
      .set({
        settings: sql`
          jsonb_set(
            settings.settings,
            '{enforceSSO}',
            to_jsonb(${!globalSettings.enforceSSO}::boolean),
            true
          )
        `,
      })
      .where(isNull(settings.userId))
      .returning({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` });

    const parsedSettings = {
      ...updatedGlobalSettings,
      MFAEnforcedRoles: Array.isArray(updatedGlobalSettings.MFAEnforcedRoles)
        ? updatedGlobalSettings.MFAEnforcedRoles
        : JSON.parse(updatedGlobalSettings.MFAEnforcedRoles ?? "[]"),
    };

    return parsedSettings;
  }

  public async uploadPlatformLogo(file: Express.Multer.File): Promise<void> {
    if (!file) {
      throw new BadRequestException("No logo file provided");
    }

    const resource = "platform-logos";
    const { fileKey } = await this.fileService.uploadFile(file, resource);

    await this.db
      .update(settings)
      .set({
        settings: sql`
          jsonb_set(
            settings.settings,
            '{platformLogoS3Key}',
            to_jsonb(${fileKey}::text),
            true
          )
        `,
      })
      .where(isNull(settings.userId));
  }

  public async getPlatformLogoUrl(): Promise<string | null> {
    const globalSettings = await this.getGlobalSettings();

    const platformLogoS3Key = globalSettings.platformLogoS3Key;

    if (!platformLogoS3Key) {
      return null;
    }

    return await this.fileService.getFileUrl(platformLogoS3Key);
  }

  public async getCompanyInformation(): Promise<CompanyInformaitonJSONSchema> {
    const [{ companyInformation }] = await this.db
      .select({
        companyInformation: sql<CompanyInformaitonJSONSchema>`${settings.settings}->'companyInformation'`,
      })
      .from(settings)
      .where(isNull(settings.userId));

    return companyInformation;
  }

  public async updateCompanyInformation(
    companyInfo: CompanyInformaitonJSONSchema,
  ): Promise<CompanyInformaitonJSONSchema> {
    const [existingGlobal] = await this.db
      .select({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(isNull(settings.userId));

    if (!existingGlobal) {
      throw new NotFoundException("Company information not found");
    }

    const currentSettings = existingGlobal.settings || {};
    const currentCompanyInfo = currentSettings.companyInformation || {};

    const updatedSettings = {
      ...currentSettings,
      companyInformation: {
        ...currentCompanyInfo,
        ...companyInfo,
      },
    };

    const [updated] = await this.db
      .update(settings)
      .set({
        settings: settingsToJSONBuildObject(updatedSettings),
        updatedAt: new Date().toISOString(),
      })
      .where(isNull(settings.userId))
      .returning({
        companyInformation: sql<CompanyInformaitonJSONSchema>`${settings.settings}->'companyInformation'`,
      });

    return updated.companyInformation;
  }

  async updateMFAEnforcedRoles(
    rolesRequest: UpdateMFAEnforcedRolesRequest,
  ): Promise<GlobalSettingsJSONContentSchema> {
    const [existingGlobalSettings] = await this.db
      .select({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(isNull(settings.userId));

    if (!existingGlobalSettings) {
      throw new NotFoundException("Global settings not found");
    }

    const enforcedRoles: UserRole[] = [];

    Object.entries(rolesRequest).forEach(([role, shouldEnforce]) => {
      if (shouldEnforce === true) enforcedRoles.push(role as UserRole);
    });

    const [{ settings: updatedSettings }] = await this.db
      .update(settings)
      .set({
        settings: sql`jsonb_set(
          settings.settings,
          '{MFAEnforcedRoles}',
          to_jsonb(${JSON.stringify(enforcedRoles)}::jsonb),
          true
        )`,
      })
      .where(isNull(settings.userId))
      .returning({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` });

    return updatedSettings;
  }

  async updateCertificateBackground(
    certificateBackground: Express.Multer.File,
  ): Promise<GlobalSettingsJSONContentSchema> {
    let certificateBackgroundValue: string | null = null;

    if (certificateBackground) {
      const { fileKey } = await this.fileService.uploadFile(
        certificateBackground,
        "certificate-backgrounds",
      );
      certificateBackgroundValue = fileKey;
    }

    const [{ settings: updatedSettings }] = await this.db
      .update(settings)
      .set({
        settings: sql`
          jsonb_set(
            settings.settings,
            '{certificateBackgroundImage}',
            ${
              certificateBackgroundValue
                ? sql`to_jsonb(${certificateBackgroundValue}::text)`
                : sql`'null'::jsonb`
            },
            true
          )
        `,
      })
      .where(isNull(settings.userId))
      .returning({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` });

    return updatedSettings;
  }

  public async updateAdminFinishedCourseNotification(
    userId: UUIDType,
  ): Promise<AdminSettingsJSONContentSchema> {
    const [currentUserSettings] = await this.db
      .select({
        adminFinishedCourseNotification: sql<boolean>`(settings.settings->>'adminFinishedCourseNotification')::boolean`,
      })
      .from(settings)
      .where(eq(settings.userId, userId));

    if (!currentUserSettings) {
      throw new NotFoundException("User settings not found");
    }

    const [{ settings: updatedUserSettings }] = await this.db
      .update(settings)
      .set({
        settings: sql`
          jsonb_set(
            settings.settings,
            '{adminFinishedCourseNotification}',
            to_jsonb(${!currentUserSettings.adminFinishedCourseNotification}::boolean),
            true
          )
        `,
      })
      .where(eq(settings.userId, userId))
      .returning({ settings: sql<AdminSettingsJSONContentSchema>`${settings.settings}` });

    return updatedUserSettings;
  }

  private getDefaultSettingsForRole(role: UserRole): SettingsJSONContentSchema {
    switch (role) {
      case USER_ROLES.ADMIN:
        return DEFAULT_ADMIN_SETTINGS;
      case USER_ROLES.STUDENT:
        return DEFAULT_STUDENT_SETTINGS;
      default:
        return DEFAULT_STUDENT_SETTINGS;
    }
  }
}
