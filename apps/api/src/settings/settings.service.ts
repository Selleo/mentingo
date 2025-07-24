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

import type { CompanyInformationBody } from "./schemas/company-information.schema";
import type {
  AdminSettingsJSONContentSchema,
  SettingsJSONContentSchema,
} from "./schemas/settings.schema";
import type { UpdateSettingsBody } from "./schemas/update-settings.schema";
import type * as schema from "../storage/schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { UUIDType } from "src/common";
import type { UserRole } from "src/user/schemas/userRoles";

@Injectable()
export class SettingsService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

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

    const [createdSettings] = await dbInstance
      .insert(settings)
      .values({
        userId,
        createdAt: new Date().toISOString(),
        settings: settingsToJsonBuildObject(finalSettings),
      })
      .returning();

    return createdSettings;
  }

  public async getUserSettings(userId: UUIDType) {
    const [userSettings] = await this.db.select().from(settings).where(eq(settings.userId, userId));

    if (!userSettings) {
      throw new NotFoundException("User settings not found");
    }

    return userSettings;
  }

  public async updateUserSettings(userId: UUIDType, updatedSettings: UpdateSettingsBody) {
    const [updated] = await this.db
      .update(settings)
      .set({
        settings: settingsToJsonBuildObject(updatedSettings),
      })
      .where(eq(settings.userId, userId))
      .returning();

    if (!updated) {
      throw new NotFoundException("User settings not found");
    }

    return updated;
  }

  public async updateAdminNewUserNotification(userId: UUIDType) {
    const [res] = await this.db
      .select({
        adminNewUserNotification: sql`settings.settings->>'adminNewUserNotification'`,
      })
      .from(settings)
      .where(eq(settings.userId, userId));

    if (!res) {
      throw new NotFoundException("User settings not found");
    }

    const current = res.adminNewUserNotification === "true";

    const [updated] = await this.db
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
      .returning();

    return updated;
  }

  public async getCompanyInformation() {
    const [globalSettings] = await this.db.select().from(settings).where(isNull(settings.userId));

    const settingsData = globalSettings?.settings as AdminSettingsJSONContentSchema | undefined;
    return settingsData?.company_information || {};
  }

  public async updateCompanyInformation(companyInfo: CompanyInformationBody) {
    const [existingGlobal] = await this.db.select().from(settings).where(isNull(settings.userId));

    if (!existingGlobal) {
      throw new NotFoundException("Company information not found");
    }

    const currentSettings = (existingGlobal.settings as AdminSettingsJSONContentSchema) || {};
    const currentCompanyInfo = currentSettings.company_information || {};
    const updatedSettings = {
      ...currentSettings,
      company_information: {
        ...currentCompanyInfo,
        ...companyInfo,
      },
    };

    const [updated] = await this.db
      .update(settings)
      .set({
        settings: updatedSettings,
        updatedAt: new Date().toISOString(),
      })
      .where(isNull(settings.userId))
      .returning();

    return updated;
  }

  private getDefaultSettingsForRole(role: UserRole): SettingsJSONContentSchema {
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
