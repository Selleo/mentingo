import { beforeEach, describe, expect, it } from "vitest";

import {
  assetSelectionKey,
  readOmittedAssets,
  writeOmittedAssets,
} from "./authoringAssetSelection";

describe("optional asset selections", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("restores skipped images only in their course and session", () => {
    const key = assetSelectionKey("course", "session");
    writeOmittedAssets(key, ["image"]);
    expect(readOmittedAssets(key)).toEqual(["image"]);
    expect(readOmittedAssets(assetSelectionKey("other-course", "session"))).toEqual([]);
    expect(readOmittedAssets(assetSelectionKey("course", "other-session"))).toEqual([]);
    writeOmittedAssets(key, []);
    expect(readOmittedAssets(key)).toEqual([]);
  });

  it("ignores malformed selections instead of breaking the drawer", () => {
    const key = assetSelectionKey("course", "session");
    window.sessionStorage.setItem(key, "invalid json");
    expect(readOmittedAssets(key)).toEqual([]);
    window.sessionStorage.setItem(key, JSON.stringify(["image", 3, null, "image"]));
    expect(readOmittedAssets(key)).toEqual(["image"]);
  });
});
