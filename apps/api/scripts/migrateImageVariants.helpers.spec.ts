import {
  getReferenceSkipReason,
  getResourceFolderFromReference,
  hasAllVariantKeys,
  selectBestExistingVariantSourceKey,
} from "./migrateImageVariants.helpers";

describe("migrateImageVariants helpers", () => {
  it("skips empty, remote, and Bunny references", () => {
    expect(getReferenceSkipReason(null)).toBe("empty");
    expect(getReferenceSkipReason("https://example.com/image.png")).toBe("remote_url");
    expect(getReferenceSkipReason("http://example.com/image.png")).toBe("remote_url");
    expect(getReferenceSkipReason("bunny-video-id")).toBe("bunny_video");
    expect(getReferenceSkipReason("tenant/courses/image.png")).toBeNull();
  });

  it("selects the highest quality existing variant as a repair source", () => {
    const reference = "tenant/courses/variants/image.webp";
    const existingKeys = new Set([
      "tenant/courses/variants/image-160w.webp",
      "tenant/courses/variants/image-960w.webp",
      "tenant/courses/variants/image-1280w.webp",
    ]);

    expect(selectBestExistingVariantSourceKey(reference, existingKeys)).toBe(
      "tenant/courses/variants/image-1280w.webp",
    );
  });

  it("detects complete variant sets", () => {
    const reference = "tenant/courses/variants/image.webp";
    const completeKeys = new Set([
      "tenant/courses/variants/image-160w.webp",
      "tenant/courses/variants/image-320w.webp",
      "tenant/courses/variants/image-640w.webp",
      "tenant/courses/variants/image-960w.webp",
      "tenant/courses/variants/image-1280w.webp",
      "tenant/courses/variants/image-1920w.webp",
    ]);

    expect(hasAllVariantKeys(reference, completeKeys)).toBe(true);

    completeKeys.delete("tenant/courses/variants/image-160w.webp");

    expect(hasAllVariantKeys(reference, completeKeys)).toBe(false);
  });

  it("derives resource folders without duplicating tenant prefixes or variants paths", () => {
    expect(getResourceFolderFromReference("tenant/courses/image.png", "tenant")).toBe("courses");
    expect(getResourceFolderFromReference("tenant/courses/hero/image.png", "tenant")).toBe(
      "courses/hero",
    );
    expect(getResourceFolderFromReference("tenant/courses/variants/image.webp", "tenant")).toBe(
      "courses",
    );
  });
});
