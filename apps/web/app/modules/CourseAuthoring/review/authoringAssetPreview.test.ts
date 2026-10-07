import { describe, expect, it } from "vitest";

import {
  getAuthoringAssetIds,
  getAuthoringAssetLabels,
  withAuthoringAssetPreviewUrls,
} from "./authoringAssetPreview";

const firstAssetId = "11111111-1111-4111-8111-111111111111";
const secondAssetId = "22222222-2222-4222-8222-222222222222";

describe("authoring asset previews", () => {
  it("keeps readable file labels before and after image preview resolution", () => {
    const content = `<img data-authoring-asset-id="${firstAssetId}" alt="Tasks &amp; evidence">`;
    const labels = { [firstAssetId]: "Tasks & evidence" };
    expect(getAuthoringAssetLabels(content)).toEqual(labels);
    expect(
      getAuthoringAssetLabels(
        withAuthoringAssetPreviewUrls(content, { [firstAssetId]: "blob:image" }),
      ),
    ).toEqual(labels);
  });

  it("finds unique canonical asset markers in lesson HTML", () => {
    expect(
      getAuthoringAssetIds(
        `<img data-authoring-asset-id="${firstAssetId}"><img data-authoring-asset-id='${firstAssetId}'>` +
          `<img data-authoring-asset-id="${secondAssetId}">`,
      ),
    ).toEqual([firstAssetId, secondAssetId]);
  });

  it("resolves ready placeholders to native image nodes and retains their asset markers", () => {
    const content =
      `<p>Review this diagram:</p><img data-authoring-asset-id="${firstAssetId}" ` +
      `alt='Diagram with "quoted" &amp; escaped text'>`;

    const resolved = withAuthoringAssetPreviewUrls(content, {
      [firstAssetId]: "blob:authoring-preview",
    });

    expect(resolved).toContain('data-node-type="image"');
    expect(resolved).toContain('data-src="blob:authoring-preview"');
    expect(resolved).toContain(`data-authoring-asset-id="${firstAssetId}"`);
    expect(resolved).toContain('data-alt="Diagram with &quot;quoted&quot; &amp; escaped text"');
    expect(resolved).not.toContain(`<img data-authoring-asset-id="${firstAssetId}"`);
  });

  it("preserves unresolved image positions as native pending nodes", () => {
    const resolved = withAuthoringAssetPreviewUrls(
      `<p>Before</p><img data-authoring-asset-id="${firstAssetId}" alt="Waiting"><p>After</p>`,
      {},
    );
    expect(resolved).toContain('data-node-type="image" data-src=""');
    expect(resolved).toContain(`data-authoring-asset-id="${firstAssetId}"`);
    expect(resolved).toContain('data-alt="Waiting"');
  });

  it("converts existing plain images into the native editor node", () => {
    const resolved = withAuthoringAssetPreviewUrls(
      '<img src="/api/lesson/lesson-resource/resource-id" alt="Existing">',
      {},
    );
    expect(resolved).toContain('data-node-type="image"');
    expect(resolved).toContain('data-src="/api/lesson/lesson-resource/resource-id"');
  });
});
