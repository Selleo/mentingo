import { ForbiddenException } from "@nestjs/common";
import {
  ALLOWED_AVATAR_IMAGE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  LOGIN_PAGE_DOCUMENTS_FILE_TYPES,
  ENTITY_TYPES,
  PERMISSIONS,
} from "@repo/shared";

import { FILE_SIZE_BASE } from "src/common/constants";
import { MAX_FILE_SIZE } from "src/file/file.constants";
import { FileGuard } from "src/file/guards/file.guard";
import { SettingsController } from "src/settings/settings.controller";
import { AVATAR_MAX_SIZE } from "src/user/user.constants";
import { UserController } from "src/user/user.controller";

import { MCP_UPLOAD_GRANT_KIND } from "./mcp.types";

import type {
  McpPlatformAssetUploadGrant,
  McpRequest,
  McpUserAvatarUploadGrant,
} from "./mcp.types";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { SettingsService } from "src/settings/settings.service";
import type { UserImportService } from "src/user/services/user-import.service";
import type { UserPasswordEmailService } from "src/user/services/user-password-email.service";
import type { UserService } from "src/user/user.service";

const userId = "11111111-1111-4111-8111-111111111111";
const tenantId = "22222222-2222-4222-8222-222222222222";
const actor: CurrentUserType = {
  userId,
  tenantId,
  email: "admin@example.com",
  roleSlugs: [],
  permissions: [PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.ACCOUNT_UPDATE_SELF],
};

function file(fieldname = "logo", mimeType = "image/png"): Express.Multer.File {
  return {
    fieldname,
    originalname: "asset.png",
    mimetype: mimeType,
    size: 4,
    buffer: Buffer.from("test"),
  } as Express.Multer.File;
}

function platformGrant(asset: McpPlatformAssetUploadGrant["asset"]): McpPlatformAssetUploadGrant {
  return {
    kind: MCP_UPLOAD_GRANT_KIND.PLATFORM_ASSET,
    targetType: ENTITY_TYPES.GLOBAL_SETTINGS,
    targetId: tenantId,
    asset,
    userId,
    tenantId,
    filename: "asset.png",
    mimeType: "image/png",
    size: 4,
    expiresAt: Date.now() + 1000,
    ...(asset === "loginDocument" && { name: "Policy" }),
  };
}

function avatarGrant(): McpUserAvatarUploadGrant {
  return {
    kind: MCP_UPLOAD_GRANT_KIND.USER_AVATAR,
    targetType: ENTITY_TYPES.USER,
    targetId: userId,
    userId,
    tenantId,
    filename: "asset.png",
    mimeType: "image/png",
    size: 4,
    expiresAt: Date.now() + 1000,
  };
}

function request(
  grant?: McpRequest["mcpUploadGrant"],
  body: Record<string, unknown> = {},
): McpRequest {
  return { mcpUploadGrant: grant, body } as McpRequest;
}

const routes = [
  {
    method: "updatePlatformLogo",
    service: "uploadPlatformLogo",
    asset: "platformLogo",
    field: "logo",
    allowedTypes: ALLOWED_AVATAR_IMAGE_TYPES,
  },
  {
    method: "updatePlatformSimpleLogo",
    service: "uploadPlatformSimpleLogo",
    asset: "platformSimpleLogo",
    field: "logo",
    allowedTypes: ALLOWED_AVATAR_IMAGE_TYPES,
  },
  {
    method: "updateLoginBackground",
    service: "uploadLoginBackgroundImage",
    asset: "loginBackground",
    field: "login-background",
    allowedTypes: ALLOWED_LESSON_IMAGE_FILE_TYPES,
  },
  {
    method: "updateCertificateBackground",
    service: "updateCertificateBackground",
    asset: "certificateBackground",
    field: "certificate-background",
    allowedTypes: ALLOWED_LESSON_IMAGE_FILE_TYPES,
  },
] as const;

describe("MCP administrative native upload controller boundaries", () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(routes)("dispatches a bound $asset upload through native validation", async (route) => {
    const upload = jest.fn();
    const controller = new SettingsController({
      [route.service]: upload,
    } as unknown as SettingsService);
    const validate = jest.spyOn(FileGuard, "validateFile").mockResolvedValue({
      type: { mime: undefined, ext: undefined },
      size: 4,
      resolution: null,
      aspectRatio: null,
    });
    const image = file(route.field);
    await controller[route.method](image, actor, request(platformGrant(route.asset)));
    expect(validate).toHaveBeenCalledWith(image, {
      allowedTypes: route.allowedTypes,
      maxSize: FILE_SIZE_BASE,
    });
    expect(upload).toHaveBeenCalledWith(image, actor);
  });

  it.each(routes)(
    "rejects omitted files, changed metadata and unrelated fields for $asset",
    async (route) => {
      const upload = jest.fn();
      const controller = new SettingsController({
        [route.service]: upload,
      } as unknown as SettingsService);
      const grant = platformGrant(route.asset);
      for (const image of [
        null,
        { ...file(route.field), originalname: "other.png" },
        { ...file(route.field), mimetype: "image/jpeg" },
        { ...file(route.field), size: 5 },
      ]) {
        await expect(controller[route.method](image, actor, request(grant))).rejects.toThrow(
          ForbiddenException,
        );
      }
      await expect(
        controller[route.method](file(route.field), actor, request(grant, { enforceSSO: true })),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller[route.method](file(route.field), actor, request(platformGrant("loginDocument"))),
      ).rejects.toThrow(ForbiddenException);
      expect(upload).not.toHaveBeenCalled();
    },
  );

  it("rejects declared MIME that does not match the detected bytes before storing branding", async () => {
    const uploadPlatformLogo = jest.fn();
    const controller = new SettingsController({ uploadPlatformLogo } as unknown as SettingsService);
    jest.spyOn(FileGuard, "getFileType").mockResolvedValue({ mime: "image/jpeg", ext: "jpg" });
    await expect(
      controller.updatePlatformLogo(file(), actor, request(platformGrant("platformLogo"))),
    ).rejects.toThrow("files.toast.contentTypeMismatch");
    expect(uploadPlatformLogo).not.toHaveBeenCalled();
  });

  it("binds public document names and retains the native document size limit", async () => {
    const uploadLoginPageFile = jest.fn();
    const controller = new SettingsController({
      uploadLoginPageFile,
    } as unknown as SettingsService);
    const validate = jest.spyOn(FileGuard, "validateFile").mockResolvedValue({
      type: { mime: undefined, ext: undefined },
      size: 4,
      resolution: null,
      aspectRatio: null,
    });
    const grant = platformGrant("loginDocument");
    const document = file("file");
    for (const body of [{ name: "Other" }, { name: "Policy", enforceSSO: true }, {}]) {
      await expect(
        controller.updateLoginPageFiles(
          body as { name: string },
          document,
          actor,
          request(grant, body),
        ),
      ).rejects.toThrow(ForbiddenException);
    }
    expect(uploadLoginPageFile).not.toHaveBeenCalled();
    await controller.updateLoginPageFiles(
      { name: "Policy" },
      document,
      actor,
      request(grant, { name: "Policy" }),
    );
    expect(validate).toHaveBeenCalledWith(document, {
      allowedTypes: LOGIN_PAGE_DOCUMENTS_FILE_TYPES,
      maxSize: MAX_FILE_SIZE,
    });
    expect(uploadLoginPageFile).toHaveBeenCalledWith({ name: "Policy" }, document, actor);
  });

  it("accepts only a bound own-avatar file with empty profile metadata", async () => {
    const updateUserProfile = jest.fn();
    const controller = new UserController(
      { updateUserProfile } as unknown as UserService,
      {} as UserImportService,
      {} as UserPasswordEmailService,
    );
    const validate = jest.spyOn(FileGuard, "validateFile").mockResolvedValue({
      type: { mime: undefined, ext: undefined },
      size: 4,
      resolution: null,
      aspectRatio: null,
    });
    const image = file("userAvatar");
    const grant = avatarGrant();
    await expect(
      controller.updateUserProfile({ data: {} }, userId, undefined, request(grant, { data: "{}" })),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      controller.updateUserProfile({ data: {} }, tenantId, image, request(grant, { data: "{}" })),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      controller.updateUserProfile(
        { data: { firstName: "Changed" } },
        userId,
        image,
        request(grant, { data: '{"firstName":"Changed"}' }),
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      controller.updateUserProfile(
        { data: {} },
        userId,
        image,
        request(grant, { data: "{}", enforceSSO: true }),
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      controller.updateUserProfile(
        { data: {} },
        userId,
        image,
        request(grant, { data: '{"archived":true}' }),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(updateUserProfile).not.toHaveBeenCalled();
    await controller.updateUserProfile({ data: {} }, userId, image, request(grant, { data: "{}" }));
    expect(validate).toHaveBeenCalledWith(image, {
      allowedTypes: ALLOWED_AVATAR_IMAGE_TYPES,
      maxSize: AVATAR_MAX_SIZE,
    });
    expect(updateUserProfile).toHaveBeenCalledWith(userId, {}, image);
  });

  it("keeps native logo removal and profile metadata updates available without a grant", async () => {
    const uploadPlatformLogo = jest.fn();
    const settings = new SettingsController({ uploadPlatformLogo } as unknown as SettingsService);
    await settings.updatePlatformLogo(null, actor, request());
    expect(uploadPlatformLogo).toHaveBeenCalledWith(null, actor);
    const updateUserProfile = jest.fn();
    const users = new UserController(
      { updateUserProfile } as unknown as UserService,
      {} as UserImportService,
      {} as UserPasswordEmailService,
    );
    await users.updateUserProfile(
      { data: { firstName: "Native" } },
      userId,
      undefined,
      request(undefined, { data: '{"firstName":"Native"}' }),
    );
    expect(updateUserProfile).toHaveBeenCalledWith(userId, { firstName: "Native" }, undefined);
  });
});
