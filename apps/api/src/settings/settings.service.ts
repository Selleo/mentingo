import {
  BadRequestException,
  ConflictException,
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
import { settingsToJsonBuildObject } from "src/utils/settings-to-json-build-object";

import { DEFAULT_ADMIN_SETTINGS, DEFAULT_STUDENT_SETTINGS } from "./constants/settings.constants";

import type {
  GlobalSettingsJSONContentSchema,
  SettingsJSONContentSchema,
  AdminSettingsJSONContentSchema,
} from "./schemas/settings.schema";
import type { UpdateSettingsBody } from "./schemas/update-settings.schema";
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

    return globalSettings.settings;
  }

  public async createSettings(
    userId: UUIDType,
    userRole: UserRole,
    customSettings?: Partial<SettingsJSONContentSchema>,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ) {
    if (!userId) {
      throw new UnauthorizedException("User not authenticated");
    }

    const [existingSettings] = await dbInstance
      .select()
      .from(settings)
      .where(eq(settings.userId, userId));

    if (existingSettings) {
      throw new ConflictException("Settings already exists");
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
        createdAt: new Date().toISOString(),
        settings: settingsToJsonBuildObject(finalSettings),
      })
      .returning({ settings: sql<SettingsJSONContentSchema>`${settings.settings}` });

    return createdSettings;
  }

  public async getUserSettings(userId: UUIDType): Promise<SettingsJSONContentSchema> {
    const [userSettings] = await this.db
      .select({ settings: sql<SettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(eq(settings.userId, userId));

    if (!userSettings) {
      throw new NotFoundException("User settings not found");
    }

    return userSettings.settings;
  }

  public async updateUserSettings(
    userId: UUIDType,
    updatedSettings: UpdateSettingsBody,
  ): Promise<SettingsJSONContentSchema> {
    const [currentUserSettings] = await this.db
      .select({ settings: sql<SettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(eq(settings.userId, userId));

    if (!currentUserSettings) {
      throw new NotFoundException("User settings not found");
    }

    const currentSettings = currentUserSettings.settings;

    const mergedSettings = {
      ...currentSettings,
      ...updatedSettings,
    };

    const [{ settings: newUserSettings }] = await this.db
      .update(settings)
      .set({
        settings: settingsToJsonBuildObject(mergedSettings),
      })
      .where(eq(settings.userId, userId))
      .returning({ settings: sql<SettingsJSONContentSchema>`${settings.settings}` });

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

    return updatedGlobalSettings;
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
