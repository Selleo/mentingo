import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getRichTextResourceTypeFromAsset, AssetTypeIcon } from "./assetLibrary.utils";

import type { ResourceLibraryAsset } from "~/api/queries/useResourceLibraryAssets";

const audioAsset = {
  type: "other",
  contentType: "audio/mpeg",
  fileName: "track.mp3",
  originalFilename: "track.mp3",
} as ResourceLibraryAsset;

describe("audio asset library", () => {
  it("inserts stored audio resources as players rather than ordinary other-file links", () => {
    expect(getRichTextResourceTypeFromAsset(audioAsset)).toBe("audio");
  });
  it("uses the audio icon for audio resources classified as other by the API", () => {
    const { container } = render(<AssetTypeIcon type="other" contentType="audio/mpeg" />);
    expect(container.querySelector(".lucide-file-headphone")).not.toBeNull();
  });
});
