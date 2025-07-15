import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { settings } from "src/storage/schema";

import type { SettingsJSONContentSchema } from "./schemas/settings.schema";
import type { UUIDType } from "src/common";

@Injectable()
export class SettingsService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  public async createSettings(
    userId: UUIDType,
    createSettings?: SettingsJSONContentSchema,
    trx?: any,
  ) {
    if (!userId) {
      throw new UnauthorizedException("User not authenticated");
    }

    const [existingSettings] = await this.db
      .select()
      .from(settings)
      .where(eq(settings.userId, userId));

    if (existingSettings) {
      throw new ConflictException("Settings already exists");
    }

    const database = trx || this.db;

    const [createdSettings] = await database
      .insert(settings)
      .values({
        userId,
        createdAt: new Date().toISOString(),
        settings: createSettings,
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

  public async updateUserSettings(userId: UUIDType, updatedSettings: SettingsJSONContentSchema) {
    const [updated] = await this.db
      .update(settings)
      .set({ settings: updatedSettings })
      .where(eq(settings.userId, userId))
      .returning();

    if (!updated) {
      throw new NotFoundException("User settings not found");
    }

    return updated;
  }

  public async updateAdminNewUserNotification(userId: UUIDType) {
    const [userSettings] = await this.db.select().from(settings).where(eq(settings.userId, userId));

    if (!userSettings) {
      throw new NotFoundException("User settings not found");
    }

    const currentNotificationSetting = userSettings.settings.admin_new_user_notification;
    const updatedSettings = {
      ...userSettings.settings,
      admin_new_user_notification: !currentNotificationSetting,
    };

    const [updated] = await this.db
      .update(settings)
      .set({ settings: updatedSettings })
      .where(eq(settings.userId, userId))
      .returning();

    return updated;
  }
}
