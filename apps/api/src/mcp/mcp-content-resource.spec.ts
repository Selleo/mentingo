import { BadRequestException } from "@nestjs/common";

import { renderLessonResourceNode } from "./mcp-content-resource";

const base = { resourceId: "11111111-1111-1111-1111-111111111111", name: "file.ext" };

describe("renderLessonResourceNode", () => {
  it("renders an image node in preview mode", () => {
    const html = renderLessonResourceNode({
      ...base,
      contentType: "image/png",
      displayMode: "preview",
    });
    expect(html).toContain('data-node-type="image"');
    expect(html).toContain(`data-resource-id="${base.resourceId}"`);
  });

  it("rejects an image in download mode", () => {
    expect(() =>
      renderLessonResourceNode({ ...base, contentType: "image/png", displayMode: "download" }),
    ).toThrow(BadRequestException);
  });

  it("renders a video node in preview mode", () => {
    const html = renderLessonResourceNode({
      ...base,
      contentType: "video/mp4",
      displayMode: "preview",
    });
    expect(html).toContain('data-node-type="video"');
  });

  it("rejects a video in download mode", () => {
    expect(() =>
      renderLessonResourceNode({ ...base, contentType: "video/mp4", displayMode: "download" }),
    ).toThrow(BadRequestException);
  });

  it("renders a presentation inline for preview and as a downloadable file otherwise", () => {
    const contentType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    expect(renderLessonResourceNode({ ...base, contentType, displayMode: "preview" })).toContain(
      'data-node-type="presentation"',
    );
    expect(renderLessonResourceNode({ ...base, contentType, displayMode: "download" })).toContain(
      'data-node-type="downloadable-file"',
    );
  });

  it("renders a pdf inline for preview and as a downloadable file otherwise", () => {
    expect(
      renderLessonResourceNode({
        ...base,
        contentType: "application/pdf",
        displayMode: "preview",
      }),
    ).toContain('data-node-type="pdf-preview"');
    expect(
      renderLessonResourceNode({
        ...base,
        contentType: "application/pdf",
        displayMode: "download",
      }),
    ).toContain('data-node-type="downloadable-file"');
  });

  it("renders word/excel documents as downloadable files in download mode only", () => {
    const html = renderLessonResourceNode({
      ...base,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      displayMode: "download",
    });
    expect(html).toContain('data-node-type="downloadable-file"');

    expect(() =>
      renderLessonResourceNode({
        ...base,
        contentType: "text/csv",
        displayMode: "preview",
      }),
    ).toThrow(BadRequestException);
  });

  it("rejects an unrecognized content type", () => {
    expect(() =>
      renderLessonResourceNode({
        ...base,
        contentType: "application/zip",
        displayMode: "preview",
      }),
    ).toThrow(BadRequestException);
  });

  it("escapes attribute values in the rendered name", () => {
    const html = renderLessonResourceNode({
      resourceId: base.resourceId,
      name: '"><script>alert(1)</script>',
      contentType: "application/pdf",
      displayMode: "download",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
