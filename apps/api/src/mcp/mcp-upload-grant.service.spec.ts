import { ENTITY_TYPES, SCORM_IMPORT_ACTION } from "@repo/shared";
import { TypeCompiler } from "@sinclair/typebox/compiler";

import {
  createScormCourseInputSchema,
  requestGenericFileUploadInputSchema,
} from "./mcp-tool.schemas";
import {
  assertGenericFileUploadGrant,
  assertScormUploadGrant,
} from "./mcp-upload-grant.assertions";

import type { McpGenericFileUploadGrant, McpScormUploadGrant } from "./mcp.types";

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
