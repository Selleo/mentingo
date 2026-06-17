import { IMAGE_QUALITY } from "../image-variant.constants";
import {
  getAllImageVariantKeys,
  getImageVariantKey,
  isImageVariantReference,
  isSupportedImageVariantMimeType,
} from "../image-variant.utils";

describe("image variant utils", () => {
  it("detects variant references", () => {
    expect(isImageVariantReference("tenant/course/variants/image.webp")).toBe(true);
    expect(isImageVariantReference("tenant/course/image.png")).toBe(false);
  });

  it("injects quality before the extension for variant references", () => {
    expect(getImageVariantKey("tenant/course/variants/image.webp", IMAGE_QUALITY.MEDIUM)).toBe(
      "tenant/course/variants/image-960w.webp",
    );
  });

  it("builds all concrete variant keys for a logical variant reference", () => {
    expect(getAllImageVariantKeys("tenant/course/variants/image.webp")).toEqual([
      "tenant/course/variants/image-640w.webp",
      "tenant/course/variants/image-960w.webp",
      "tenant/course/variants/image-1280w.webp",
      "tenant/course/variants/image-1920w.webp",
    ]);
  });

  it("keeps legacy references unchanged", () => {
    expect(getImageVariantKey("tenant/course/image.png", IMAGE_QUALITY.HIGH)).toBe(
      "tenant/course/image.png",
    );
  });

  it("only supports configured raster image MIME types", () => {
    expect(isSupportedImageVariantMimeType("image/jpeg")).toBe(true);
    expect(isSupportedImageVariantMimeType("image/png")).toBe(true);
    expect(isSupportedImageVariantMimeType("image/webp")).toBe(true);
    expect(isSupportedImageVariantMimeType("image/svg+xml")).toBe(false);
    expect(isSupportedImageVariantMimeType("application/pdf")).toBe(false);
  });
});
