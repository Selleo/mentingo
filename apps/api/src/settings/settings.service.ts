import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { NewUserEmail } from "@repo/email-templates";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { settings } from "src/storage/schema";
import { UserService } from "src/user/user.service";

import type { SettingsJSONContentSchema } from "./schemas/settings.schema";
import type { UpdateSettingsBody } from "./schemas/update-settings.schema";
import type * as schema from "../storage/schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { UUIDType } from "src/common";
import type { CommonUser } from "src/common/schemas/common-user.schema";
import type { UserSettings } from "src/common/types";

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
    createSettings?: SettingsJSONContentSchema,
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

    const [createdSettings] = await dbInstance
      .insert(settings)
      .values({
        userId,
        createdAt: new Date().toISOString(),
        settings: createSettings ?? {},
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

    const currentNotificationSetting = userSettings.settings.adminNewUserNotification;
    const updatedSettings = {
      ...userSettings.settings,
      adminNewUserNotification: !currentNotificationSetting,
    };

    const [updated] = await this.db
      .update(settings)
      .set({ settings: updatedSettings })
      .where(eq(settings.userId, userId))
      .returning();

    return updated;
  }
}
