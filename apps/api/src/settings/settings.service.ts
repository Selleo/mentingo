import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { ALLOWED_QA_SETTINGS } from "@repo/shared";
import { eq, isNull, sql } from "drizzle-orm";
import { isEqual } from "lodash";
import sharp from "sharp";

import { CORS_ORIGIN } from "src/auth/consts";
import { DatabasePg } from "src/common";
import { UpdateSettingsEvent } from "src/events";
import { FileService } from "src/file/file.service";
import { settings } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import {
  DEFAULT_ADMIN_SETTINGS,
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_STUDENT_SETTINGS,
} from "./constants/settings.constants";

import type { CompanyInformaitonJSONSchema } from "./schemas/company-information.schema";
import type {
  SettingsJSONContentSchema,
  GlobalSettingsJSONContentSchema,
  AdminSettingsJSONContentSchema,
  UserSettingsJSONContentSchema,
  UserEmailTriggersSchema,
} from "./schemas/settings.schema";
import type {
  AllowedCurrency,
  UpdateMFAEnforcedRolesRequest,
  UpdateSettingsBody,
} from "./schemas/update-settings.schema";
import type * as schema from "../storage/schema";
import type { AllowedQASettings } from "@repo/shared";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { SettingsActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";
import type { LoginBackgroundResponseBody } from "src/settings/schemas/login-background.schema";
import type { UserRole } from "src/user/schemas/userRoles";

@Injectable()
export class SettingsService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly fileService: FileService,
    private readonly eventBus: EventBus,
  ) {}

  public async getGlobalSettings(): Promise<GlobalSettingsJSONContentSchema> {
    const [globalSettings] = await this.db
      .select({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(isNull(settings.userId));

    if (!globalSettings) {
      throw new NotFoundException("Global settings not found");
    }

    const parsedSettings = this.parseGlobalSettings(globalSettings.settings);

    const {
      certificateBackgroundImage,
      platformLogoS3Key,
      platformSimpleLogoS3Key,
      loginBackgroundImageS3Key,
      userEmailTriggers,
      ...restOfSettings
    } = parsedSettings;

    const reorderedEmailTriggers = this.reorderEmailTriggers(userEmailTriggers);

    const certificateBackgroundSignedUrl = certificateBackgroundImage
      ? await this.fileService.getFileUrl(certificateBackgroundImage)
      : null;

    const platformLogoUrl = platformLogoS3Key
      ? await this.fileService.getFileUrl(platformLogoS3Key)
      : null;

    const platformSimpleLogoUrl = platformSimpleLogoS3Key
      ? await this.fileService.getFileUrl(platformSimpleLogoS3Key)
      : null;

    const loginBackgroundSignedUrl = loginBackgroundImageS3Key
      ? await this.fileService.getFileUrl(loginBackgroundImageS3Key)
      : null;

    return {
      ...restOfSettings,
      userEmailTriggers: reorderedEmailTriggers,
      platformLogoS3Key: platformLogoUrl,
      platformSimpleLogoS3Key: platformSimpleLogoUrl,
      loginBackgroundImageS3Key: loginBackgroundSignedUrl,
      certificateBackgroundImage: certificateBackgroundSignedUrl,
    };
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

  public async updateGlobalUnregisteredUserCoursesAccessibility(
    actor?: CurrentUser,
  ): Promise<GlobalSettingsJSONContentSchema> {
    const previousRecord = await this.getGlobalSettingsRecord();

    const current = previousRecord.settings.unregisteredUserCoursesAccessibility;

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

    const updatedRecord = await this.getGlobalSettingsRecord();

    await this.recordSettingsUpdate({
      actor,
      previousSnapshot: this.buildSettingsSnapshot(previousRecord),
      updatedSnapshot: updatedRecord ? this.buildSettingsSnapshot(updatedRecord) : null,
    });

    return this.parseGlobalSettings(updatedGlobalSettings);
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

  public async updateGlobalColorSchema(
    primaryColor: string,
    contrastColor: string,
    actor?: CurrentUser,
  ): Promise<GlobalSettingsJSONContentSchema> {
    const previousRecord = await this.getGlobalSettingsRecord();

    const [{ settings: updatedGlobalSettings }] = await this.db
      .update(settings)
      .set({
        settings: sql`
          settings.settings || to_jsonb(${{ primaryColor, contrastColor }}::jsonb)
        `,
      })
      .where(isNull(settings.userId))
      .returning({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` });

    const updatedRecord = await this.getGlobalSettingsRecord();

    await this.recordSettingsUpdate({
      actor,
      previousSnapshot: this.buildSettingsSnapshot(previousRecord),
      updatedSnapshot: updatedRecord ? this.buildSettingsSnapshot(updatedRecord) : null,
    });

    return this.parseGlobalSettings(updatedGlobalSettings);
  }

  public async updateGlobalEnforceSSO(
    actor?: CurrentUser,
  ): Promise<GlobalSettingsJSONContentSchema> {
    const previousRecord = await this.getGlobalSettingsRecord();

    const enforceSSO = previousRecord.settings.enforceSSO;

    const [{ settings: updatedGlobalSettings }] = await this.db
      .update(settings)
      .set({
        settings: sql`
          jsonb_set(
            settings.settings,
            '{enforceSSO}',
            to_jsonb(${!enforceSSO}::boolean),
            true
          )
        `,
      })
      .where(isNull(settings.userId))
      .returning({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` });

    const updatedRecord = await this.getGlobalSettingsRecord();

    await this.recordSettingsUpdate({
      actor,
      previousSnapshot: this.buildSettingsSnapshot(previousRecord),
      updatedSnapshot: updatedRecord ? this.buildSettingsSnapshot(updatedRecord) : null,
    });

    return this.parseGlobalSettings(updatedGlobalSettings);
  }

  public async uploadPlatformLogo(
    file: Express.Multer.File | null | undefined,
    actor?: CurrentUser,
  ): Promise<void> {
    const previousRecord = await this.getGlobalSettingsRecord();

    let newValue: string | null = null;
    if (file) {
      const resource = "platform-logos";
      const { fileKey } = await this.fileService.uploadFile(file, resource);
      newValue = fileKey;
    }

    await this.db
      .update(settings)
      .set({
        settings: sql`
          jsonb_set(
            settings.settings,
            '{platformLogoS3Key}',
            ${newValue ? sql`to_jsonb(${newValue}::text)` : sql`'null'::jsonb`},
            true
          )
        `,
      })
      .where(isNull(settings.userId));

    const updatedRecord = await this.getGlobalSettingsRecord();

    await this.recordSettingsUpdate({
      actor,
      previousSnapshot: this.buildSettingsSnapshot(previousRecord),
      updatedSnapshot: this.buildSettingsSnapshot(updatedRecord),
    });
  }

  public async getPlatformLogoUrl(): Promise<string | null> {
    const globalSettings = await this.getGlobalSettings();

    return globalSettings.platformLogoS3Key;
  }

  public async getPlatformLogoBuffer(): Promise<Buffer | null> {
    const [globalSettings] = await this.db
      .select({
        platformLogoS3Key: sql<string | null>`${settings.settings}->>'platformLogoS3Key'`,
      })
      .from(settings)
      .where(isNull(settings.userId));

    if (!globalSettings?.platformLogoS3Key) {
      const defaultLogoUrl = `${CORS_ORIGIN}/app/assets/svgs/app-logo.svg`;
      return await this.fileService.getFileBuffer(defaultLogoUrl);
    }

    return await this.fileService.getFileBuffer(globalSettings.platformLogoS3Key);
  }

  public async uploadPlatformSimpleLogo(
    file: Express.Multer.File | null | undefined,
    actor?: CurrentUser,
  ): Promise<void> {
    const previousRecord = await this.getGlobalSettingsRecord();

    let newValue: string | null = null;
    if (file) {
      const resource = "platform-simple-logos";
      const { fileKey } = await this.fileService.uploadFile(file, resource);
      newValue = fileKey;
    }

    await this.db
      .update(settings)
      .set({
        settings: sql`
          jsonb_set(
            settings.settings,
            '{platformSimpleLogoS3Key}',
            ${newValue ? sql`to_jsonb(${newValue}::text)` : sql`'null'::jsonb`},
            true
          )
        `,
      })
      .where(isNull(settings.userId));

    const updatedRecord = await this.getGlobalSettingsRecord();

    await this.recordSettingsUpdate({
      actor,
      previousSnapshot: this.buildSettingsSnapshot(previousRecord),
      updatedSnapshot: this.buildSettingsSnapshot(updatedRecord),
    });
  }

  public async getPlatformSimpleLogoUrl(): Promise<string | null> {
    const globalSettings = await this.getGlobalSettings();

    const platformSimpleLogoS3Key = globalSettings.platformSimpleLogoS3Key;

    if (!platformSimpleLogoS3Key) {
      return null;
    }

    return await this.fileService.getFileUrl(platformSimpleLogoS3Key);
  }

  public async getPlatformSimpleLogoBuffer(): Promise<Buffer | null> {
    const [globalSettings] = await this.db
      .select({
        platformSimpleLogoS3Key: sql<
          string | null
        >`${settings.settings}->>'platformSimpleLogoS3Key'`,
      })
      .from(settings)
      .where(isNull(settings.userId));

    const defaultLogoUrl = `${CORS_ORIGIN}/app/assets/svgs/app-email-logo.svg`;

    const buffer: Buffer | null = await this.fileService.getFileBuffer(
      globalSettings.platformSimpleLogoS3Key || defaultLogoUrl,
    );

    if (!buffer) {
      return null;
    }

    const imageMeta = await sharp(buffer, { density: 300 }).metadata();

    const imageHeight = imageMeta.height;
    const imageWidth = imageMeta.width;
    const halfImageHeight = Math.round(imageHeight / 2);

    const resizedBuffer = await sharp(buffer, { density: 300 })
      .extract({
        left: 0,
        top: halfImageHeight - 15,
        width: imageWidth,
        height: halfImageHeight + 14,
      })
      .composite([
        {
          input: Buffer.from(
            `<svg width="${imageWidth}" height="${halfImageHeight + 14}">
          <rect width="100%" height="100%" fill="white" fill-opacity="0.4"/>
        </svg>`,
          ),
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer();

    return resizedBuffer;
  }

  public async uploadLoginBackgroundImage(
    file: Express.Multer.File | null | undefined,
    actor?: CurrentUser,
  ): Promise<void> {
    const previousRecord = await this.getGlobalSettingsRecord();

    let newValue: string | null = null;
    if (file) {
      const resource = "login-backgrounds";
      const { fileKey } = await this.fileService.uploadFile(file, resource);
      newValue = fileKey;
    }

    await this.db
      .update(settings)
      .set({
        settings: sql`
          jsonb_set(
            settings.settings,
            '{loginBackgroundImageS3Key}',
            ${newValue ? sql`to_jsonb(${newValue}::text)` : sql`'null'::jsonb`},
            true
          )
        `,
      })
      .where(isNull(settings.userId));

    const updatedRecord = await this.getGlobalSettingsRecord();

    await this.recordSettingsUpdate({
      actor,
      previousSnapshot: this.buildSettingsSnapshot(previousRecord),
      updatedSnapshot: this.buildSettingsSnapshot(updatedRecord),
    });
  }

  public async getLoginBackgroundImageUrl(): Promise<LoginBackgroundResponseBody> {
    const globalSettings = await this.getGlobalSettings();

    return { url: globalSettings.loginBackgroundImageS3Key ?? null };
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
    actor?: CurrentUser,
  ): Promise<CompanyInformaitonJSONSchema> {
    const previousRecord = await this.getGlobalSettingsRecord();

    if (!previousRecord) {
      throw new NotFoundException("Company information not found");
    }

    const currentCompanyInfo = previousRecord.settings.companyInformation;

    const updatedSettings = {
      ...previousRecord.settings,
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

    const updatedRecord = await this.getGlobalSettingsRecord();

    await this.recordSettingsUpdate({
      actor,
      previousSnapshot: this.buildSettingsSnapshot(previousRecord),
      updatedSnapshot: updatedRecord ? this.buildSettingsSnapshot(updatedRecord) : null,
    });

    return updated.companyInformation;
  }

  async updateMFAEnforcedRoles(
    rolesRequest: UpdateMFAEnforcedRolesRequest,
    actor?: CurrentUser,
  ): Promise<GlobalSettingsJSONContentSchema> {
    const previousRecord = await this.getGlobalSettingsRecord();

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

    const updatedRecord = await this.getGlobalSettingsRecord();

    await this.recordSettingsUpdate({
      actor,
      previousSnapshot: this.buildSettingsSnapshot(previousRecord),
      updatedSnapshot: updatedRecord ? this.buildSettingsSnapshot(updatedRecord) : null,
    });

    return updatedSettings;
  }

  async updateCertificateBackground(
    certificateBackground: Express.Multer.File,
    actor?: CurrentUser,
  ): Promise<GlobalSettingsJSONContentSchema> {
    const previousRecord = await this.getGlobalSettingsRecord();

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

    const updatedRecord = await this.getGlobalSettingsRecord();

    await this.recordSettingsUpdate({
      actor,
      previousSnapshot: this.buildSettingsSnapshot(previousRecord),
      updatedSnapshot: updatedRecord ? this.buildSettingsSnapshot(updatedRecord) : null,
    });

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

  public async updateAdminSetOverdueCourseNotificationForUser(
    userId: UUIDType,
  ): Promise<AdminSettingsJSONContentSchema> {
    const [currentUserSettings] = await this.db
      .select({
        adminOverdueCourseNotification: sql<boolean>`(settings.settings->>'adminOverdueCourseNotification')::boolean`,
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
            '{adminOverdueCourseNotification}',
            to_jsonb(${!currentUserSettings.adminOverdueCourseNotification}::boolean),
            true
          )
        `,
      })
      .where(eq(settings.userId, userId))
      .returning({ settings: sql<AdminSettingsJSONContentSchema>`${settings.settings}` });

    return updatedUserSettings;
  }

  async updateDefaultCourseCurrency(
    currency: AllowedCurrency,
    actor?: CurrentUser,
  ): Promise<GlobalSettingsJSONContentSchema> {
    const previousRecord = await this.getGlobalSettingsRecord();

    const [{ settings: updatedSettings }] = await this.db
      .update(settings)
      .set({
        settings: sql`jsonb_set(
          settings.settings,
          '{defaultCourseCurrency}',
          to_jsonb(${currency}::text),
          true
        )`,
      })
      .where(isNull(settings.userId))
      .returning({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` });

    const updatedRecord = await this.getGlobalSettingsRecord();

    await this.recordSettingsUpdate({
      actor,
      previousSnapshot: this.buildSettingsSnapshot(previousRecord),
      updatedSnapshot: this.buildSettingsSnapshot(updatedRecord),
    });

    return updatedSettings;
  }

  async updateGlobalInviteOnlyRegistration(actor?: CurrentUser) {
    const previousRecord = await this.getGlobalSettingsRecord();

    const globalSettings = previousRecord.settings as GlobalSettingsJSONContentSchema;

    const [{ settings: updatedGlobalSettings }] = await this.db
      .update(settings)
      .set({
        settings: sql`
          jsonb_set(
            settings.settings,
            '{inviteOnlyRegistration}',
            to_jsonb(${!globalSettings.inviteOnlyRegistration}::boolean),
            true
          )
        `,
      })
      .where(isNull(settings.userId))
      .returning({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` });

    const updatedRecord = await this.getGlobalSettingsRecord();

    await this.recordSettingsUpdate({
      actor,
      previousSnapshot: this.buildSettingsSnapshot(previousRecord),
      updatedSnapshot: this.buildSettingsSnapshot(updatedRecord),
    });

    return updatedGlobalSettings;
  }

  async updateUserEmailTriggers(triggerKey: string, actor?: CurrentUser) {
    if (!Object.keys(DEFAULT_GLOBAL_SETTINGS.userEmailTriggers).includes(triggerKey)) {
      throw new BadRequestException("Invalid trigger key");
    }

    const previousRecord = await this.getGlobalSettingsRecord();

    const previousTriggers =
      (previousRecord.settings as GlobalSettingsJSONContentSchema).userEmailTriggers ||
      DEFAULT_GLOBAL_SETTINGS.userEmailTriggers;

    const triggerToUpdate = previousTriggers[triggerKey as keyof typeof previousTriggers];

    const [{ settings: updatedGlobalSettings }] = await this.db
      .update(settings)
      .set({
        settings: sql`
          jsonb_set(
            settings.settings,
            '{userEmailTriggers,${sql.raw(triggerKey)}}',
            to_jsonb(${!triggerToUpdate}::boolean),
            true
          )
        `,
      })
      .where(isNull(settings.userId))
      .returning({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` });

    const updatedRecord = await this.getGlobalSettingsRecord();

    await this.recordSettingsUpdate({
      actor,
      previousSnapshot: this.buildSettingsSnapshot(previousRecord),
      updatedSnapshot: this.buildSettingsSnapshot(updatedRecord),
    });

    return updatedGlobalSettings;
  }

  async getEmailBorderCircleBuffer(): Promise<Buffer | null> {
    const defaultLogoUrl = `${CORS_ORIGIN}/app/assets/svgs/app-email-border-circle.svg`;
    let svgText: string | null = null;

    try {
      const borderCircleResponse = await fetch(defaultLogoUrl);

      if (!borderCircleResponse.ok) {
        throw new Error(`Unexpected status ${borderCircleResponse.status}`);
      }

      svgText = await borderCircleResponse.text();
    } catch (error) {
      return null;
    }

    const [globalSettings] = await this.db
      .select({
        primaryColor: sql<string | null>`${settings.settings}->>'primaryColor'`,
      })
      .from(settings)
      .where(isNull(settings.userId));

    const primaryColor = globalSettings?.primaryColor || "#4596FD";

    const modifiedSvg = svgText.replace(/currentColor/g, primaryColor);

    const pngBuffer = await sharp(Buffer.from(modifiedSvg, "utf-8"), { density: 300 })
      .resize(230, 119, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    return pngBuffer;
  }

  public async updateConfigWarningDismissed(
    userId: UUIDType,
    dismissed: boolean,
  ): Promise<AdminSettingsJSONContentSchema> {
    const [existingSettings] = await this.db
      .select({ settings: sql<AdminSettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(eq(settings.userId, userId));

    if (!existingSettings) throw new NotFoundException("User settings not found");

    const [{ settings: updatedUserSettings }] = await this.db
      .update(settings)
      .set({
        settings: sql`
          jsonb_set(
            settings.settings,
            '{configWarningDismissed}',
            to_jsonb(${dismissed}::boolean),
            true
          )
        `,
      })
      .where(eq(settings.userId, userId))
      .returning({ settings: sql<AdminSettingsJSONContentSchema>`${settings.settings}` });

    return updatedUserSettings;
  }

  private async getGlobalSettingsRecord(): Promise<{
    id: UUIDType;
    settings: GlobalSettingsJSONContentSchema;
  }> {
    const [record] = await this.db
      .select({
        id: settings.id,
        settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}`,
      })
      .from(settings)
      .where(isNull(settings.userId));

    return record;
  }

  private buildSettingsSnapshot(record: {
    id: UUIDType;
    settings: GlobalSettingsJSONContentSchema;
  }): SettingsActivityLogSnapshot {
    const settingsData = this.parseGlobalSettings(record.settings);

    return {
      id: record.id,
      ...settingsData,
    };
  }

  private async recordSettingsUpdate(params: {
    actor?: CurrentUser;
    previousSnapshot: SettingsActivityLogSnapshot | null;
    updatedSnapshot: SettingsActivityLogSnapshot | null;
    context?: Record<string, string>;
  }) {
    const { actor, previousSnapshot, updatedSnapshot, context } = params;
    if (!actor || !previousSnapshot || !updatedSnapshot) return;
    if (isEqual(previousSnapshot, updatedSnapshot)) return;

    this.eventBus.publish(
      new UpdateSettingsEvent({
        settingsId: updatedSnapshot.id,
        actor,
        previousSettingsData: previousSnapshot,
        updatedSettingsData: updatedSnapshot,
        context,
      }),
    );
  }

  async updateQASetting(setting: AllowedQASettings) {
    const [globalSettings] = await this.db
      .select({
        setting: sql<boolean>`(settings.settings->>(${setting}::text))::boolean`,
        QAEnabled: sql<boolean>`(settings.settings->>'QAEnabled')::boolean`,
      })
      .from(settings)
      .where(isNull(settings.userId));

    if (!globalSettings.QAEnabled && ALLOWED_QA_SETTINGS.QA_ENABLED !== setting) {
      throw new BadRequestException("qaPreferences.toast.QANotEnabled");
    }

    if (!globalSettings) {
      throw new NotFoundException("Global settings not found");
    }

    const [{ settings: updatedGlobalSettings }] = await this.db
      .update(settings)
      .set({
        settings: sql`
          jsonb_set(
            settings.settings,
            ARRAY[${setting}]::text[],
            to_jsonb(${!globalSettings.setting}::boolean),
            true
          )
        `,
      })
      .where(isNull(settings.userId))
      .returning({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` });

    return updatedGlobalSettings;
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

  private parseGlobalSettings(
    settings: GlobalSettingsJSONContentSchema,
  ): GlobalSettingsJSONContentSchema {
    return {
      ...settings,
      MFAEnforcedRoles: Array.isArray(settings.MFAEnforcedRoles)
        ? settings.MFAEnforcedRoles
        : JSON.parse(settings.MFAEnforcedRoles ?? "[]"),
    };
  }

  private reorderEmailTriggers(emailTriggers: UserEmailTriggersSchema) {
    const triggerOrder = Object.keys(DEFAULT_GLOBAL_SETTINGS.userEmailTriggers);
    return Object.fromEntries(
      triggerOrder
        .filter((key) => key in emailTriggers)
        .map((key) => [key, emailTriggers[key as keyof UserEmailTriggersSchema]]),
    ) as UserEmailTriggersSchema;
  }
}
