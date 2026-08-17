import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ALLOWED_ARTICLES_SETTINGS,
  ALLOWED_NEWS_SETTINGS,
  ALLOWED_QA_SETTINGS,
  DASHBOARD_WIDGETS,
  DASHBOARD_DEFAULT_LAYOUTS,
  DASHBOARD_SCHEMA_VERSION,
  DASHBOARD_WIDGET_CATALOG,
  ENTITY_TYPES,
  FORM_TYPES,
  MAX_LOGIN_PAGE_DOCUMENTS,
  PERMISSIONS,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
  FEATURE_SETTINGS_KEYS,
  DASHBOARD_WIDGET_IDS,
} from "@repo/shared";
import { and, asc, count, eq, getTableColumns, inArray, isNull, sql } from "drizzle-orm";
import { isEqual } from "lodash";
import sharp from "sharp";

import { CORS_ORIGIN } from "src/auth/consts";
import { DatabasePg } from "src/common";
import { buildJsonbFieldWithMultipleEntries, setJsonbField } from "src/common/helpers/sqlHelpers";
import { getSupportModeContext } from "src/common/helpers/support-mode-context";
import { EnvService } from "src/env/services/env.service";
import { UpdateSettingsEvent } from "src/events";
import { RESOURCE_CATEGORIES, RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import {
  IMAGE_QUALITY,
  IMAGE_RESIZE_MODES,
  IMAGE_VARIANT_DEFINITIONS,
  PWA_ICON_IMAGE_QUALITY,
  PWA_ICON_IMAGE_VARIANT_DEFINITIONS,
} from "src/file/image-variants/image-variant.constants";
import { isImageQuality } from "src/file/image-variants/image-variant.utils";
import { FILE_DELIVERY_TYPE } from "src/file/types/file-delivery.type";
import { streamFileToResponse } from "src/file/utils/streamFileToResponse";
import { LocalizationService } from "src/localization/localization.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { PermissionsService } from "src/permissions/permissions.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  chapters,
  courses,
  formFields,
  forms,
  permissionUserRoles,
  permissionRoleRuleSets,
  permissionRoles,
  permissionRuleSetPermissions,
  resourceEntity,
  resources,
  settings,
  users,
} from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import {
  DEFAULT_ADMIN_SETTINGS,
  DEFAULT_DASHBOARD_SETTINGS,
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_STUDENT_SETTINGS,
} from "./constants/settings.constants";

import type { CompanyInformaitonJSONSchema } from "./schemas/company-information.schema";
import type { PwaManifest } from "./schemas/pwa-manifest.schema";
import type {
  LocalizedRegistrationFormField,
  LocalizedRegistrationFormResponse,
  RegistrationFormResponse,
  UpdateRegistrationFormBody,
} from "./schemas/registration-form.schema";
import type {
  SettingsJSONContentSchema,
  GlobalSettingsJSONContentSchema,
  AdminSettingsJSONContentSchema,
  UserSettingsJSONContentSchema,
  UserEmailTriggersSchema,
  UploadFilesToLoginPageBody,
  LoginPageResourceResponseBody,
  DashboardWidgetsJSONContentSchema,
  DashboardWidgetsIdsJSONContentSchema,
  DashboardSettingsResponseSchema,
} from "./schemas/settings.schema";
import type {
  AllowedAgeLimit,
  AllowedCurrency,
  UpdateMFAEnforcedRolesRequest,
  UpdateSettingsBody,
  UpdateDashboardSettingsBody,
  ResetDashboardSettingsBody,
} from "./schemas/update-settings.schema";
import type { RegistrationFormFieldDbModel } from "./types/registration-form.types";
import type {
  AllowedArticlesSettings,
  AllowedNewsSettings,
  AllowedQASettings,
  SupportedLanguages,
  PermissionKey,
  DashboardWidgetId,
  LegacyDashboardWidgetDefinition,
  DashboardWidgetType,
  DashboardWidgetDefinition,
  DashboardLayoutWidget,
  DashboardSettings,
  SystemRoleSlug,
} from "@repo/shared";
import type { Request, Response } from "express";
import type { SettingsActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { ImageQuality } from "src/file/image-variants/image-variant.types";
import type { LoginBackgroundResponseBody } from "src/settings/schemas/login-background.schema";
import type {
  CreateSettingsForUsersGroup,
  CreateSettingsForUsersItem,
} from "src/settings/types/create-settings-for-users.types";

const STATIC_SETTINGS_IMAGE_CACHE_CONTROL = "public, max-age=86400";
const GLOBAL_SETTINGS_NOT_FOUND_MESSAGE = "common.toast.globalSettingsNotFound";

export const SETTINGS_IMAGE_ASSET = {
  PLATFORM_LOGO: "platform-logo",
  PLATFORM_SIMPLE_LOGO: "platform-simple-logo",
  LOGIN_BACKGROUND: "login-background",
  CERTIFICATE_BACKGROUND: "certificate-background",
} as const;

export type SettingsImageAssetType =
  (typeof SETTINGS_IMAGE_ASSET)[keyof typeof SETTINGS_IMAGE_ASSET];

export type SettingsImageS3Keys = Pick<
  GlobalSettingsJSONContentSchema,
  | "platformLogoS3Key"
  | "platformSimpleLogoS3Key"
  | "certificateBackgroundImage"
  | "primaryColor"
  | "contrastColor"
>;

@Injectable()
export class SettingsService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly permissionsService: PermissionsService,
    private readonly fileService: FileService,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly localizationService: LocalizationService,
    private readonly envService: EnvService,
  ) {}

  public async getCurrentUserSettings(
    currentUser: CurrentUserType,
  ): Promise<SettingsJSONContentSchema> {
    const { dbInstance, sourceUserId } = getSupportModeContext(currentUser, this.db, this.dbAdmin);

    return this.getUserSettings(sourceUserId, dbInstance);
  }

  public async getGlobalSettings(): Promise<GlobalSettingsJSONContentSchema> {
    const [globalSettings] = await this.db
      .select({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(isNull(settings.userId));

    if (!globalSettings) {
      throw new NotFoundException(GLOBAL_SETTINGS_NOT_FOUND_MESSAGE);
    }

    const parsedSettings = await this.withTrainerRoleUserCount(
      this.parseGlobalSettings(globalSettings.settings),
    );

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
      ? await this.fileService.getFileUrl(certificateBackgroundImage, {
          quality: IMAGE_QUALITY.LG,
        })
      : null;

    const platformLogoUrl = platformLogoS3Key
      ? await this.fileService.getFileUrl(platformLogoS3Key, { quality: IMAGE_QUALITY.SM })
      : null;

    const platformSimpleLogoUrl = platformSimpleLogoS3Key
      ? await this.fileService.getFileUrl(platformSimpleLogoS3Key, {
          quality: IMAGE_QUALITY.XXS,
        })
      : null;

    const loginBackgroundSignedUrl = loginBackgroundImageS3Key
      ? await this.fileService.getFileUrl(loginBackgroundImageS3Key, {
          quality: IMAGE_QUALITY.XL,
        })
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

  public async getImageS3Keys(): Promise<SettingsImageS3Keys> {
    const [globalSettings] = await this.db
      .select({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(isNull(settings.userId));

    if (!globalSettings) {
      throw new NotFoundException(GLOBAL_SETTINGS_NOT_FOUND_MESSAGE);
    }

    const parsedSettings = this.parseGlobalSettings(globalSettings.settings);

    return {
      platformLogoS3Key: parsedSettings.platformLogoS3Key ?? null,
      platformSimpleLogoS3Key: parsedSettings.platformSimpleLogoS3Key ?? null,
      certificateBackgroundImage: parsedSettings.certificateBackgroundImage ?? null,
      primaryColor: parsedSettings.primaryColor ?? null,
      contrastColor: parsedSettings.contrastColor ?? null,
    };
  }

  public async getPublicGlobalSettings(): Promise<GlobalSettingsJSONContentSchema> {
    const [globalSettings] = await this.db
      .select({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(isNull(settings.userId));

    if (!globalSettings) {
      throw new NotFoundException(GLOBAL_SETTINGS_NOT_FOUND_MESSAGE);
    }

    const parsedSettings = await this.withTrainerRoleUserCount(
      this.parseGlobalSettings(globalSettings.settings),
    );

    const {
      certificateBackgroundImage,
      platformLogoS3Key,
      platformSimpleLogoS3Key,
      loginBackgroundImageS3Key,
      userEmailTriggers,
      ...restOfSettings
    } = parsedSettings;

    const reorderedEmailTriggers = this.reorderEmailTriggers(userEmailTriggers);

    return {
      ...restOfSettings,
      userEmailTriggers: reorderedEmailTriggers,
      platformLogoS3Key: this.buildSettingsImageUrl(
        SETTINGS_IMAGE_ASSET.PLATFORM_LOGO,
        platformLogoS3Key,
      ),
      platformSimpleLogoS3Key: this.buildSettingsImageUrl(
        SETTINGS_IMAGE_ASSET.PLATFORM_SIMPLE_LOGO,
        platformSimpleLogoS3Key,
      ),
      loginBackgroundImageS3Key: this.buildSettingsImageUrl(
        SETTINGS_IMAGE_ASSET.LOGIN_BACKGROUND,
        loginBackgroundImageS3Key,
      ),
      certificateBackgroundImage: this.buildSettingsImageUrl(
        SETTINGS_IMAGE_ASSET.CERTIFICATE_BACKGROUND,
        certificateBackgroundImage,
      ),
    };
  }

  public async getGlobalSettingsByTenantId(
    tenantId: UUIDType,
  ): Promise<GlobalSettingsJSONContentSchema> {
    const [globalSettings] = await this.dbAdmin
      .select({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(and(eq(settings.tenantId, tenantId), isNull(settings.userId)));

    if (!globalSettings) {
      throw new NotFoundException(GLOBAL_SETTINGS_NOT_FOUND_MESSAGE);
    }

    const parsedSettings = await this.withTrainerRoleUserCount(
      this.parseGlobalSettings(globalSettings.settings),
      this.dbAdmin,
      tenantId,
    );

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
      ? await this.fileService.getFileUrl(certificateBackgroundImage, {
          quality: IMAGE_QUALITY.LG,
        })
      : null;

    const platformLogoUrl = platformLogoS3Key
      ? await this.fileService.getFileUrl(platformLogoS3Key, { quality: IMAGE_QUALITY.SM })
      : null;

    const platformSimpleLogoUrl = platformSimpleLogoS3Key
      ? await this.fileService.getFileUrl(platformSimpleLogoS3Key, {
          quality: IMAGE_QUALITY.XXS,
        })
      : null;

    const loginBackgroundSignedUrl = loginBackgroundImageS3Key
      ? await this.fileService.getFileUrl(loginBackgroundImageS3Key, {
          quality: IMAGE_QUALITY.XL,
        })
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

  public async isLiveTrainingEnabledForTenant(tenantId: UUIDType): Promise<boolean> {
    const [globalSettings] = await this.dbAdmin
      .select({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(and(eq(settings.tenantId, tenantId), isNull(settings.userId)));

    if (!globalSettings) {
      throw new NotFoundException(GLOBAL_SETTINGS_NOT_FOUND_MESSAGE);
    }

    return this.parseGlobalSettings(globalSettings.settings).liveTrainingEnabled;
  }

  public async getRegistrationForm(
    dbInstance: DatabasePg = this.db,
  ): Promise<RegistrationFormResponse> {
    const fields = await this.getRegistrationFormFields(dbInstance);

    return {
      fields,
    };
  }

  public async getLocalizedRegistrationForm(
    language: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ): Promise<LocalizedRegistrationFormResponse> {
    const fields = await this.getLocalizedRegistrationFormFields(language, dbInstance);

    return {
      fields,
    };
  }

  public async getAdminRegistrationForm(
    dbInstance: DatabasePg = this.db,
  ): Promise<RegistrationFormResponse> {
    const fields = await this.getRegistrationFormFields(dbInstance, { includeArchived: true });

    return {
      fields,
    };
  }

  private async getRegistrationFormFields(
    dbInstance: DatabasePg = this.db,
    options?: { includeArchived?: boolean },
  ): Promise<RegistrationFormFieldDbModel[]> {
    const includeArchived = options?.includeArchived ?? false;
    const registrationFormId = await this.getActiveRegistrationFormId(dbInstance);
    if (!registrationFormId) return [];

    const conditions = [eq(formFields.formId, registrationFormId)];

    if (!includeArchived) {
      conditions.push(eq(formFields.archived, false));
    }

    const fields = await dbInstance
      .select()
      .from(formFields)
      .where(and(...conditions))
      .orderBy(asc(formFields.displayOrder), asc(formFields.createdAt));

    return fields;
  }

  private async getLocalizedRegistrationFormFields(
    language: SupportedLanguages,
    dbInstance: DatabasePg = this.db,
  ): Promise<LocalizedRegistrationFormField[]> {
    const registrationFormId = await this.getActiveRegistrationFormId(dbInstance);
    if (!registrationFormId) return [];

    const conditions = [eq(formFields.formId, registrationFormId), eq(formFields.archived, false)];

    const fields = await dbInstance
      .select({
        ...getTableColumns(formFields),
        label: this.localizationService.getLocalizedSqlField(
          formFields.label,
          language,
          formFields,
        ),
      })
      .from(formFields)
      .where(and(...conditions))
      .orderBy(asc(formFields.displayOrder), asc(formFields.createdAt));

    return fields;
  }

  private async getActiveRegistrationFormId(dbInstance: DatabasePg): Promise<UUIDType | null> {
    const [registrationForm] = await dbInstance
      .select({ id: forms.id })
      .from(forms)
      .where(and(eq(forms.type, FORM_TYPES.REGISTRATION), eq(forms.isActive, true)));

    return registrationForm?.id ?? null;
  }

  public async updateRegistrationForm(
    body: UpdateRegistrationFormBody,
  ): Promise<RegistrationFormResponse> {
    return this.db.transaction(async (trx) => {
      let [registrationForm] = await trx
        .select({ id: forms.id })
        .from(forms)
        .where(and(eq(forms.type, FORM_TYPES.REGISTRATION), eq(forms.isActive, true)));

      if (!registrationForm) {
        [registrationForm] = await trx
          .insert(forms)
          .values({ type: FORM_TYPES.REGISTRATION, isActive: true })
          .returning({ id: forms.id });
      }

      const existingFields = await trx
        .select({
          id: formFields.id,
          baseLanguage: formFields.baseLanguage,
          availableLocales: formFields.availableLocales,
        })
        .from(formFields)
        .where(eq(formFields.formId, registrationForm.id));

      const existingFieldsById = new Map(existingFields.map((field) => [field.id, field]));

      for (const field of body.fields) {
        const existingField = field.id ? existingFieldsById.get(field.id) : undefined;

        const labelJson = buildJsonbFieldWithMultipleEntries(field.label);
        const defaultAvailableLocales = Object.keys(field.label) as SupportedLanguages[];

        const availableLocalesSql =
          field.availableLocales ?? existingField?.availableLocales ?? defaultAvailableLocales;
        const baseLanguageSql =
          field.baseLanguage ?? existingField?.baseLanguage ?? SUPPORTED_LANGUAGES.EN;

        if (field.id && existingField) {
          await trx
            .update(formFields)
            .set({
              type: field.type,
              label: labelJson,
              baseLanguage: baseLanguageSql,
              availableLocales: availableLocalesSql,
              required: field.required,
              displayOrder: field.displayOrder,
              archived: field.archived,
            })
            .where(eq(formFields.id, field.id));
          continue;
        }

        await trx.insert(formFields).values({
          formId: registrationForm.id,
          type: field.type,
          label: labelJson,
          baseLanguage: baseLanguageSql,
          availableLocales: availableLocalesSql,
          required: field.required,
          displayOrder: field.displayOrder,
          archived: field.archived,
        });
      }

      await this.normalizeRegistrationFormFieldDisplayOrder(registrationForm.id, trx);

      return this.getAdminRegistrationForm(trx);
    });
  }

  private async normalizeRegistrationFormFieldDisplayOrder(
    formId: UUIDType,
    dbInstance: DatabasePg,
  ): Promise<void> {
    await dbInstance.execute(sql`
      WITH ranked_form_fields AS (
        SELECT
          id,
          row_number() OVER (ORDER BY display_order, created_at) - 1 AS new_display_order
        FROM ${formFields}
        WHERE form_id = ${formId}
      )
      UPDATE ${formFields} ff
      SET display_order = rff.new_display_order
      FROM ranked_form_fields rff
      WHERE ff.id = rff.id
        AND ff.form_id = ${formId}
    `);
  }

  public async createSettingsIfNotExists(
    userId: UUIDType | null,
    roleSlugs: string[],
    customSettings?: Partial<SettingsJSONContentSchema>,
    dbInstance: DatabasePg = this.db,
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

    const resolvedPermissions = await this.resolvePermissionsForRoleSlugs(roleSlugs, dbInstance);
    const defaultSettings = this.getDefaultSettingsForPermissions(resolvedPermissions);

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

  public async createSettingsForUsers(
    userSettings: CreateSettingsForUsersItem[],
    dbInstance: DatabasePg = this.db,
  ): Promise<void> {
    if (!userSettings.length) return;

    const settingsGroups = new Map<string, CreateSettingsForUsersGroup>();

    for (const userSetting of userSettings) {
      const uniqueRoleSlugs = [...new Set(userSetting.roleSlugs)].sort();

      const key = JSON.stringify({
        roleSlugs: uniqueRoleSlugs,
        customSettings: userSetting.customSettings ?? {},
      });

      const settingsGroup = settingsGroups.get(key);

      if (settingsGroup) {
        settingsGroup.userIds.push(userSetting.userId);
        continue;
      }

      settingsGroups.set(key, {
        roleSlugs: uniqueRoleSlugs,
        customSettings: userSetting.customSettings,
        userIds: [userSetting.userId],
      });
    }

    const settingsRows = [];

    for (const settingsGroup of settingsGroups.values()) {
      const resolvedPermissions = await this.resolvePermissionsForRoleSlugs(
        settingsGroup.roleSlugs,
        dbInstance,
      );

      const defaultSettings = this.getDefaultSettingsForPermissions(resolvedPermissions);

      const finalSettings = {
        ...defaultSettings,
        ...settingsGroup.customSettings,
      };

      settingsRows.push(
        ...settingsGroup.userIds.map((userId) => ({
          userId,
          settings: settingsToJSONBuildObject(finalSettings),
        })),
      );
    }

    await dbInstance.insert(settings).values(settingsRows);
  }

  public async getUserSettings(
    userId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ): Promise<SettingsJSONContentSchema> {
    const [row] = await dbInstance
      .select({ settings: sql<SettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(eq(settings.userId, userId));

    const userSettings = row?.settings;

    if (!userSettings) {
      throw new NotFoundException("User settings not found");
    }

    const dashboard = userSettings.dashboard ?? {
      widgets: await this.getDefaultDashboardWidgets(userId),
    };
    const widgets = dashboard.widgets ?? (await this.getDefaultDashboardWidgets(userId));
    const widgetIds = widgets.map((widget) => widget.id);
    const validIds = await this.filterDashboardWidgets(userId, widgetIds);
    const returnedWidgets = widgets.filter((widget) => validIds.includes(widget.id));

    return {
      ...userSettings,
      dashboard: {
        ...dashboard,
        widgets: returnedWidgets,
      },
    };
  }

  /**
   * Returns the permission-filtered catalog and the current user's normalized dashboard layout.
   * The legacy settings endpoint above intentionally remains available while clients migrate to
   * the semantic layout contract.
   */
  public async getDashboardSettings(userId: UUIDType): Promise<DashboardSettingsResponseSchema> {
    const [row] = await this.db
      .select({ settings: sql<Record<string, unknown>>`${settings.settings}` })
      .from(settings)
      .where(eq(settings.userId, userId));

    if (!row) {
      throw new NotFoundException("User settings not found");
    }

    const catalog = await this.getDashboardCatalog(userId);
    const storedLayout = this.readDashboardLayout(row.settings.dashboard);
    const layout = this.normalizeDashboardLayout(
      storedLayout,
      catalog,
      await this.getDefaultDashboardLayout(userId),
    );

    return { layout, catalog };
  }

  public async updateDashboardSettings(
    userId: UUIDType,
    body: UpdateDashboardSettingsBody,
  ): Promise<DashboardSettingsResponseSchema> {
    const catalog = await this.getDashboardCatalog(userId);
    this.validateDashboardWidgets(body.widgets, catalog);

    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ settings: sql<Record<string, unknown>>`${settings.settings}` })
        .from(settings)
        .where(eq(settings.userId, userId))
        .for("update");

      if (!row) {
        throw new NotFoundException("User settings not found");
      }

      const currentLayout = this.readDashboardLayout(row.settings.dashboard);
      const currentRevision = currentLayout?.revision ?? 0;

      if (currentRevision !== body.expectedRevision) {
        throw new ConflictException("dashboardHome.error.staleLayout");
      }

      const widgets = this.mergeInaccessibleDashboardWidgets(currentLayout, body.widgets, catalog);
      const nextLayout: DashboardSettings = {
        schemaVersion: DASHBOARD_SCHEMA_VERSION,
        revision: currentRevision + 1,
        widgets,
      };

      const nextSettings = {
        ...row.settings,
        dashboard: nextLayout,
      };

      await tx
        .update(settings)
        .set({ settings: settingsToJSONBuildObject(nextSettings) })
        .where(eq(settings.userId, userId));
    });

    return this.getDashboardSettings(userId);
  }

  public async resetDashboardSettings(
    userId: UUIDType,
    body: ResetDashboardSettingsBody,
  ): Promise<DashboardSettingsResponseSchema> {
    const defaults = await this.getDefaultDashboardLayout(userId);
    const catalog = await this.getDashboardCatalog(userId);

    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ settings: sql<Record<string, unknown>>`${settings.settings}` })
        .from(settings)
        .where(eq(settings.userId, userId))
        .for("update");

      if (!row) {
        throw new NotFoundException("User settings not found");
      }

      const currentLayout = this.readDashboardLayout(row.settings.dashboard);
      const currentRevision = currentLayout?.revision ?? 0;

      if (currentRevision !== body.expectedRevision) {
        throw new ConflictException("dashboardHome.error.staleLayout");
      }

      const widgets = this.mergeInaccessibleDashboardWidgets(
        currentLayout,
        defaults.widgets,
        catalog,
      );
      const nextLayout: DashboardSettings = {
        schemaVersion: DASHBOARD_SCHEMA_VERSION,
        revision: currentRevision + 1,
        widgets,
      };

      await tx
        .update(settings)
        .set({ settings: settingsToJSONBuildObject({ ...row.settings, dashboard: nextLayout }) })
        .where(eq(settings.userId, userId));
    });

    return this.getDashboardSettings(userId);
  }

  private async getDashboardCatalog(
    userId: UUIDType,
  ): Promise<DashboardSettingsResponseSchema["catalog"]> {
    const { permissions } = await this.permissionsService.getUserAccess(userId);
    const userPermissions = new Set(permissions);
    const globalSettings = await this.getPublicGlobalSettings();
    const globalSettingsRecord = globalSettings as unknown as Record<string, unknown>;
    const aiConfigured = await this.envService.getAIConfigured();
    const definitions = Object.values(DASHBOARD_WIDGET_CATALOG) as DashboardWidgetDefinition[];

    return definitions
      .filter((definition) => {
        if (
          definition.requiredFeature &&
          !globalSettingsRecord[FEATURE_SETTINGS_KEYS[definition.requiredFeature]]
        ) {
          return false;
        }

        if (definition.requiresAiConfigured && !aiConfigured.enabled) {
          return false;
        }

        if (
          definition.requiredPermissions &&
          !definition.requiredPermissions.every((permission) => userPermissions.has(permission))
        ) {
          return false;
        }

        return (
          !definition.anyPermissions ||
          definition.anyPermissions.some((permission) => userPermissions.has(permission))
        );
      })
      .map((definition) => ({
        type: definition.type,
        allowedSizes: [...definition.allowedSizes],
        defaultSize: definition.defaultSize,
      }));
  }

  private async getDefaultDashboardLayout(userId: UUIDType): Promise<DashboardSettings> {
    const { roleSlugs } = await this.permissionsService.getUserAccess(userId);
    const roleSet = new Set(roleSlugs);
    const rolePriority: readonly SystemRoleSlug[] = [
      SYSTEM_ROLE_SLUGS.ADMIN,
      SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
      SYSTEM_ROLE_SLUGS.TRAINER,
      SYSTEM_ROLE_SLUGS.STUDENT,
    ];
    const primaryRole = rolePriority.find((roleSlug) => roleSet.has(roleSlug));
    const defaultWidgets = primaryRole ? DASHBOARD_DEFAULT_LAYOUTS[primaryRole] : [];

    return {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      revision: 0,
      widgets: defaultWidgets.map((widget) => ({
        ...widget,
        visible: true,
      })),
    };
  }

  private readDashboardLayout(value: unknown): DashboardSettings | null {
    if (!value || typeof value !== "object") return null;
    const dashboard = value as Record<string, unknown>;
    const rawWidgets = dashboard.widgets;

    if (
      dashboard.schemaVersion === DASHBOARD_SCHEMA_VERSION &&
      typeof dashboard.revision === "number" &&
      Array.isArray(rawWidgets) &&
      rawWidgets.every((widget) => this.isDashboardLayoutWidget(widget))
    ) {
      return {
        schemaVersion: DASHBOARD_SCHEMA_VERSION,
        revision: dashboard.revision,
        widgets: rawWidgets as DashboardLayoutWidget[],
      };
    }

    return null;
  }

  private normalizeDashboardLayout(
    storedLayout: DashboardSettings | null,
    catalog: DashboardSettingsResponseSchema["catalog"],
    defaults: DashboardSettings,
  ): DashboardSettings {
    const available = new Set(catalog.map((entry) => entry.type));
    const source = storedLayout ?? defaults;
    const widgets: DashboardLayoutWidget[] = [];
    const seen = new Set<DashboardWidgetType>();

    for (const widget of source.widgets) {
      if (!available.has(widget.type) || seen.has(widget.type)) continue;
      const definition = DASHBOARD_WIDGET_CATALOG[widget.type] as DashboardWidgetDefinition;
      const size = definition.allowedSizes.includes(widget.size)
        ? widget.size
        : definition.defaultSize;
      widgets.push({ type: widget.type, size, visible: widget.visible });
      seen.add(widget.type);
    }

    for (const widget of defaults.widgets) {
      if (!available.has(widget.type) || seen.has(widget.type)) continue;
      widgets.push(widget);
      seen.add(widget.type);
    }

    return {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      revision: source.revision,
      widgets,
    };
  }

  /**
   * The effective layout intentionally omits widgets the actor cannot currently access. Keep
   * those canonical entries in storage during autosaves so a later permission change restores
   * the user's previous choice instead of silently replacing it with a default.
   */
  private mergeInaccessibleDashboardWidgets(
    currentLayout: DashboardSettings | null,
    requestedWidgets: readonly DashboardLayoutWidget[],
    catalog: DashboardSettingsResponseSchema["catalog"],
  ): DashboardLayoutWidget[] {
    if (!currentLayout) return requestedWidgets.map((widget) => ({ ...widget }));

    const available = new Set(catalog.map((entry) => entry.type));
    const inaccessible = currentLayout.widgets
      .map((widget, index) => ({ widget, index }))
      .filter(({ widget }) => !available.has(widget.type));
    const merged = requestedWidgets.map((widget) => ({ ...widget }));

    for (const { widget, index } of inaccessible) {
      merged.splice(Math.min(index, merged.length), 0, { ...widget });
    }

    return merged;
  }

  private validateDashboardWidgets(
    widgets: readonly DashboardLayoutWidget[],
    catalog: DashboardSettingsResponseSchema["catalog"],
  ): void {
    const catalogByType = new Map(catalog.map((entry) => [entry.type, entry]));
    const seen = new Set<DashboardWidgetType>();

    for (const widget of widgets) {
      if (seen.has(widget.type) || !catalogByType.has(widget.type)) {
        throw new BadRequestException("dashboardHome.error.invalidWidgetLayout");
      }

      const definition = catalogByType.get(widget.type);
      if (!definition?.allowedSizes.includes(widget.size)) {
        throw new BadRequestException("dashboardHome.error.invalidWidgetSize");
      }

      seen.add(widget.type);
    }
  }

  private isDashboardLayoutWidget(value: unknown): value is DashboardLayoutWidget {
    if (!value || typeof value !== "object") return false;
    const widget = value as Record<string, unknown>;
    return (
      typeof widget.type === "string" &&
      typeof widget.size === "string" &&
      typeof widget.visible === "boolean" &&
      Object.prototype.hasOwnProperty.call(DASHBOARD_WIDGET_CATALOG, widget.type)
    );
  }

  public async updateUserSettings(
    userId: UUIDType,
    updatedSettings: UpdateSettingsBody,
  ): Promise<SettingsJSONContentSchema> {
    let normalizedUpdatedSettings = updatedSettings;

    if (updatedSettings.dashboard) {
      const submittedWidgets = updatedSettings.dashboard.widgets;
      const widgetIds = submittedWidgets.map((widget) => widget.id);
      const uniqueWidgetIds = new Set(widgetIds);
      const availableWidgetIds = await this.getAvailableDashboardWidgets(userId);
      const availableWidgetIdSet = new Set(availableWidgetIds);

      if (
        uniqueWidgetIds.size !== widgetIds.length ||
        widgetIds.some((widgetId) => !availableWidgetIdSet.has(widgetId))
      ) {
        throw new BadRequestException("dashboardHome.error.invalidWidgetLayout");
      }

      const requiredWidgetIds = availableWidgetIds.filter(
        (widgetId) => DASHBOARD_WIDGETS[widgetId].alwaysVisible,
      );

      if (requiredWidgetIds.some((widgetId) => !uniqueWidgetIds.has(widgetId))) {
        throw new BadRequestException("dashboardHome.error.requiredWidgetMissing");
      }

      updatedSettings.dashboard.widgets.forEach((widget) => {
        const allowedWidths: readonly number[] = DASHBOARD_WIDGETS[widget.id].allowedWidths;

        if (!allowedWidths.includes(widget.width)) {
          throw new BadRequestException("dashboardHome.error.invalidWidgetWidth");
        }
      });

      normalizedUpdatedSettings = {
        ...updatedSettings,
        dashboard: {
          widgets: [...submittedWidgets]
            .sort((first, second) => first.order - second.order)
            .map((widget, order) => ({ ...widget, order })),
        },
      };
    }

    const [row] = await this.db
      .select({ settings: sql<SettingsJSONContentSchema>`${settings.settings}` })
      .from(settings)
      .where(eq(settings.userId, userId));

    const currentSettings = row?.settings;

    if (!currentSettings) {
      throw new NotFoundException("User settings not found");
    }

    const mergedSettings = {
      ...currentSettings,
      ...normalizedUpdatedSettings,
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

  private async filterDashboardWidgets(
    userId: UUIDType,
    widgetIds: DashboardWidgetsIdsJSONContentSchema,
  ): Promise<DashboardWidgetsIdsJSONContentSchema> {
    const { roleSlugs, permissions } = await this.permissionsService.getUserAccess(userId);
    const userRoles = new Set(roleSlugs);
    const userPermissions = new Set(permissions);
    const globalSettings = await this.getPublicGlobalSettings();
    const aiConfigured = await this.envService.getAIConfigured();

    const isValidWidgetId = (id: DashboardWidgetId) =>
      Object.prototype.hasOwnProperty.call(DASHBOARD_WIDGETS, id);

    return widgetIds.filter((widgetId) => {
      if (!isValidWidgetId(widgetId)) return false;

      const widgetDefinition: LegacyDashboardWidgetDefinition = DASHBOARD_WIDGETS[widgetId];
      const { allowedRoles, requiredFeature, requiredPermissions, requiresAiConfigured } =
        widgetDefinition;

      if (
        requiredFeature &&
        !(globalSettings as unknown as Record<string, unknown>)[
          FEATURE_SETTINGS_KEYS[requiredFeature]
        ]
      )
        return false;
      if (requiresAiConfigured && !aiConfigured.enabled) return false;
      if (
        requiredPermissions &&
        !requiredPermissions.every((permission) => userPermissions.has(permission))
      )
        return false;

      if (!allowedRoles) return true;

      return allowedRoles.some((role: SystemRoleSlug) => userRoles.has(role));
    });
  }

  public async getAvailableDashboardWidgets(
    userId: UUIDType,
  ): Promise<DashboardWidgetsIdsJSONContentSchema> {
    return await this.filterDashboardWidgets(userId, Object.values(DASHBOARD_WIDGET_IDS));
  }

  public async getDefaultDashboardWidgets(
    userId: UUIDType,
  ): Promise<DashboardWidgetsJSONContentSchema> {
    const widgetIds = DEFAULT_DASHBOARD_SETTINGS.widgets.map((widget) => widget.id);
    const validIds = await this.filterDashboardWidgets(userId, widgetIds);
    return DEFAULT_DASHBOARD_SETTINGS.widgets.filter((widget) => validIds.includes(widget.id));
  }

  public async updateGlobalUnregisteredUserCoursesAccessibility(
    actor?: CurrentUserType,
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

    if (current) {
      await this.db
        .update(chapters)
        .set({ isFreemium: false, updatedAt: new Date().toISOString() })
        .where(
          inArray(
            chapters.courseId,
            this.db.select({ id: courses.id }).from(courses).where(eq(courses.priceInCents, 0)),
          ),
        );
    }

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
    actor?: CurrentUserType,
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
    actor?: CurrentUserType,
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

  public async updateGlobalModernCourseListEnabled(
    actor?: CurrentUserType,
  ): Promise<GlobalSettingsJSONContentSchema> {
    const previousRecord = await this.getGlobalSettingsRecord();

    const current =
      previousRecord.settings.modernCourseListEnabled ??
      DEFAULT_GLOBAL_SETTINGS.modernCourseListEnabled;

    const [{ settings: updatedGlobalSettings }] = await this.db
      .update(settings)
      .set({
        settings: sql`
          jsonb_set(
            settings.settings,
            '{modernCourseListEnabled}',
            to_jsonb(${!current}::boolean),
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

  public async updateGlobalCourseDiscussionsEnabled(
    actor?: CurrentUserType,
  ): Promise<GlobalSettingsJSONContentSchema> {
    const previousRecord = await this.getGlobalSettingsRecord();

    const current =
      previousRecord.settings.courseDiscussionsEnabled ??
      DEFAULT_GLOBAL_SETTINGS.courseDiscussionsEnabled;

    const [{ settings: updatedGlobalSettings }] = await this.db
      .update(settings)
      .set({
        settings: setJsonbField(settings.settings, "courseDiscussionsEnabled", !current),
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

  public async updateGlobalCalendarEnabled(
    actor?: CurrentUserType,
  ): Promise<GlobalSettingsJSONContentSchema> {
    const previousRecord = await this.getGlobalSettingsRecord();

    const [{ settings: updatedGlobalSettings }] = await this.db
      .update(settings)
      .set({
        settings: sql`
          jsonb_set(
            settings.settings,
            '{calendarEnabled}',
            to_jsonb(true),
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

    return this.withTrainerRoleUserCount(this.parseGlobalSettings(updatedGlobalSettings));
  }

  public async updateGlobalLiveTrainingEnabled(
    actor?: CurrentUserType,
  ): Promise<GlobalSettingsJSONContentSchema> {
    const previousRecord = await this.getGlobalSettingsRecord();
    const previousSettings = this.parseGlobalSettings(previousRecord.settings);
    const nextLiveTrainingEnabled = !previousSettings.liveTrainingEnabled;

    if (!nextLiveTrainingEnabled) {
      const trainerRoleUserCount = await this.getTrainerRoleUserCount();

      if (trainerRoleUserCount > 0) {
        throw new BadRequestException(
          "adminPreferences.errors.liveTrainingDisableBlockedByTrainerRole",
        );
      }
    }

    const liveTrainingEnabledUpdate =
      setJsonbField(settings.settings, "liveTrainingEnabled", nextLiveTrainingEnabled) ??
      settings.settings;

    const [{ settings: updatedGlobalSettings }] = await this.db
      .update(settings)
      .set({
        settings: setJsonbField(liveTrainingEnabledUpdate, "calendarEnabled", true),
      })
      .where(isNull(settings.userId))
      .returning({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` });

    const updatedRecord = await this.getGlobalSettingsRecord();

    await this.recordSettingsUpdate({
      actor,
      previousSnapshot: this.buildSettingsSnapshot(previousRecord),
      updatedSnapshot: updatedRecord ? this.buildSettingsSnapshot(updatedRecord) : null,
    });

    return this.withTrainerRoleUserCount(this.parseGlobalSettings(updatedGlobalSettings));
  }

  public async updateLiveTrainingMaxParallelSessions(
    maxParallelSessions: number,
    actor?: CurrentUserType,
  ): Promise<GlobalSettingsJSONContentSchema> {
    const previousRecord = await this.getGlobalSettingsRecord();
    const normalizedMaxParallelSessions = Math.floor(maxParallelSessions);

    const [{ settings: updatedGlobalSettings }] = await this.db
      .update(settings)
      .set({
        settings: setJsonbField(
          settings.settings,
          "liveTrainingMaxParallelSessions",
          normalizedMaxParallelSessions,
        ),
      })
      .where(isNull(settings.userId))
      .returning({ settings: sql<GlobalSettingsJSONContentSchema>`${settings.settings}` });

    const updatedRecord = await this.getGlobalSettingsRecord();

    await this.recordSettingsUpdate({
      actor,
      previousSnapshot: this.buildSettingsSnapshot(previousRecord),
      updatedSnapshot: updatedRecord ? this.buildSettingsSnapshot(updatedRecord) : null,
    });

    return this.withTrainerRoleUserCount(this.parseGlobalSettings(updatedGlobalSettings));
  }

  public async getLiveTrainingMaxParallelSessions(): Promise<number> {
    const globalSettingsRecord = await this.getGlobalSettingsRecord();
    const globalSettings = this.parseGlobalSettings(globalSettingsRecord.settings);

    return globalSettings.liveTrainingMaxParallelSessions;
  }

  public async updateGlobalLearningPathsEnabled(
    actor?: CurrentUserType,
  ): Promise<GlobalSettingsJSONContentSchema> {
    const previousRecord = await this.getGlobalSettingsRecord();

    const current =
      previousRecord.settings.learningPathsEnabled ?? DEFAULT_GLOBAL_SETTINGS.learningPathsEnabled;

    const [{ settings: updatedGlobalSettings }] = await this.db
      .update(settings)
      .set({
        settings: setJsonbField(settings.settings, "learningPathsEnabled", !current),
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
    actor?: CurrentUserType,
  ): Promise<void> {
    const previousRecord = await this.getGlobalSettingsRecord();

    let newValue: string | null = null;
    if (file) {
      const resource = "platform-logos";
      const { fileKey } = await this.fileService.uploadFile(file, resource, actor?.tenantId);
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
    const globalSettings = await this.getGlobalSettingsRecord();
    return this.buildSettingsImageUrl(
      SETTINGS_IMAGE_ASSET.PLATFORM_LOGO,
      globalSettings.settings.platformLogoS3Key,
    );
  }

  public async getPlatformLogoBuffer(): Promise<Buffer | null> {
    const [globalSettings] = await this.db
      .select({
        platformLogoS3Key: sql<string | null>`${settings.settings}->>'platformLogoS3Key'`,
      })
      .from(settings)
      .where(isNull(settings.userId));

    const logoUrl =
      globalSettings?.platformLogoS3Key ?? `${CORS_ORIGIN}/app/assets/svgs/app-logo.svg`;

    try {
      return await this.fileService.getFileBuffer(logoUrl);
    } catch {
      return null;
    }
  }

  public async uploadPlatformSimpleLogo(
    file: Express.Multer.File | null | undefined,
    actor?: CurrentUserType,
  ): Promise<void> {
    const previousRecord = await this.getGlobalSettingsRecord();

    let newValue: string | null = null;
    if (file) {
      const resource = "platform-simple-logos";
      const { fileKey } = await this.fileService.uploadFile(file, resource, actor?.tenantId, {
        variantDefinitions: [...IMAGE_VARIANT_DEFINITIONS, ...PWA_ICON_IMAGE_VARIANT_DEFINITIONS],
        resizeMode: IMAGE_RESIZE_MODES.COVER_SQUARE,
      });
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
    const globalSettings = await this.getGlobalSettingsRecord();
    return this.buildSettingsImageUrl(
      SETTINGS_IMAGE_ASSET.PLATFORM_SIMPLE_LOGO,
      globalSettings.settings.platformSimpleLogoS3Key,
    );
  }

  public async getPwaManifest(): Promise<PwaManifest> {
    const globalSettings = await this.getGlobalSettingsRecord();
    const parsedSettings = this.parseGlobalSettings(globalSettings.settings);
    const companyName =
      parsedSettings.companyInformation?.companyShortName ||
      parsedSettings.companyInformation?.companyName ||
      "Mentingo";
    const shortName = parsedSettings.companyInformation?.companyShortName || companyName;
    const simpleLogoUrl = this.buildSettingsImageUrl(
      SETTINGS_IMAGE_ASSET.PLATFORM_SIMPLE_LOGO,
      parsedSettings.platformSimpleLogoS3Key,
    );

    const icons = simpleLogoUrl
      ? ([192, 512] as const).map((size) => {
          return {
            src: `${simpleLogoUrl}&quality=${PWA_ICON_IMAGE_QUALITY[`ICON_${size}`]}`,
            sizes: `${size}x${size}`,
            type: "image/webp",
          };
        })
      : [{ src: "/app-signet.svg", sizes: "any", type: "image/svg+xml" }];

    return {
      name: `${companyName} LMS`,
      short_name: `${shortName} LMS`,
      theme_color: parsedSettings.primaryColor || "#3f58b6",
      background_color: parsedSettings.contrastColor || "#fcfcfc",
      display: "standalone",
      orientation: "portrait",
      start_url: "/",
      scope: "/",
      icons,
    };
  }

  public async uploadLoginBackgroundImage(
    file: Express.Multer.File | null | undefined,
    actor?: CurrentUserType,
  ): Promise<void> {
    const previousRecord = await this.getGlobalSettingsRecord();

    let newValue: string | null = null;
    if (file) {
      const resource = "login-backgrounds";
      const { fileKey } = await this.fileService.uploadFile(file, resource, actor?.tenantId);
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
    const globalSettings = await this.getGlobalSettingsRecord();

    return {
      url: this.buildSettingsImageUrl(
        SETTINGS_IMAGE_ASSET.LOGIN_BACKGROUND,
        globalSettings.settings.loginBackgroundImageS3Key,
      ),
    };
  }

  public async streamSettingsImageByAssetType(
    req: Request,
    res: Response,
    assetType: SettingsImageAssetType,
  ): Promise<void> {
    const globalSettings = await this.getGlobalSettingsRecord();
    const key = this.getSettingsImageKey(assetType, globalSettings.settings);

    if (!key) throw new NotFoundException("Settings image not found");

    const file = await this.fileService.getFileDelivery(key, req.headers.range, {
      quality: this.getRequestedImageQuality(req),
    });

    res.setHeader("Cache-Control", STATIC_SETTINGS_IMAGE_CACHE_CONTROL);

    if (file.type === FILE_DELIVERY_TYPE.REDIRECT) {
      res.redirect(file.url);
      return;
    }

    if (this.isRevalidationHit(req, file.etag, file.lastModified)) {
      if (file.etag) res.setHeader("ETag", file.etag);
      if (file.lastModified) res.setHeader("Last-Modified", file.lastModified.toUTCString());

      res.status(304).end();
      return;
    }

    streamFileToResponse(res, file);
  }

  public async getCompanyInformation(): Promise<CompanyInformaitonJSONSchema> {
    const [settingsRecord] = await this.db
      .select({
        companyInformation: sql<CompanyInformaitonJSONSchema>`${settings.settings}->'companyInformation'`,
      })
      .from(settings)
      .where(isNull(settings.userId));

    if (!settingsRecord?.companyInformation) {
      const updatedRecord = await this.updateCompanyInformation({
        ...DEFAULT_GLOBAL_SETTINGS.companyInformation,
      });

      return updatedRecord;
    }

    return settingsRecord.companyInformation;
  }

  public async getCompanyInformationByTenantId(
    tenantId: UUIDType,
  ): Promise<CompanyInformaitonJSONSchema> {
    const [settingsRecord] = await this.dbAdmin
      .select({
        companyInformation: sql<CompanyInformaitonJSONSchema>`${settings.settings}->'companyInformation'`,
      })
      .from(settings)
      .where(and(eq(settings.tenantId, tenantId), isNull(settings.userId)));

    return settingsRecord?.companyInformation ?? DEFAULT_GLOBAL_SETTINGS.companyInformation;
  }

  public async updateCompanyInformation(
    companyInfo: CompanyInformaitonJSONSchema,
    actor?: CurrentUserType,
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
    actor?: CurrentUserType,
  ): Promise<GlobalSettingsJSONContentSchema> {
    const previousRecord = await this.getGlobalSettingsRecord();

    const enforcedRoles: string[] = [];

    Object.entries(rolesRequest).forEach(([role, shouldEnforce]) => {
      if (shouldEnforce === true) enforcedRoles.push(role);
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
    certificateBackground: Express.Multer.File | null,
    actor?: CurrentUserType,
  ): Promise<GlobalSettingsJSONContentSchema> {
    const previousRecord = await this.getGlobalSettingsRecord();

    let certificateBackgroundValue: string | null = null;

    if (certificateBackground) {
      const { fileKey } = await this.fileService.uploadFile(
        certificateBackground,
        "certificate-backgrounds",
        actor?.tenantId,
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
    actor?: CurrentUserType,
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

  async updateGlobalInviteOnlyRegistration(actor?: CurrentUserType) {
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

  async updateUserEmailTriggers(triggerKey: string, actor?: CurrentUserType) {
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

    try {
      const pngBuffer = await sharp(Buffer.from(modifiedSvg, "utf-8"), { density: 300 })
        .resize(230, 119, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      return pngBuffer;
    } catch {
      return null;
    }
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

  async updateAgeLimit(
    ageLimit: AllowedAgeLimit,
    actor?: CurrentUserType,
  ): Promise<GlobalSettingsJSONContentSchema> {
    const previousRecord = await this.getGlobalSettingsRecord();

    const [{ settings: updatedSettings }] = await this.db
      .update(settings)
      .set({
        settings: sql`jsonb_set(
          settings.settings,
          '{ageLimit}',
          ${ageLimit !== null ? sql`to_jsonb(${ageLimit}::integer)` : sql`'null'::jsonb`},
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
    actor?: CurrentUserType;
    previousSnapshot: SettingsActivityLogSnapshot | null;
    updatedSnapshot: SettingsActivityLogSnapshot | null;
    context?: Record<string, string>;
  }) {
    const { actor, previousSnapshot, updatedSnapshot, context } = params;
    if (!actor || !previousSnapshot || !updatedSnapshot) return;
    if (isEqual(previousSnapshot, updatedSnapshot)) return;

    await this.outboxPublisher.publish(
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
      throw new NotFoundException(GLOBAL_SETTINGS_NOT_FOUND_MESSAGE);
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

  async updateNewsSetting(setting: AllowedNewsSettings) {
    const [globalSettings] = await this.db
      .select({
        setting: sql<boolean>`(settings.settings->>(${setting}::text))::boolean`,
        newsEnabled: sql<boolean>`(settings.settings->>'newsEnabled')::boolean`,
      })
      .from(settings)
      .where(isNull(settings.userId));

    if (!globalSettings.newsEnabled && ALLOWED_NEWS_SETTINGS.NEWS_ENABLED !== setting)
      throw new BadRequestException("newsPreferences.toast.newsNotEnabled");

    if (!globalSettings) throw new NotFoundException(GLOBAL_SETTINGS_NOT_FOUND_MESSAGE);

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

  async updateArticlesSetting(setting: AllowedArticlesSettings) {
    const [globalSettings] = await this.db
      .select({
        setting: sql<boolean>`(settings.settings->>(${setting}::text))::boolean`,
        articlesEnabled: sql<boolean>`(settings.settings->>'articlesEnabled')::boolean`,
      })
      .from(settings)
      .where(isNull(settings.userId));

    if (!globalSettings.articlesEnabled && ALLOWED_ARTICLES_SETTINGS.ARTICLES_ENABLED !== setting)
      throw new BadRequestException("articlesPreferences.toast.articlesNotEnabled");

    if (!globalSettings) throw new NotFoundException(GLOBAL_SETTINGS_NOT_FOUND_MESSAGE);

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

  async uploadLoginPageFile(
    uploadedData: UploadFilesToLoginPageBody,
    file: Express.Multer.File,
    currentUser: CurrentUserType,
  ) {
    const existingResources = await this.getExistingLoginPageResourceIds();

    if (existingResources.resourceIds.length >= MAX_LOGIN_PAGE_DOCUMENTS) {
      throw new BadRequestException({
        message: "loginFilesUpload.toast.maxResourceCount",
        count: MAX_LOGIN_PAGE_DOCUMENTS,
      });
    }

    await this.db.transaction(async (trx) => {
      const { resourceId } = await this.fileService.uploadResource({
        file,
        folder: "login_page_files",
        resource: RESOURCE_CATEGORIES.GLOBAL_SETTINGS,
        entityId: existingResources.id,
        entityType: ENTITY_TYPES.GLOBAL_SETTINGS,
        relationshipType: RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
        title: { en: uploadedData.name },
        description: {},
        currentUser,
      });

      await trx
        .update(settings)
        .set({
          settings: sql`
          jsonb_set(
            settings.settings,
            '{loginPageFiles}',
            COALESCE(settings.settings->'loginPageFiles', '[]'::jsonb) || jsonb_build_array(${resourceId}::text),
            true
          )
        `,
        })
        .where(isNull(settings.userId));
    });
  }

  async getLoginPageFiles(): Promise<LoginPageResourceResponseBody> {
    const existingResourceIds = await this.getExistingLoginPageResourceIds();

    if (!existingResourceIds.resourceIds.length) return { resources: [] };

    const existingResources = await this.db
      .select({
        ...getTableColumns(resources),
        title: this.localizationService.getFirstValue(resources.title),
      })
      .from(resources)
      .where(inArray(resources.id, existingResourceIds.resourceIds));

    return {
      resources: await Promise.all(
        existingResources.map(async (existingResource) => ({
          id: existingResource.id,
          name: existingResource.title,
          resourceUrl: await this.fileService.getFileUrl(existingResource.reference),
        })),
      ),
    };
  }

  private async resolvePermissionsForRoleSlugs(
    roleSlugs: string[],
    dbInstance: DatabasePg,
  ): Promise<PermissionKey[]> {
    if (!roleSlugs.length) return [];

    const permissionRows = await dbInstance
      .select({
        permission: permissionRuleSetPermissions.permission,
      })
      .from(permissionRoles)
      .innerJoin(
        permissionRoleRuleSets,
        and(
          eq(permissionRoleRuleSets.roleId, permissionRoles.id),
          eq(permissionRoleRuleSets.tenantId, permissionRoles.tenantId),
        ),
      )
      .innerJoin(
        permissionRuleSetPermissions,
        and(
          eq(permissionRuleSetPermissions.ruleSetId, permissionRoleRuleSets.ruleSetId),
          eq(permissionRuleSetPermissions.tenantId, permissionRoleRuleSets.tenantId),
        ),
      )
      .where(inArray(permissionRoles.slug, roleSlugs));

    return Array.from(new Set(permissionRows.map((row) => row.permission as PermissionKey)));
  }

  private getDefaultSettingsForPermissions(
    permissions: PermissionKey[],
  ): SettingsJSONContentSchema {
    if (permissions.includes(PERMISSIONS.SETTINGS_MANAGE)) return DEFAULT_ADMIN_SETTINGS;

    return DEFAULT_STUDENT_SETTINGS;
  }

  async deleteLoginPageFile(id: UUIDType) {
    await this.db.transaction(async (trx) => {
      const [resource] = await trx
        .select()
        .from(resourceEntity)
        .where(eq(resourceEntity.resourceId, id));

      if (!resource) throw new BadRequestException("loginFilesUpload.toast.resourceNotFound");

      await trx.delete(resourceEntity).where(eq(resourceEntity.resourceId, id));

      await trx
        .update(settings)
        .set({
          settings: sql`
          jsonb_set(
            settings.settings,
            '{loginPageFiles}',
            COALESCE(settings.settings->'loginPageFiles', '[]'::jsonb) - ${id}::text,
            true
          )
        `,
        })
        .where(isNull(settings.userId));
    });
  }

  private async getExistingLoginPageResourceIds() {
    const [existingResources] = await this.db
      .select({
        id: settings.id,
        resourceIds: sql<string[]>`
          COALESCE(
            ARRAY(
              SELECT jsonb_array_elements_text(settings.settings->'loginPageFiles')
            ),
            ARRAY[]::text[]
          )
        `,
      })
      .from(settings)
      .where(and(isNull(settings.userId)));

    if (!existingResources) {
      throw new NotFoundException(GLOBAL_SETTINGS_NOT_FOUND_MESSAGE);
    }

    return existingResources;
  }

  private parseGlobalSettings(
    settings: GlobalSettingsJSONContentSchema,
  ): GlobalSettingsJSONContentSchema {
    return {
      ...settings,
      modernCourseListEnabled:
        settings.modernCourseListEnabled ?? DEFAULT_GLOBAL_SETTINGS.modernCourseListEnabled,
      courseDiscussionsEnabled:
        settings.courseDiscussionsEnabled ?? DEFAULT_GLOBAL_SETTINGS.courseDiscussionsEnabled,
      learningPathsEnabled:
        settings.learningPathsEnabled ?? DEFAULT_GLOBAL_SETTINGS.learningPathsEnabled,
      calendarEnabled: true,
      liveTrainingEnabled:
        settings.liveTrainingEnabled ?? DEFAULT_GLOBAL_SETTINGS.liveTrainingEnabled,
      liveTrainingMaxParallelSessions:
        settings.liveTrainingMaxParallelSessions ??
        DEFAULT_GLOBAL_SETTINGS.liveTrainingMaxParallelSessions,
      MFAEnforcedRoles: Array.isArray(settings.MFAEnforcedRoles)
        ? settings.MFAEnforcedRoles
        : JSON.parse(settings.MFAEnforcedRoles ?? "[]"),
      loginPageFiles: Array.isArray(settings.loginPageFiles)
        ? settings.loginPageFiles
        : JSON.parse(settings.loginPageFiles ?? "[]"),
      userEmailTriggers: settings.userEmailTriggers ?? DEFAULT_GLOBAL_SETTINGS.userEmailTriggers,
      ageLimit: settings.ageLimit ?? null,
    };
  }

  private async withTrainerRoleUserCount(
    settingsData: GlobalSettingsJSONContentSchema,
    dbInstance: DatabasePg = this.db,
    tenantId?: UUIDType,
  ): Promise<GlobalSettingsJSONContentSchema> {
    return {
      ...settingsData,
      trainerRoleUserCount: await this.getTrainerRoleUserCount(dbInstance, tenantId),
    };
  }

  private async getTrainerRoleUserCount(
    dbInstance: DatabasePg = this.db,
    tenantId?: UUIDType,
  ): Promise<number> {
    const conditions = [
      eq(permissionRoles.slug, SYSTEM_ROLE_SLUGS.TRAINER),
      isNull(users.deletedAt),
      eq(users.archived, false),
    ];

    if (tenantId) {
      conditions.push(eq(permissionUserRoles.tenantId, tenantId));
    }

    const [row] = await dbInstance
      .select({ totalItems: count() })
      .from(permissionUserRoles)
      .innerJoin(
        permissionRoles,
        and(
          eq(permissionRoles.id, permissionUserRoles.roleId),
          eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .innerJoin(
        users,
        and(
          eq(users.id, permissionUserRoles.userId),
          eq(users.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .where(and(...conditions));

    return row?.totalItems ?? 0;
  }

  private reorderEmailTriggers(emailTriggers: UserEmailTriggersSchema) {
    const triggerOrder = Object.keys(DEFAULT_GLOBAL_SETTINGS.userEmailTriggers);
    return Object.fromEntries(
      triggerOrder
        .filter((key) => key in emailTriggers)
        .map((key) => [key, emailTriggers[key as keyof UserEmailTriggersSchema]]),
    ) as UserEmailTriggersSchema;
  }

  private buildSettingsImageUrl(
    assetType: SettingsImageAssetType,
    fileKey: string | null | undefined,
  ): string | null {
    if (!fileKey) return null;

    const version = encodeURIComponent(fileKey);
    return `/api/settings/${assetType}/image?v=${version}`;
  }

  private getSettingsImageKey(
    assetType: SettingsImageAssetType,
    globalSettings: GlobalSettingsJSONContentSchema,
  ): string | null {
    switch (assetType) {
      case SETTINGS_IMAGE_ASSET.PLATFORM_LOGO:
        return globalSettings.platformLogoS3Key;
      case SETTINGS_IMAGE_ASSET.PLATFORM_SIMPLE_LOGO:
        return globalSettings.platformSimpleLogoS3Key;
      case SETTINGS_IMAGE_ASSET.LOGIN_BACKGROUND:
        return globalSettings.loginBackgroundImageS3Key;
      case SETTINGS_IMAGE_ASSET.CERTIFICATE_BACKGROUND:
        return globalSettings.certificateBackgroundImage;
      default:
        return null;
    }
  }

  private getRequestedImageQuality(req: Request): ImageQuality | undefined {
    const quality = req.query.quality;

    if (typeof quality !== "string") return undefined;
    if (!isImageQuality(quality)) return undefined;

    return quality;
  }

  private isRevalidationHit(
    req: Request,
    etag: string | undefined,
    lastModified: Date | undefined,
  ): boolean {
    const ifNoneMatchHeader = req.headers["if-none-match"];
    if (etag && typeof ifNoneMatchHeader === "string") {
      const normalizedEtag = this.normalizeEtag(etag);
      const requestedEtags = ifNoneMatchHeader.split(",").map((value) => this.normalizeEtag(value));

      if (requestedEtags.includes(normalizedEtag) || ifNoneMatchHeader.includes("*")) {
        return true;
      }
    }

    const ifModifiedSinceHeader = req.headers["if-modified-since"];
    if (lastModified && typeof ifModifiedSinceHeader === "string") {
      const ifModifiedSince = new Date(ifModifiedSinceHeader);
      if (!Number.isNaN(ifModifiedSince.getTime()) && lastModified <= ifModifiedSince) {
        return true;
      }
    }

    return false;
  }

  private normalizeEtag(value: string): string {
    return value.replace(/^W\//, "").trim();
  }
}
