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
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { DEFAULT_ADMIN_SETTINGS, DEFAULT_STUDENT_SETTINGS } from "./constants/settings.constants";

import type { CompanyInformaitonJSONSchema } from "./schemas/company-information.schema";
import type {
  SettingsJSONContentSchema,
  GlobalSettingsJSONContentSchema,
  AdminSettingsJSONContentSchema,
  UserSettingsJSONContentSchema,
} from "./schemas/settings.schema";
import type { UpdateSettingsBody } from "./schemas/update-settings.schema";
import type * as schema from "../storage/schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { UUIDType } from "src/common";
import type { UserRole } from "src/user/schemas/userRoles";

@Injectable()
export class SettingsService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  public async getGlobalSettings(): Promise<GlobalSettingsJSONContentSchema> {
    const [{ settings: globalSettings }] = await this.db
      .select({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(isNull(settings.userId));

    return globalSettings;
  }

  public async getUserSettings(userId: UUIDType): Promise<UserSettingsJSONContentSchema> {
    const row = await this.db
      .select({ settings: sql<UserSettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(eq(settings.userId, userId));

    const [{ settings: userSettings }] = row;

    if (!userSettings) {
      throw new NotFoundException("User settings not found");
    }
    return userSettings;
  }

  public async createSettings(
    userId: UUIDType | null,
    userRole: UserRole,
    customSettings?: Partial<SettingsJSONContentSchema>,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ): Promise<SettingsJSONContentSchema> {
    if (userId !== null && !userId) {
      throw new UnauthorizedException("User not authenticated");
    }

    const [existingSettings] = await dbInstance
      .select()
      .from(settings)
      .where(userId === null ? isNull(settings.userId) : eq(settings.userId, userId));

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
        settings: settingsToJSONBuildObject(finalSettings),
      })
      .returning({ settings: sql<SettingsJSONContentSchema>`${settings.settings}` });

    return createdSettings;
  }

  public async updateUserSettings(
    userId: UUIDType,
    updatedSettings: UpdateSettingsBody,
  ): Promise<UserSettingsJSONContentSchema> {
    const [{ settings: currentSettings }] = await this.db
      .select({ settings: sql<UserSettingsJSONContentSchema>`${settings.settings}` })
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

  private getDefaultSettingsForRole(role: UserRole) {
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
