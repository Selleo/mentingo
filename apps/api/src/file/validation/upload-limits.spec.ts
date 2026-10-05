import {
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_FILE_SIZE_BYTES,
  MAX_SETTINGS_IMAGE_FILE_SIZE_BYTES,
  MAX_AVATAR_FILE_SIZE_BYTES,
  MAX_SCORM_PACKAGE_SIZE_BYTES,
} from "@repo/shared";

describe("shared upload limits", () => {
  it("bounds buffered and asset-specific uploads", () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(100 * 1024 * 1024);
    expect(MAX_IMAGE_FILE_SIZE_BYTES).toBe(20 * 1024 * 1024);
    expect(MAX_SETTINGS_IMAGE_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_AVATAR_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
    expect(MAX_SCORM_PACKAGE_SIZE_BYTES).toBe(512 * 1024 * 1024);
  });
});
