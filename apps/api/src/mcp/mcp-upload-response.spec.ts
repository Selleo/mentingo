import { withMcpUploadInstructions } from "./mcp-upload-response";

const result = {
  uploadPath: "/api/articles/item/upload",
  method: "POST",
  token: "mcpup_example",
  fileField: "file",
  fields: { language: "pl" },
};

describe("MCP upload response follow-up guidance", () => {
  it("returns complete upload instructions and durable article insertion guidance together", () => {
    const response = withMcpUploadInstructions(result, "https://tenant.example/api/mcp", {
      resource: "articles",
      targetId: "item",
      language: "pl",
      mimeType: "image/png",
      filename: "photo.png",
      size: 512,
    });
    expect(response.uploadUrl).toBe("https://tenant.example/api/articles/item/upload");
    expect(response.uploadRequest).toMatchObject({
      method: "POST",
      fileField: "file",
      fields: { language: "pl" },
      headers: { Authorization: "Bearer mcpup_example" },
    });
    expect(response.contentInsertion).toMatchObject({
      resourceIdSource: "data.resourceId",
      resourceUrlTemplate: "/api/articles/articles-resource/{resourceId}",
      nextTool: "update_article",
      revisionTool: "get_article",
      targetId: "item",
      language: "pl",
      needsFreshRevision: true,
    });
  });

  it("also guides direct authoring uploads and keeps raw files distinct", () => {
    expect(
      withMcpUploadInstructions(result, "https://tenant.example/api/mcp", {
        targetType: "news",
        targetId: "item",
        language: "en",
        mimeType: "application/pdf",
        filename: "doc.pdf",
      }).contentInsertion,
    ).toMatchObject({ nextTool: "update_news", resourceIdSource: "data.resourceId" });
    expect(
      withMcpUploadInstructions(result, "https://tenant.example/api/mcp", { resource: "course" })
        .contentInsertion,
    ).toMatchObject({ fileKeySource: "fileKey", resourceIdSource: null });
  });

  it("keeps platform grants free of unrelated rich content guidance", () => {
    expect(
      withMcpUploadInstructions(result, "https://tenant.example/api/mcp", {
        kind: "platformLogo",
        filename: "logo.png",
      }),
    ).not.toHaveProperty("contentInsertion");
  });

  it("retains the dedicated TUS flow for videos", () => {
    const response = withMcpUploadInstructions(
      { tusEndpoint: "/api/file/videos/tus" },
      "https://tenant.example/api/mcp",
      { targetType: "articles", targetId: "item", mimeType: "video/mp4" },
    );
    expect(response.contentInsertion).toMatchObject({
      purpose: "video",
      transport: "tus",
      nextTool: "get_video_upload_status",
    });
    expect(response).not.toHaveProperty("uploadRequest");
  });
});
