import { ENTITY_TYPES, PERMISSIONS } from "@repo/shared";

import { FILE_SIZE_BASE } from "src/common/constants";
import { MAX_FILE_SIZE } from "src/file/file.constants";
import { AVATAR_MAX_SIZE } from "src/user/user.constants";

import {
  assertPlatformAssetUploadGrant,
  assertUserAvatarUploadGrant,
} from "./mcp-upload-grant.assertions";
import { McpUploadGrantService, mcpUploadGrantKey } from "./mcp-upload-grant.service";
import { withMcpUploadInstructions } from "./mcp-upload-response";
import { MCP_UPLOAD_GRANT_KIND } from "./mcp.types";

import type { McpPlatformAssetUploadGrant, McpUserAvatarUploadGrant } from "./mcp.types";
import type { Request } from "express";
import type { CurrentUserType } from "src/common/types/current-user.type";

const userId = "11111111-1111-4111-8111-111111111111";
const tenantId = "22222222-2222-4222-8222-222222222222";
const actor: CurrentUserType = {
  userId,
  tenantId,
  email: "actor@example.com",
  permissions: [PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.ACCOUNT_UPDATE_SELF],
  roleSlugs: [],
};
const image = { filename: "image.png", mimeType: "image/png", size: 1024 };

function setup() {
  const store = new Map<string, string>();
  const redis = {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    sendCommand: jest.fn(async ([command, key]: string[]) => {
      if (command !== "GETDEL") return null;
      const value = store.get(key) ?? null;
      store.delete(key);
      return value;
    }),
  };
  const identity = { resolveIdentity: jest.fn().mockResolvedValue(actor.email) };
  const resources = { fromRequest: jest.fn().mockResolvedValue({ tenantId }) };
  const permissions = {
    getUserAccess: jest.fn().mockResolvedValue({ permissions: actor.permissions, roleSlugs: [] }),
  };
  const runner = {
    runWithTenantContext: jest.fn(async (_tenantId: string, callback: () => unknown) => callback()),
  };
  const unused = {} as never;
  const service = new McpUploadGrantService(
    redis as never,
    identity as never,
    resources as never,
    permissions as never,
    runner as never,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
    unused,
  );
  return { service, store, redis, identity, resources, permissions, runner };
}
const request = (token: string, path: string, method = "PATCH") =>
  ({ path, method, headers: { authorization: `Bearer ${token}` } }) as unknown as Request;

describe("MCP platform and own avatar native multipart grants", () => {
  it.each([
    ["platformLogo", "/api/settings/platform-logo", "logo"],
    ["platformSimpleLogo", "/api/settings/platform-simple-logo", "logo"],
    ["loginBackground", "/api/settings/login-background", "login-background"],
    ["certificateBackground", "/api/settings/certificate-background", "certificate-background"],
  ] as const)("issues %s for its native route and limit", async (asset, uploadPath, fileField) => {
    const { service } = setup();
    const grant = await service.issuePlatformAssetGrant(actor, {
      ...image,
      size: FILE_SIZE_BASE,
      asset,
    });
    expect(grant).toMatchObject({
      uploadPath,
      fileField,
      maxSizeBytes: FILE_SIZE_BASE,
      method: "PATCH",
      fields: {},
    });
    await expect(
      service.issuePlatformAssetGrant(actor, { ...image, size: FILE_SIZE_BASE + 1, asset }),
    ).rejects.toThrow("Unsupported upload file");
    const result = await service.authenticate(request(grant.token, uploadPath));
    expect(result.grant).toMatchObject({
      targetType: ENTITY_TYPES.GLOBAL_SETTINGS,
      targetId: tenantId,
      asset,
    });
    await expect(service.authenticate(request(grant.token, uploadPath))).rejects.toThrow(
      "already used",
    );
  });

  it("preserves full native document and avatar limits", async () => {
    const { service } = setup();
    const document = await service.issuePlatformAssetGrant(actor, {
      asset: "loginDocument",
      filename: "policy.pdf",
      mimeType: "application/pdf",
      size: MAX_FILE_SIZE,
      name: "Policy",
    });
    expect(document).toMatchObject({
      uploadPath: "/api/settings/admin/login-page-files",
      maxSizeBytes: MAX_FILE_SIZE,
      fileField: "file",
      fields: { name: "Policy" },
    });
    await expect(
      service.issuePlatformAssetGrant(actor, {
        asset: "loginDocument",
        filename: "policy.pdf",
        mimeType: "application/pdf",
        size: MAX_FILE_SIZE + 1,
        name: "Policy",
      }),
    ).rejects.toThrow();
    const avatar = await service.issueUserAvatarGrant(actor, { ...image, size: AVATAR_MAX_SIZE });
    expect(avatar).toMatchObject({
      uploadPath: "/api/user/profile",
      maxSizeBytes: AVATAR_MAX_SIZE,
      fileField: "userAvatar",
      fields: { data: "{}" },
    });
    await expect(
      service.issueUserAvatarGrant(actor, { ...image, size: AVATAR_MAX_SIZE + 1 }),
    ).rejects.toThrow();
    await expect(
      service.issuePlatformAssetGrant(actor, { ...image, asset: "loginDocument" }),
    ).rejects.toThrow();
    await expect(
      service.issuePlatformAssetGrant(actor, { ...image, asset: "platformLogo", name: "unbound" }),
    ).rejects.toThrow();
  });

  it("returns concrete tenant multipart instructions for the new native routes", async () => {
    const { service } = setup();
    const grant = await service.issueUserAvatarGrant(actor, image);
    const response = withMcpUploadInstructions(grant, "https://tenant.example.com/api/mcp", image);
    expect(response).toMatchObject({
      maxSizeBytes: AVATAR_MAX_SIZE,
      uploadUrl: "https://tenant.example.com/api/user/profile",
      acceptedFile: { filename: image.filename, mimeType: image.mimeType, sizeBytes: image.size },
      uploadRequest: {
        method: "PATCH",
        bodyType: "multipart/form-data",
        fileField: "userAvatar",
        fields: { data: "{}" },
      },
    });
  });

  it("binds native path and method before consuming and rejects a different tenant", async () => {
    const { service, store, resources } = setup();
    const grant = await service.issueUserAvatarGrant(actor, image);
    await expect(
      service.authenticate(request(grant.token, "/api/user/profile", "POST")),
    ).rejects.toThrow("another target");
    await expect(
      service.authenticate(request(grant.token, "/api/settings/platform-logo")),
    ).rejects.toThrow("another target");
    resources.fromRequest.mockResolvedValue({ tenantId: userId });
    await expect(service.authenticate(request(grant.token, "/api/user/profile"))).rejects.toThrow(
      "another tenant",
    );
    expect(store.has(mcpUploadGrantKey(grant.token))).toBe(true);
  });

  it.each(["platform", "avatar"] as const)(
    "rechecks active identity and exact revoked %s permission before consuming",
    async (kind) => {
      const { service, permissions, identity, store } = setup();
      const grant =
        kind === "platform"
          ? await service.issuePlatformAssetGrant(actor, { ...image, asset: "platformLogo" })
          : await service.issueUserAvatarGrant(actor, image);
      permissions.getUserAccess.mockResolvedValue({
        permissions: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.FILE_UPLOAD],
        roleSlugs: [],
      });
      await expect(service.authenticate(request(grant.token, grant.uploadPath))).rejects.toThrow(
        "permission was revoked",
      );
      identity.resolveIdentity.mockResolvedValue(null);
      await expect(service.authenticate(request(grant.token, grant.uploadPath))).rejects.toThrow(
        "no longer active",
      );
      expect(store.has(mcpUploadGrantKey(grant.token))).toBe(true);
    },
  );

  it("checks fresh permission and identity during issuance", async () => {
    const { service, permissions, identity, redis } = setup();
    permissions.getUserAccess.mockResolvedValue({ permissions: [], roleSlugs: [] });
    await expect(
      service.issuePlatformAssetGrant(actor, { ...image, asset: "platformLogo" }),
    ).rejects.toThrow("permission was revoked");
    identity.resolveIdentity.mockResolvedValue(null);
    await expect(service.issueUserAvatarGrant(actor, image)).rejects.toThrow("no longer active");
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("rejects expired or actor-target tampered grants before claiming", async () => {
    const { service, store } = setup();
    const issued = await service.issueUserAvatarGrant(actor, image);
    const key = mcpUploadGrantKey(issued.token);
    const grant = JSON.parse(store.get(key)!) as McpUserAvatarUploadGrant;
    store.set(key, JSON.stringify({ ...grant, targetId: tenantId }));
    await expect(service.authenticate(request(issued.token, issued.uploadPath))).rejects.toThrow(
      "Invalid avatar upload grant",
    );
    store.set(key, JSON.stringify({ ...grant, expiresAt: Date.now() - 1 }));
    await expect(service.authenticate(request(issued.token, issued.uploadPath))).rejects.toThrow(
      "expired",
    );
    expect(store.has(key)).toBe(true);
  });

  it("binds platform file name/type/size/field and exact document name/body", async () => {
    const { service, store } = setup();
    const document = { filename: "policy.pdf", mimeType: "application/pdf", size: 1024 };
    const issued = await service.issuePlatformAssetGrant(actor, {
      ...document,
      asset: "loginDocument",
      name: "Policy",
    });
    const grant = JSON.parse(
      store.get(mcpUploadGrantKey(issued.token))!,
    ) as McpPlatformAssetUploadGrant;
    const file = {
      fieldname: "file",
      originalname: document.filename,
      mimetype: document.mimeType,
      size: document.size,
    } as Express.Multer.File;
    expect(() =>
      assertPlatformAssetUploadGrant(grant, "loginDocument", file, { name: "Policy" }),
    ).not.toThrow();
    for (const changed of [
      { originalname: "other.png" },
      { mimetype: "text/html" },
      { size: 1 },
      { fieldname: "logo" },
    ])
      expect(() =>
        assertPlatformAssetUploadGrant(
          grant,
          "loginDocument",
          { ...file, ...changed },
          { name: "Policy" },
        ),
      ).toThrow();
    expect(() =>
      assertPlatformAssetUploadGrant(grant, "loginDocument", undefined, { name: "Policy" }),
    ).toThrow();
    expect(() =>
      assertPlatformAssetUploadGrant(grant, "loginDocument", file, { name: "Other" }),
    ).toThrow();
    expect(() =>
      assertPlatformAssetUploadGrant(grant, "loginDocument", file, { name: "Policy", id: userId }),
    ).toThrow();
    expect(() =>
      assertPlatformAssetUploadGrant(
        { ...grant, asset: "platformLogo" },
        "platformLogo",
        { ...file, fieldname: "logo" },
        { primaryColor: "#fff" },
      ),
    ).toThrow();
  });

  it("binds own avatar and rejects all unrelated profile edits", async () => {
    const { service, store } = setup();
    const issued = await service.issueUserAvatarGrant(actor, image);
    const grant = JSON.parse(
      store.get(mcpUploadGrantKey(issued.token))!,
    ) as McpUserAvatarUploadGrant;
    expect(grant.kind).toBe(MCP_UPLOAD_GRANT_KIND.USER_AVATAR);
    const file = {
      fieldname: "userAvatar",
      originalname: image.filename,
      mimetype: image.mimeType,
      size: image.size,
    } as Express.Multer.File;
    expect(() =>
      assertUserAvatarUploadGrant(grant, userId, file, {}, { data: "{}" }),
    ).not.toThrow();
    expect(() => assertUserAvatarUploadGrant(grant, tenantId, file, {}, { data: "{}" })).toThrow();
    expect(() =>
      assertUserAvatarUploadGrant(
        grant,
        userId,
        file,
        { removeAvatar: true },
        { data: '{"removeAvatar":true}' },
      ),
    ).toThrow();
    expect(() =>
      assertUserAvatarUploadGrant(grant, userId, file, {}, { data: "{}", firstName: "Edit" }),
    ).toThrow();
    expect(() =>
      assertUserAvatarUploadGrant(
        grant,
        userId,
        file,
        {},
        { data: '{"email":"other@example.com"}' },
      ),
    ).toThrow();
    expect(() =>
      assertUserAvatarUploadGrant(grant, userId, undefined, {}, { data: "{}" }),
    ).toThrow();
  });
});
