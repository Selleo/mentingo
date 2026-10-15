import { PERMISSIONS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { FILE_SIZE_BASE } from "src/common/constants";
import { REQUIRED_PERMISSIONS_KEY } from "src/common/decorators/require-permission.decorator";
import { MAX_FILE_SIZE } from "src/file/file.constants";
import { SettingsController } from "src/settings/settings.controller";

import * as Schemas from "./mcp-customization-tool.schemas";
import {
  MCP_CUSTOMIZATION_TOOL_NAMES,
  registerMcpCustomizationTools,
} from "./mcp-customization-tools";

import type { McpToolRunner } from "./mcp-tool-runner.types";
import type { McpUploadGrantService } from "./mcp-upload-grant.service";
import type { McpServer } from "@modelcontextprotocol/server";
import type { SettingsService } from "src/settings/settings.service";

const id = "11111111-1111-4111-8111-111111111111";
const actor = {
  userId: id,
  tenantId: id,
  email: "admin@example.com",
  permissions: [PERMISSIONS.SETTINGS_MANAGE],
  roleSlugs: [],
};

function setup() {
  const handlers = new Map<string, (input?: any) => Promise<any>>();
  const server = {
    registerTool: jest.fn((name, _config, callback) => handlers.set(name, callback)),
  } as unknown as McpServer;
  const run = jest.fn(async (permissions, callback) => {
    expect(permissions).toEqual([PERMISSIONS.SETTINGS_MANAGE]);
    return { content: [], structuredContent: await callback(actor) };
  });
  const service = {
    getGlobalSettings: jest
      .fn()
      .mockResolvedValue({ calendarEnabled: true, enforceSSO: true, MFAEnforcedRoles: ["admin"] }),
    getPlatformLogoUrl: jest.fn().mockResolvedValue(null),
    getPlatformSimpleLogoUrl: jest.fn().mockResolvedValue(null),
    getLoginBackgroundImageUrl: jest.fn().mockResolvedValue(null),
    updateGlobalCalendarEnabled: jest.fn().mockResolvedValue({ calendarEnabled: false }),
    getLoginPageFiles: jest.fn().mockResolvedValue({ resources: [{ id, name: "Policy" }] }),
    deleteLoginPageFile: jest.fn(),
    uploadPlatformLogo: jest.fn(),
  };
  const grant = {
    uploadPath: "/api/settings/admin/login-page-files",
    token: "mcpup_test",
    method: "PATCH",
    fileField: "file",
    fields: { name: "Policy" },
  };
  const uploads = { issuePlatformAssetGrant: jest.fn().mockResolvedValue(grant) };
  registerMcpCustomizationTools(
    server,
    run as McpToolRunner,
    service as unknown as SettingsService,
    uploads as unknown as McpUploadGrantService,
  );
  return { handlers, run, service, uploads, grant };
}

describe("MCP platform customization", () => {
  it("registers the declared catalog and strips authentication policy", async () => {
    const { handlers } = setup();
    expect([...handlers.keys()].sort()).toEqual([...MCP_CUSTOMIZATION_TOOL_NAMES].sort());
    expect(
      (await handlers.get("get_platform_customization")!()).structuredContent.settings,
    ).toEqual({ calendarEnabled: true });
    expect(handlers.has("update_platform_image")).toBe(false);
    expect(handlers.has("upload_platform_login_document")).toBe(false);
  });

  it("rejects excluded security settings and unknown nested registration fields", () => {
    expect(
      Value.Check(Schemas.customizationFlagInputSchema, {
        setting: "enforceSSO",
        idempotencyKey: "a",
      }),
    ).toBe(false);
    expect(
      Value.Check(Schemas.customizationCompanyInputSchema, {
        companyName: "Acme",
        MFAEnforcedRoles: [],
      }),
    ).toBe(false);
    const field = {
      type: "checkbox",
      label: { en: "Agree" },
      required: true,
      displayOrder: 1,
      archived: false,
    };
    expect(Value.Check(Schemas.customizationRegistrationInputSchema, { fields: [field] })).toBe(
      true,
    );
    expect(
      Value.Check(Schemas.customizationRegistrationInputSchema, {
        fields: [{ ...field, security: true }],
      }),
    ).toBe(false);
  });

  it("uses native size limits and accepts metadata rather than inline bytes or URLs", () => {
    const image = { kind: "platformLogo", filename: "logo.png", mimeType: "image/png", size: 512 };
    const doc = {
      name: "Policy",
      filename: "policy.pdf",
      mimeType: "application/pdf",
      size: 10 * FILE_SIZE_BASE,
    };
    expect(Value.Check(Schemas.customizationImageInputSchema, image)).toBe(true);
    expect(
      Value.Check(Schemas.customizationImageInputSchema, { ...image, size: FILE_SIZE_BASE + 1 }),
    ).toBe(false);
    expect(Value.Check(Schemas.customizationLoginFileInputSchema, doc)).toBe(true);
    expect(
      Value.Check(Schemas.customizationLoginFileInputSchema, { ...doc, size: MAX_FILE_SIZE }),
    ).toBe(true);
    expect(
      Value.Check(Schemas.customizationLoginFileInputSchema, { ...doc, size: MAX_FILE_SIZE + 1 }),
    ).toBe(false);
    for (const extra of [
      { base64: "YWJj" },
      { file: { url: "https://example.com/file" } },
      { id: "another-document" },
    ]) {
      expect(Value.Check(Schemas.customizationLoginFileInputSchema, { ...doc, ...extra })).toBe(
        false,
      );
    }
    expect(
      Value.Check(Schemas.customizationImageInputSchema, { ...image, filename: "../logo.png" }),
    ).toBe(false);
  });

  it("passes actor and exact target/file metadata to native grant issuance", async () => {
    const { handlers, uploads, grant } = setup();
    const image = { kind: "loginBackground", filename: "bg.png", mimeType: "image/png", size: 512 };
    expect((await handlers.get("request_platform_image_upload")!(image)).structuredContent).toEqual(
      grant,
    );
    expect(uploads.issuePlatformAssetGrant).toHaveBeenCalledWith(actor, {
      asset: "loginBackground",
      filename: "bg.png",
      mimeType: "image/png",
      size: 512,
    });
    const doc = {
      name: "Policy",
      filename: "policy.pdf",
      mimeType: "application/pdf",
      size: 10 * FILE_SIZE_BASE,
    };
    await handlers.get("request_platform_login_document_upload")!(doc);
    expect(uploads.issuePlatformAssetGrant).toHaveBeenLastCalledWith(actor, {
      asset: "loginDocument",
      ...doc,
    });
  });

  it("retains explicit feature toggles with retry keys and actor-bound image removal", async () => {
    const { handlers, service } = setup();
    expect(Value.Check(Schemas.customizationFlagInputSchema, { setting: "calendarEnabled" })).toBe(
      false,
    );
    await handlers.get("toggle_platform_customization_flag")!({
      setting: "calendarEnabled",
      idempotencyKey: "calendar-op",
    });
    expect(service.updateGlobalCalendarEnabled).toHaveBeenCalledWith(actor);
    await handlers.get("remove_platform_image")!({ kind: "platformLogo" });
    expect(service.uploadPlatformLogo).toHaveBeenCalledWith(null, actor);
  });

  it("requires exact current name before deleting a login document", async () => {
    const { handlers, service } = setup();
    await expect(
      handlers.get("delete_platform_login_document")!({ id, confirmName: "Wrong" }),
    ).rejects.toThrow("Document name confirmation does not match");
    expect(service.deleteLoginPageFile).not.toHaveBeenCalled();
    await handlers.get("delete_platform_login_document")!({ id, confirmName: "Policy" });
    expect(service.deleteLoginPageFile).toHaveBeenCalledWith(id);
  });

  it.each([
    SettingsController.prototype.updatePlatformLogo,
    SettingsController.prototype.updatePlatformSimpleLogo,
    SettingsController.prototype.updateLoginBackground,
    SettingsController.prototype.updateCertificateBackground,
    SettingsController.prototype.updateLoginPageFiles,
  ])("uses the same native upload permission as the controller", (handler) => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, handler)).toEqual([
      PERMISSIONS.SETTINGS_MANAGE,
    ]);
  });
});
