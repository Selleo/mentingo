import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { settings } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { settingsToJsonBuildObject } from "src/utils/settings-to-json-build-object";

import { DEFAULT_USER_ADMIN_SETTINGS, DEFAULT_USER_SETTINGS } from "./constants/settings.constants";

import type { SettingsJSONContentSchema } from "./schemas/settings.schema";
import type { UpdateSettingsBody } from "./schemas/update-settings.schema";
import type * as schema from "../storage/schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { UUIDType } from "src/common";
import type { UserRole } from "src/user/schemas/userRoles";

@Injectable()
export class SettingsService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private userService: UserService,
    private emailService: EmailService,
  ) {}

  public async notifyAdminsAboutNewUser(user: CommonUser) {
    const { firstName, lastName, email } = user;

    const { text, html } = new NewUserEmail({
      first_name: firstName,
      last_name: lastName,
      email: email,
    });

    const allAdmins = await this.userService.getAdminsWithSettings();

    const adminsToNotify = allAdmins.filter((admin) => {
      return (admin.settings?.settings as UserSettings)?.adminNewUserNotification === true;
    });

    await Promise.all(
      adminsToNotify.map((admin) => {
        return this.emailService.sendEmail({
          to: admin.user.email,
          subject: "A new user has registered on your platform",
          text,
          html,
          from: process.env.SES_EMAIL || "",
        });
      }),
    );
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

    const [existingSettings] = await this.db
      .select()
      .from(settings)
      .where(eq(settings.userId, userId));

    if (existingSettings) {
      throw new ConflictException("Settings already exists");
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

  public async getUserSettings(userId: UUIDType) {
    const [{ settings: userSettings }] = await this.db
      .select({ settings: settings.settings })
      .from(settings)
      .where(eq(settings.userId, userId));

    if (!userSettings) {
      throw new NotFoundException("User settings not found");
    }

    return userSettings;
  }

  public async updateUserSettings(userId: UUIDType, updatedSettings: UpdateSettingsBody) {
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

    const [{ settings: newSettings }] = await this.db
      .update(settings)
      .set({
        settings: settingsToJsonBuildObject(mergedSettings),
      })
      .where(eq(settings.userId, userId))
      .returning({ settings: settings.settings });

    return newSettings;
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

    const [{ settings: updatedSettings }] = await this.db
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

    return updatedSettings;
  }

  private getDefaultSettingsForRole(role: UserRole) {
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
