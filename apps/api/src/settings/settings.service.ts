import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { eq, isNull } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { settings } from "src/storage/schema";

import type { CompanyInformationBody } from "./schemas/company-information.schema";
import type { SettingsJSONContentSchema } from "./schemas/settings.schema";
import type { UUIDType } from "src/common";

@Injectable()
export class SettingsService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  public async createSettings(
    userId: UUIDType | null,
    createSettings?: SettingsJSONContentSchema,
    trx?: any,
  ) {
    if (userId !== null && !userId) {
      throw new UnauthorizedException("User not authenticated");
    }

    const [existingSettings] = await this.db
      .select()
      .from(settings)
      .where(userId === null ? isNull(settings.userId) : eq(settings.userId, userId));

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

  public async getCompanyInformation() {
    const [globalSettings] = await this.db.select().from(settings).where(isNull(settings.userId));

    const settingsData = globalSettings?.settings as SettingsJSONContentSchema | undefined;
    return settingsData?.company_information || {};
  }

  public async createCompanyInformation(companyInfo: CompanyInformationBody) {
    const [existingGlobal] = await this.db.select().from(settings).where(isNull(settings.userId));

    if (existingGlobal) {
      throw new ConflictException("Company information already exists");
    }

    const [createdSettings] = await this.db
      .insert(settings)
      .values({
        userId: null,
        createdAt: new Date().toISOString(),
        settings: { company_information: companyInfo },
      })
      .returning();

    return createdSettings;
  }

  public async updateCompanyInformation(companyInfo: CompanyInformationBody) {
    const [existingGlobal] = await this.db.select().from(settings).where(isNull(settings.userId));

    if (!existingGlobal) {
      throw new NotFoundException("Company information not found");
    }

    const currentSettings = (existingGlobal.settings as SettingsJSONContentSchema) || {};
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
}
