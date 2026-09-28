import { ENTITY_TYPES, PERMISSIONS, SCORM_IMPORT_ACTION } from "@repo/shared";
import { TypeCompiler } from "@sinclair/typebox/compiler";

import {
  createScormCourseInputSchema,
  requestGenericFileUploadInputSchema,
} from "./mcp-tool.schemas";
import {
  assertGenericFileUploadGrant,
  assertScormUploadGrant,
} from "./mcp-upload-grant.assertions";
import { mcpUploadGrantKey, McpUploadGrantService } from "./mcp-upload-grant.service";

import type { McpGenericFileUploadGrant, McpScormUploadGrant } from "./mcp.types";
import type { Request } from "express";

const userId = "11111111-1111-4111-8111-111111111111";
const tenantId = "22222222-2222-4222-8222-222222222222";
const categoryId = "33333333-3333-4333-8333-333333333333";

describe("MCP native upload grants", () => {
  it("accepts a bound generic course image and rejects another resource", () => {
    const grant: McpGenericFileUploadGrant = {
      kind: "genericFile",
      resource: ENTITY_TYPES.COURSE,
      userId,
      tenantId,
      filename: "cover.png",
      mimeType: "image/png",
      size: 4,
      expiresAt: Date.now() + 1000,
    };
    const file = {
      originalname: "cover.png",
      mimetype: "image/png",
      size: 4,
    } as Express.Multer.File;

    expect(() => assertGenericFileUploadGrant(grant, ENTITY_TYPES.COURSE, file)).not.toThrow();
    expect(() => assertGenericFileUploadGrant(grant, ENTITY_TYPES.LESSON, file)).toThrow();
  });

  it("accepts a bound SCORM course ZIP and thumbnail and rejects a different thumbnail", () => {
    const grant: McpScormUploadGrant = {
      operation: SCORM_IMPORT_ACTION.CREATE_COURSE,
      targetType: ENTITY_TYPES.COURSE,
      targetId: categoryId,
      categoryId,
      userId,
      tenantId,
      language: "en",
      title: "Safety",
      description: "Training",
      filename: "course.zip",
      mimeType: "application/zip",
      size: 8,
      thumbnailFilename: "cover.png",
      thumbnailMimeType: "image/png",
      thumbnailSize: 4,
      expiresAt: Date.now() + 1000,
    };
    const zip = {
      originalname: "course.zip",
      mimetype: "application/zip",
      size: 8,
    } as Express.Multer.File;
    const thumbnail = {
      originalname: "cover.png",
      mimetype: "image/png",
      size: 4,
    } as Express.Multer.File;
    const metadata = { title: "Safety", description: "Training", categoryId, language: "en" };

    expect(() =>
      assertScormUploadGrant(
        grant,
        SCORM_IMPORT_ACTION.CREATE_COURSE,
        zip,
        metadata,
        undefined,
        thumbnail,
      ),
    ).not.toThrow();
    expect(() =>
      assertScormUploadGrant(grant, SCORM_IMPORT_ACTION.CREATE_COURSE, zip, metadata),
    ).toThrow();
    expect(() =>
      assertScormUploadGrant(grant, SCORM_IMPORT_ACTION.CREATE_COURSE, zip, metadata, undefined, {
        ...thumbnail,
        size: 5,
      }),
    ).toThrow();
  });

  it("exposes only native non-video generic file types and validates SCORM thumbnail metadata", () => {
    const genericInput = TypeCompiler.Compile(requestGenericFileUploadInputSchema);
    expect(
      genericInput.Check({
        resource: ENTITY_TYPES.COURSE,
        filename: "cover.png",
        mimeType: "image/png",
        size: 4,
      }),
    ).toBe(true);
    expect(
      genericInput.Check({
        resource: ENTITY_TYPES.COURSE,
        filename: "clip.mp4",
        mimeType: "video/mp4",
        size: 4,
      }),
    ).toBe(false);

    const scormInput = TypeCompiler.Compile(createScormCourseInputSchema);
    const input = {
      title: "Safety",
      description: "Training",
      categoryId,
      language: "en",
      filename: "course.zip",
      mimeType: "application/zip",
      size: 8,
      thumbnail: { filename: "cover.png", mimeType: "image/png", size: 4 },
    };
    expect(scormInput.Check(input)).toBe(true);
    expect(
      scormInput.Check({
        ...input,
        thumbnail: { ...input.thumbnail, mimeType: "application/pdf" },
      }),
    ).toBe(false);
  });
});

describe("McpUploadGrantService.authenticate", () => {
  const buildService = (redisStore: Map<string, string>, accessPermissions: string[]) => {
    const redis = {
      get: jest.fn((key: string) => Promise.resolve(redisStore.get(key) ?? null)),
      sendCommand: jest.fn(([command, key]: string[]) => {
        if (command !== "GETDEL") return Promise.resolve(null);
        const value = redisStore.get(key) ?? null;
        redisStore.delete(key);
        return Promise.resolve(value);
      }),
    };
    const resourceService = {
      fromRequest: jest.fn(() =>
        Promise.resolve({ tenantId, origin: "https://tenant.example.com", url: "" }),
      ),
    };
    const tokenService = { resolveIdentity: jest.fn(() => Promise.resolve("actor@example.com")) };
    const permissionsService = {
      getUserAccess: jest.fn(() =>
        Promise.resolve({ permissions: accessPermissions, roleSlugs: [] }),
      ),
    };
    const tenantDbRunnerService = {
      runWithTenantContext: jest.fn((_tenantId: string, fn: () => unknown) => fn()),
    };
    const unused = {} as never;

    return new McpUploadGrantService(
      redis as never,
      tokenService as never,
      resourceService as never,
      permissionsService as never,
      tenantDbRunnerService as never,
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
  };

  const storeGrant = (redisStore: Map<string, string>, token: string, expiresAt: number) => {
    const grant: McpGenericFileUploadGrant = {
      kind: "genericFile",
      resource: ENTITY_TYPES.COURSE,
      userId,
      tenantId,
      filename: "cover.png",
      mimeType: "image/png",
      size: 4,
      expiresAt,
    };
    redisStore.set(mcpUploadGrantKey(token), JSON.stringify(grant));
  };

  const buildRequest = (token: string): Request =>
    ({
      method: "POST",
      path: "/api/file",
      headers: { authorization: `Bearer ${token}` },
    }) as unknown as Request;

  it("does not consume the grant when a later authorization check fails", async () => {
    const redisStore = new Map<string, string>();
    const token = "mcpup_token-a";
    storeGrant(redisStore, token, Date.now() + 60_000);
    const service = buildService(redisStore, []); // no FILE_UPLOAD permission

    await expect(service.authenticate(buildRequest(token))).rejects.toThrow(
      "Authoring permission was revoked",
    );

    expect(redisStore.has(mcpUploadGrantKey(token))).toBe(true);
  });

  it("consumes the grant exactly once after all checks pass", async () => {
    const redisStore = new Map<string, string>();
    const token = "mcpup_token-b";
    storeGrant(redisStore, token, Date.now() + 60_000);
    const service = buildService(redisStore, [PERMISSIONS.FILE_UPLOAD, PERMISSIONS.COURSE_CREATE]);

    const { grant } = await service.authenticate(buildRequest(token));
    expect(grant.userId).toBe(userId);
    expect(redisStore.has(mcpUploadGrantKey(token))).toBe(false);

    await expect(service.authenticate(buildRequest(token))).rejects.toThrow(
      "Upload grant expired or already used",
    );
  });
});
