import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { eq, isNull, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { settings } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { settingsToJsonBuildObject } from "src/utils/settings-to-json-build-object";

import { DEFAULT_USER_ADMIN_SETTINGS, DEFAULT_USER_SETTINGS } from "./constants/settings.constants";

import type {
  GlobalSettingsJSONContentSchema,
  SettingsJSONContentSchema,
  AdminSettingsJSONContentSchema,
} from "./schemas/settings.schema";
import type { UpdateSettingsBody } from "./schemas/update-settings.schema";
import type * as schema from "../storage/schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { UUIDType } from "src/common";
import type {
  AdminSettings,
  GlobalSettings,
  StudentSettings,
  UserSettings,
} from "src/common/types";
import type { UserRole } from "src/user/schemas/userRoles";

@Injectable()
export class SettingsService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  public async getGlobalSettings(): Promise<GlobalSettingsJSONContentSchema> {
    const [{ settings: rawSettings }] = await this.db
      .select({ settings: settings.settings })
      .from(settings)
      .where(isNull(settings.userId));

    return rawSettings as GlobalSettingsJSONContentSchema;
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
      .returning({ settings: settings.settings });

    return createdSettings;
  }

  public async getUserSettings(userId: UUIDType): Promise<SettingsJSONContentSchema> {
    const [{ settings: userSettings }] = await this.db
      .select({ settings: settings.settings })
      .from(settings)
      .where(eq(settings.userId, userId));

    if (!userSettings) {
      throw new NotFoundException("User settings not found");
    }

    return userSettings as UserSettings;
  }

  public async updateUserSettings(
    userId: UUIDType,
    updatedSettings: UpdateSettingsBody,
  ): Promise<SettingsJSONContentSchema> {
    const [{ settings: currentSettings }] = await this.db
      .select({ settings: settings.settings })
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
        settings: settingsToJsonBuildObject(mergedSettings),
      })
      .where(eq(settings.userId, userId))
      .returning({ settings: settings.settings });

    return newUserSettings as UserSettings;
  }

  public async updateGlobalUnregisteredUserCoursesAccessibility(): Promise<GlobalSettingsJSONContentSchema> {
    const [globalSetting] = await this.db
      .select({
        unregisteredUserCoursesAccessibility: sql`settings.settings->>'unregisteredUserCoursesAccessibility'`,
      })
      .from(settings)
      .where(isNull(settings.userId));

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
      .returning({ settings: settings.settings });

    return updatedGlobalSettings as GlobalSettings;
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
      .returning({ settings: settings.settings });

    return updatedUserSettings as AdminSettings;
  }

  private getDefaultSettingsForRole(role: UserRole): StudentSettings | AdminSettings {
    switch (role) {
      case USER_ROLES.ADMIN:
        return DEFAULT_USER_ADMIN_SETTINGS;
      case USER_ROLES.STUDENT:
        return DEFAULT_USER_SETTINGS;
      default:
        return DEFAULT_USER_SETTINGS;
    }
  }
}
