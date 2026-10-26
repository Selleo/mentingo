import { mergeResourceMetadataPreservingDuration } from "./master-course-resource.utils";

describe("mergeResourceMetadataPreservingDuration", () => {
  it("keeps the source duration when it is valid", () => {
    expect(
      mergeResourceMetadataPreservingDuration(
        { durationSeconds: 120, originalFilename: "source.mp4" },
        { durationSeconds: 90 },
      ),
    ).toEqual({ durationSeconds: 120, originalFilename: "source.mp4" });
  });

  it("preserves a discovered target duration when the source has none", () => {
    expect(
      mergeResourceMetadataPreservingDuration(
        { originalFilename: "source.mp4" },
        { durationSeconds: 90 },
      ),
    ).toEqual({ originalFilename: "source.mp4", durationSeconds: 90 });
  });

  it("does not copy an invalid target duration", () => {
    expect(
      mergeResourceMetadataPreservingDuration(
        { originalFilename: "source.mp4" },
        { durationSeconds: "90" },
      ),
    ).toEqual({ originalFilename: "source.mp4" });
  });
});
