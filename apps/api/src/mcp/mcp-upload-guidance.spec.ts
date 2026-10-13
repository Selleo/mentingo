import { ENTITY_TYPES } from "@repo/shared";

import { buildMcpUploadFollowUp, MCP_UPLOAD_INSTRUCTIONS_SERVER } from "./mcp-upload-guidance";

const input = {
  resource: ENTITY_TYPES.ARTICLES,
  targetId: "11111111-1111-4111-8111-111111111111",
  language: "en",
  filename: 'Guide & "photo" <a>.png',
  mimeType: "image/png",
  size: 123,
};

describe("MCP file upload guidance", () => {
  it("documents the generic editorial parameters and one-use native multipart flow", () => {
    for (const text of [
      "request_generic_file_upload",
      "targetId",
      "language",
      "filename",
      "mimeType",
      "size",
      "uploadRequest.url",
      "Authorization",
      "one-use",
      "data.resourceId",
      "expectedRevision",
      "init_video_upload",
      "TUS",
    ])
      expect(MCP_UPLOAD_INSTRUCTIONS_SERVER).toContain(text);
  });

  it.each([ENTITY_TYPES.ARTICLES, ENTITY_TYPES.NEWS])(
    "provides durable %s image nodes with safe filename escaping",
    (resource) => {
      const result = buildMcpUploadFollowUp({ ...input, resource });
      expect(result).toMatchObject({
        resourceIdSource: "data.resourceId",
        resourceUrlTemplate: `/api/${resource}/${resource}-resource/{resourceId}`,
        targetId: input.targetId,
        language: "en",
        needsFreshRevision: true,
        nextTool: resource === ENTITY_TYPES.ARTICLES ? "update_article" : "update_news",
      });
      const templates = result!.htmlTemplates as Record<string, string>;
      expect(templates.preview).toContain('data-node-type="image"');
      expect(templates.preview).toContain('data-resource-id="{resourceId}"');
      expect(templates.preview).toContain('data-alt="Guide &amp; &quot;photo&quot; &lt;a&gt;.png"');
      expect(templates.preview).toContain(`/api/${resource}/${resource}-resource/{resourceId}`);
      expect(templates.preview).not.toContain("/api/lesson/");
      expect(templates.download).toBeUndefined();
    },
  );

  it("supports the authoring targetType alias and PDF preview/download modes", () => {
    const result = buildMcpUploadFollowUp({
      ...input,
      resource: undefined,
      targetType: ENTITY_TYPES.NEWS,
      mimeType: "application/pdf",
    });
    expect(result).toMatchObject({
      displayModes: ["preview", "download"],
      revisionTool: "get_news",
      nextTool: "update_news",
    });
    const templates = result!.htmlTemplates as Record<string, string>;
    expect(templates.preview).toContain('data-node-type="pdf-preview"');
    expect(templates.download).toContain('data-node-type="downloadable-file"');
  });

  it("supports native presentation and download-only document nodes", () => {
    const presentation = buildMcpUploadFollowUp({
      ...input,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    })!;
    expect((presentation.htmlTemplates as Record<string, string>).preview).toContain(
      'data-node-type="presentation"',
    );
    expect((presentation.htmlTemplates as Record<string, string>).download).toContain(
      'data-node-type="downloadable-file"',
    );
    const document = buildMcpUploadFollowUp({ ...input, mimeType: "application/msword" })!;
    expect(document.displayModes).toEqual(["download"]);
  });

  it("directs lesson resources to insertion with a fresh revision", () => {
    const result = buildMcpUploadFollowUp({
      targetType: ENTITY_TYPES.LESSON,
      targetId: input.targetId,
      language: "en",
      mimeType: "image/png",
    });
    expect(result).toMatchObject({
      nextTool: "insert_lesson_resource",
      revisionTool: "get_lesson",
      resourceIdSource: "data.resourceId",
      needsFreshRevision: true,
    });
  });

  it.each([ENTITY_TYPES.COURSE, ENTITY_TYPES.LESSON])(
    "distinguishes raw generic %s top-level fileKey from linked resources",
    (resource) => {
      expect(buildMcpUploadFollowUp({ ...input, resource })).toMatchObject({
        purpose: "rawGenericFile",
        fileKeySource: "fileKey",
        fileUrlSource: "fileUrl",
        resourceIdSource: null,
      });
    },
  );

  it("keeps native covers and TUS video instructions separate from content insertion", () => {
    const cover = buildMcpUploadFollowUp({
      ...input,
      resource: undefined,
      targetType: ENTITY_TYPES.NEWS,
      translations: [{ language: "en", title: "News" }],
    });
    expect(cover).toMatchObject({ purpose: "localizedCover", appliedByNativeUpload: true });
    expect(cover!.htmlTemplates).toBeUndefined();
    const video = buildMcpUploadFollowUp({ ...input, transport: "tus", mimeType: "video/mp4" });
    expect(video).toMatchObject({
      purpose: "video",
      transport: "tus",
      nextTool: "get_video_upload_status",
    });
    expect(video!.htmlTemplates).toBeUndefined();
  });

  it("does not give content upload instructions for platform, avatar or course media grants", () => {
    expect(
      buildMcpUploadFollowUp({
        asset: "platformLogo",
        filename: "logo.png",
        mimeType: "image/png",
      }),
    ).toBeUndefined();
    expect(
      buildMcpUploadFollowUp({
        targetType: ENTITY_TYPES.USER,
        filename: "avatar.png",
        mimeType: "image/png",
      }),
    ).toBeUndefined();
    expect(
      buildMcpUploadFollowUp({
        courseId: input.targetId,
        kind: "thumbnail",
        mimeType: "image/png",
      }),
    ).toBeUndefined();
  });
});
