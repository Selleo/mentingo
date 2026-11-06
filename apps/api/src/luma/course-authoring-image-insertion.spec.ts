/** Explicit references distinguish asset use from text that happens to mention its UUID. */
import { referencedAuthoringAssets } from "./course-authoring-image-insertion";

describe("image insertion asset references", () => {
  it("finds structured and HTML assets without treating an image UUID in prose as usage", () => {
    const assetId = "00000000-0000-4000-8000-000000000001";
    const base = {
      operationId: assetId,
      targetId: assetId,
      baselineHash: "a".repeat(64),
      language: "en" as const,
      dependencies: [],
    };
    expect(
      referencedAuthoringAssets({
        ...base,
        type: "lesson.metadata.update",
        payload: { title: `Reference ${assetId}` },
      }).size,
    ).toBe(0);
    expect(
      referencedAuthoringAssets({
        ...base,
        type: "course.metadata.update",
        payload: { thumbnailAssetId: assetId },
      }).has(assetId),
    ).toBe(true);
    expect(
      referencedAuthoringAssets({
        ...base,
        type: "lesson.block.replace",
        payload: {
          blockId: assetId,
          html: `<img data-authoring-asset-id="${assetId}" src="authoring-asset:${assetId}">`,
        },
      }).has(assetId),
    ).toBe(true);
  });
});
