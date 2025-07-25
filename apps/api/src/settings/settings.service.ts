import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { eq, sql, isNull } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { FileService } from "src/file/file.service";
import { settings } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { settingsToJsonBuildObject } from "src/utils/settings-to-json-build-object";

import {
  DEFAULT_USER_ADMIN_SETTINGS,
  DEFAULT_USER_SETTINGS,
  DEFAULT_GLOBAL_SETTINGS,
} from "./constants/settings.constants";

import type {
  SettingsJSONContentSchema,
  GlobalSettingsJSONContentSchema,
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

  public async getGlobalSettings() {
    const [globalSettings] = await this.db.select().from(settings).where(isNull(settings.userId));

    if (!globalSettings) {
      const [created] = await this.db
        .insert(settings)
        .values({
          userId: null,
          createdAt: new Date().toISOString(),
          settings: settingsToJsonBuildObject(DEFAULT_GLOBAL_SETTINGS),
        })
        .returning();

      return created;
    }

    return globalSettings;
  }

  public async updateGlobalSettings(updatedSettings: Partial<GlobalSettingsJSONContentSchema>) {
    const currentSettings = await this.getGlobalSettings();

    const currentPlatformLogoS3Key = this.extractPlatformLogoS3Key(currentSettings.settings);

    const newSettings: GlobalSettingsJSONContentSchema = {
      platformLogoS3Key: updatedSettings.platformLogoS3Key || currentPlatformLogoS3Key,
    };

    const [updated] = await this.db
      .update(settings)
      .set({
        settings: settingsToJsonBuildObject(newSettings),
      })
      .where(isNull(settings.userId))
      .returning();

    if (!updated) {
      throw new NotFoundException("Global settings not found");
    }

    return updated;
  }

  public async uploadPlatformLogo(file: Express.Multer.File): Promise<void> {
    if (!file) {
      throw new BadRequestException("No logo file provided");
    }

    const resource = "platform-logos";
    const { fileKey } = await this.fileService.uploadFile(file, resource);
    await this.updateGlobalSettings({ platformLogoS3Key: fileKey });
  }

  public async getPlatformLogoUrl(): Promise<string | null> {
    const globalSettings = await this.getGlobalSettings();

    const platformLogoS3Key = this.extractPlatformLogoS3Key(globalSettings.settings);

    if (!platformLogoS3Key) {
      return null;
    }

    return await this.fileService.getFileUrl(platformLogoS3Key);
  }

  private extractPlatformLogoS3Key(settings: unknown): string | undefined {
    if (typeof settings === "object" && settings !== null && "platformLogoS3Key" in settings) {
      const value = (settings as Record<string, unknown>).platformLogoS3Key;
      return typeof value === "string" ? value : undefined;
    }
    return undefined;
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
