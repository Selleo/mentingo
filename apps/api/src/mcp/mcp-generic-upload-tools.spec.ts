import { ENTITY_TYPES, FEATURES, FEATURE_SETTINGS_KEYS, PERMISSIONS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { registerMcpGenericUploadTool } from "./mcp-generic-upload-tools";
import { canListMcpTool } from "./mcp-tool-access";
import { requestGenericFileUploadInputSchema } from "./mcp-tool.schemas";

import type { McpToolRunner } from "./mcp-tool-runner.types";
import type { McpUploadGrantService } from "./mcp-upload-grant.service";
import type { McpServer } from "@modelcontextprotocol/server";
import type { SettingsService } from "src/settings/settings.service";

const actor = {
  userId: "actor",
  tenantId: "tenant",
  permissions: [],
  roleSlugs: [],
  email: "test@example.com",
};
const file = { filename: "image.png", mimeType: "image/png", size: 512 };
function setup() {
  const registerTool = jest.fn();
  const run = jest.fn(async (_permissions, operation) => ({
    content: [],
    structuredContent: await operation(actor),
  }));
  const uploads = {
    issueEditorialGrant: jest.fn().mockResolvedValue({ token: "editorial" }),
    issueGenericFileGrant: jest.fn().mockResolvedValue({ token: "raw" }),
  };
  registerMcpGenericUploadTool(
    { registerTool } as unknown as McpServer,
    run as McpToolRunner,
    uploads as unknown as McpUploadGrantService,
  );
  return {
    handler: registerTool.mock.calls[0][2],
    config: registerTool.mock.calls[0][1],
    uploads,
    run,
  };
}

describe("Generic MCP content uploads", () => {
  it.each([
    [ENTITY_TYPES.ARTICLES, [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN]],
    [ENTITY_TYPES.NEWS, [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN]],
  ])(
    "routes %s through its resource-aware native upload with exact permissions",
    async (resource, permissions) => {
      const { handler, uploads, run } = setup();
      await handler({ resource, targetId: "content-id", language: "pl", ...file });
      expect(run).toHaveBeenCalledWith(permissions, expect.any(Function));
      expect(uploads.issueEditorialGrant).toHaveBeenCalledWith(actor, {
        targetType: resource,
        targetId: "content-id",
        language: "pl",
        ...file,
      });
      expect(uploads.issueGenericFileGrant).not.toHaveBeenCalled();
    },
  );

  it.each([ENTITY_TYPES.ARTICLES, ENTITY_TYPES.NEWS])(
    "requires an existing target and language for %s",
    async (resource) => {
      const { handler, uploads } = setup();
      for (const input of [
        { resource, ...file },
        { resource, targetId: "id", ...file },
        { resource, language: "en", ...file },
      ])
        await expect(handler(input)).rejects.toThrow("require targetId and language");
      expect(uploads.issueEditorialGrant).not.toHaveBeenCalled();
    },
  );

  it.each([ENTITY_TYPES.COURSE, ENTITY_TYPES.LESSON])(
    "preserves raw generic uploads for %s",
    async (resource) => {
      const { handler, uploads, run } = setup();
      await handler({ resource, ...file });
      expect(run).toHaveBeenCalledWith([PERMISSIONS.FILE_UPLOAD], expect.any(Function));
      expect(uploads.issueGenericFileGrant).toHaveBeenCalledWith(actor, { resource, ...file });
      expect(uploads.issueEditorialGrant).not.toHaveBeenCalled();
      await expect(handler({ resource, ...file, targetId: "id", language: "en" })).rejects.toThrow(
        "do not take targetId or language",
      );
    },
  );

  it("rejects videos, invalid languages and undeclared upload fields", () => {
    const input = {
      resource: ENTITY_TYPES.ARTICLES,
      targetId: "11111111-1111-4111-8111-111111111111",
      language: "pl",
      ...file,
    };
    expect(Value.Check(requestGenericFileUploadInputSchema, input)).toBe(true);
    for (const changed of [
      { ...input, mimeType: "video/mp4" },
      { ...input, language: "xx" },
      { ...input, file: "base64" },
      { ...input, userId: "other" },
    ])
      expect(Value.Check(requestGenericFileUploadInputSchema, changed)).toBe(false);
  });

  it("makes generic upload discoverable for enabled editorial areas without unrelated file permission", () => {
    const enabled = {
      [FEATURE_SETTINGS_KEYS[FEATURES.ARTICLES]]: true,
      [FEATURE_SETTINGS_KEYS[FEATURES.NEWS]]: true,
    } as Awaited<ReturnType<SettingsService["getGlobalSettings"]>>;
    const disabled = {} as typeof enabled;
    for (const permission of [PERMISSIONS.ARTICLE_MANAGE_OWN, PERMISSIONS.NEWS_MANAGE_OWN]) {
      expect(canListMcpTool("request_generic_file_upload", [permission], enabled)).toBe(true);
      expect(canListMcpTool("request_generic_file_upload", [permission], disabled)).toBe(false);
    }
    expect(canListMcpTool("request_generic_file_upload", [], enabled)).toBe(false);
    expect(canListMcpTool("request_generic_file_upload", [PERMISSIONS.FILE_UPLOAD], enabled)).toBe(
      false,
    );
    expect(
      canListMcpTool(
        "request_generic_file_upload",
        [PERMISSIONS.FILE_UPLOAD, PERMISSIONS.COURSE_CREATE],
        enabled,
      ),
    ).toBe(true);
  });
});
