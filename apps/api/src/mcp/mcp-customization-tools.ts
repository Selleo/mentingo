import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  ALLOWED_ARTICLES_SETTINGS,
  ALLOWED_NEWS_SETTINGS,
  ALLOWED_QA_SETTINGS,
  PERMISSIONS,
} from "@repo/shared";

import * as Schemas from "./mcp-customization-tool.schemas";
import { asMcpInputSchema } from "./mcp-tool.schema";

import type { McpToolRunner } from "./mcp-tool-runner.types";
import type { McpUploadGrantService } from "./mcp-upload-grant.service";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Static } from "@sinclair/typebox";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { GlobalSettingsJSONContentSchema } from "src/settings/schemas/settings.schema";
import type { SettingsService } from "src/settings/settings.service";

export const MCP_CUSTOMIZATION_TOOL_NAMES = [
  "get_platform_customization",
  "update_platform_colors",
  "update_platform_company_information",
  "get_platform_registration_form",
  "update_platform_registration_form",
  "toggle_platform_customization_flag",
  "update_platform_default_currency",
  "update_platform_age_limit",
  "update_platform_featured_course",
  "update_platform_live_training_capacity",
  "toggle_platform_email_trigger",
  "request_platform_image_upload",
  "remove_platform_image",
  "list_platform_login_documents",
  "request_platform_login_document_upload",
  "delete_platform_login_document",
] as const;

function customizationSettings(settings: GlobalSettingsJSONContentSchema) {
  const { enforceSSO: _sso, MFAEnforcedRoles: _mfa, ...customization } = settings;
  return customization;
}

async function toggleFlag(
  service: SettingsService,
  setting: Static<typeof Schemas.customizationFlagInputSchema>["setting"],
  actor: CurrentUserType,
) {
  switch (setting) {
    case "unregisteredUserCoursesAccessibility":
      return service.updateGlobalUnregisteredUserCoursesAccessibility(actor);
    case "modernCourseListEnabled":
      return service.updateGlobalModernCourseListEnabled(actor);
    case "courseDiscussionsEnabled":
      return service.updateGlobalCourseDiscussionsEnabled(actor);
    case "calendarEnabled":
      return service.updateGlobalCalendarEnabled(actor);
    case "liveTrainingEnabled":
      return service.updateGlobalLiveTrainingEnabled(actor);
    case "learningPathsEnabled":
      return service.updateGlobalLearningPathsEnabled(actor);
    case "inviteOnlyRegistration":
      return service.updateGlobalInviteOnlyRegistration(actor);
    case "QAEnabled":
      return service.updateQASetting(ALLOWED_QA_SETTINGS.QA_ENABLED);
    case "unregisteredUserQAAccessibility":
      return service.updateQASetting(ALLOWED_QA_SETTINGS.UNREGISTERED_USER_QA_ACCESSIBILITY);
    case "newsEnabled":
      return service.updateNewsSetting(ALLOWED_NEWS_SETTINGS.NEWS_ENABLED);
    case "unregisteredUserNewsAccessibility":
      return service.updateNewsSetting(ALLOWED_NEWS_SETTINGS.UNREGISTERED_USER_NEWS_ACCESSIBILITY);
    case "articlesEnabled":
      return service.updateArticlesSetting(ALLOWED_ARTICLES_SETTINGS.ARTICLES_ENABLED);
    case "unregisteredUserArticlesAccessibility":
      return service.updateArticlesSetting(
        ALLOWED_ARTICLES_SETTINGS.UNREGISTERED_USER_ARTICLES_ACCESSIBILITY,
      );
  }
}

export function registerMcpCustomizationTools(
  server: McpServer,
  run: McpToolRunner,
  service: SettingsService,
  uploadGrants: McpUploadGrantService,
): void {
  const permissions = [PERMISSIONS.SETTINGS_MANAGE];
  const read = { readOnlyHint: true };
  const write = { readOnlyHint: false, destructiveHint: false };
  server.registerTool(
    "get_platform_customization",
    {
      description:
        "Read tenant platform branding, company information, registration preferences and feature settings. Security policy is excluded.",
      inputSchema: asMcpInputSchema(Schemas.customizationReadInputSchema),
      annotations: read,
    },
    async () =>
      run(permissions, async () => ({
        settings: customizationSettings(await service.getGlobalSettings()),
        platformLogoUrl: await service.getPlatformLogoUrl(),
        platformSimpleLogoUrl: await service.getPlatformSimpleLogoUrl(),
        loginBackground: await service.getLoginBackgroundImageUrl(),
      })),
  );
  server.registerTool(
    "update_platform_colors",
    {
      description: "Set platform primary and contrast brand colors.",
      inputSchema: asMcpInputSchema(Schemas.customizationColorsInputSchema),
      annotations: write,
    },
    async (input) =>
      run(permissions, async (actor) => ({
        settings: customizationSettings(
          await service.updateGlobalColorSchema(input.primaryColor, input.contrastColor, actor),
        ),
      })),
  );
  server.registerTool(
    "update_platform_company_information",
    {
      description: "Update supplied company information fields; omitted fields remain unchanged.",
      inputSchema: asMcpInputSchema(Schemas.customizationCompanyInputSchema),
      annotations: write,
    },
    async (input) =>
      run(permissions, async (actor) => ({
        companyInformation: await service.updateCompanyInformation(input, actor),
      })),
  );
  server.registerTool(
    "get_platform_registration_form",
    {
      description: "Read all localized registration checkbox fields, including archived fields.",
      inputSchema: asMcpInputSchema(Schemas.customizationReadInputSchema),
      annotations: read,
    },
    async () =>
      run(permissions, async () => ({
        registrationForm: await service.getAdminRegistrationForm(),
      })),
  );
  server.registerTool(
    "update_platform_registration_form",
    {
      description:
        "Create or update registration checkbox fields and translations; archive fields using archived=true. Existing field IDs are returned by get_platform_registration_form.",
      inputSchema: asMcpInputSchema(Schemas.customizationRegistrationInputSchema),
      annotations: write,
    },
    async (input) =>
      run(permissions, async () => ({
        registrationForm: await service.updateRegistrationForm(input),
      })),
  );
  server.registerTool(
    "toggle_platform_customization_flag",
    {
      description:
        "Toggle the current platform feature or registration/public-access preference. Read get_platform_customization first; each call flips the boolean, so do not retry blindly. A change uses the existing settings service and preserves its side effects. Disabling public course access also clears freemium chapter flags on free courses.",
      inputSchema: asMcpInputSchema(Schemas.customizationFlagInputSchema),
      annotations: { ...write, idempotentHint: false },
    },
    async (input) =>
      run(permissions, async (actor) => {
        const updated = await toggleFlag(service, input.setting, actor);
        return { settings: customizationSettings(updated) };
      }),
  );
  server.registerTool(
    "update_platform_default_currency",
    {
      description: "Set default course currency.",
      inputSchema: asMcpInputSchema(Schemas.customizationCurrencyInputSchema),
      annotations: write,
    },
    async (input) =>
      run(permissions, async (actor) => ({
        settings: customizationSettings(
          await service.updateDefaultCourseCurrency(input.defaultCourseCurrency, actor),
        ),
      })),
  );
  server.registerTool(
    "update_platform_age_limit",
    {
      description: "Set registration age limit, or null to remove it.",
      inputSchema: asMcpInputSchema(Schemas.customizationAgeLimitInputSchema),
      annotations: write,
    },
    async (input) =>
      run(permissions, async (actor) => ({
        settings: customizationSettings(await service.updateAgeLimit(input.ageLimit, actor)),
      })),
  );
  server.registerTool(
    "update_platform_featured_course",
    {
      description:
        "Select featured course, or null to clear it; the existing service validates eligible courses.",
      inputSchema: asMcpInputSchema(Schemas.customizationFeaturedCourseInputSchema),
      annotations: write,
    },
    async (input) =>
      run(permissions, async (actor) => ({
        settings: customizationSettings(
          await service.updateGlobalFeaturedCourse(input.featuredCourseId, actor),
        ),
      })),
  );
  server.registerTool(
    "update_platform_live_training_capacity",
    {
      description: "Set maximum parallel live training sessions.",
      inputSchema: asMcpInputSchema(Schemas.customizationLiveTrainingCapacityInputSchema),
      annotations: write,
    },
    async (input) =>
      run(permissions, async (actor) => ({
        settings: customizationSettings(
          await service.updateLiveTrainingMaxParallelSessions(
            input.liveTrainingMaxParallelSessions,
            actor,
          ),
        ),
      })),
  );
  server.registerTool(
    "toggle_platform_email_trigger",
    {
      description:
        "Toggle a learner notification email trigger. Read current customization first; each call flips the boolean, so do not retry blindly.",
      inputSchema: asMcpInputSchema(Schemas.customizationEmailTriggerInputSchema),
      annotations: { ...write, idempotentHint: false },
    },
    async (input) =>
      run(permissions, async (actor) => {
        const updated = await service.updateUserEmailTriggers(input.trigger, actor);
        return { settings: customizationSettings(updated) };
      }),
  );
  server.registerTool(
    "request_platform_image_upload",
    {
      description:
        "Request a one-use native multipart upload for the platform logo, compact logo, login background or certificate background. Supply file metadata, then send local bytes using the returned uploadRequest. Native branding limit: 10 MiB.",
      inputSchema: asMcpInputSchema(Schemas.customizationImageInputSchema),
      annotations: write,
    },
    async ({ kind, ...file }) =>
      run(permissions, (actor) =>
        uploadGrants.issuePlatformAssetGrant(actor, { asset: kind, ...file }),
      ),
  );
  server.registerTool(
    "remove_platform_image",
    {
      description:
        "Remove the selected platform logo, compact logo, login background or certificate background.",
      inputSchema: asMcpInputSchema(Schemas.customizationRemoveImageInputSchema),
      annotations: { ...write, destructiveHint: true },
    },
    async ({ kind }) =>
      run(permissions, async (actor) => {
        switch (kind) {
          case "platformLogo":
            await service.uploadPlatformLogo(null, actor);
            break;
          case "platformSimpleLogo":
            await service.uploadPlatformSimpleLogo(null, actor);
            break;
          case "loginBackground":
            await service.uploadLoginBackgroundImage(null, actor);
            break;
          case "certificateBackground":
            await service.updateCertificateBackground(null, actor);
            break;
        }
        return { settings: customizationSettings(await service.getGlobalSettings()) };
      }),
  );
  server.registerTool(
    "list_platform_login_documents",
    {
      description: "List public login page documents and their IDs and download URLs.",
      inputSchema: asMcpInputSchema(Schemas.customizationReadInputSchema),
      annotations: read,
    },
    async () => run(permissions, async () => ({ documents: await service.getLoginPageFiles() })),
  );
  server.registerTool(
    "request_platform_login_document_upload",
    {
      description:
        "Request a one-use native multipart upload for a public login-page document. Provide a document name and file metadata, then send local bytes using uploadRequest. Uses the native file limit of 1 GiB and existing document validators.",
      inputSchema: asMcpInputSchema(Schemas.customizationLoginFileInputSchema),
      annotations: write,
    },
    async (input) =>
      run(permissions, (actor) =>
        uploadGrants.issuePlatformAssetGrant(actor, { asset: "loginDocument", ...input }),
      ),
  );
  server.registerTool(
    "delete_platform_login_document",
    {
      description:
        "Remove a public login page document, confirming its exact current name. This does not delete users or groups.",
      inputSchema: asMcpInputSchema(Schemas.customizationDeleteLoginFileInputSchema),
      annotations: { ...write, destructiveHint: true },
    },
    async (input) =>
      run(permissions, async () => {
        const documents = await service.getLoginPageFiles();
        const document = documents.resources.find((item) => item.id === input.id);
        if (!document) throw new NotFoundException("Login document not found");
        if (document.name !== input.confirmName)
          throw new BadRequestException("Document name confirmation does not match");
        await service.deleteLoginPageFile(input.id);
        return { deleted: true };
      }),
  );
}
