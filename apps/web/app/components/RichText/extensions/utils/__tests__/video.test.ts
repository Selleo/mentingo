import { VIDEO_EMBED_PROVIDERS } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { normalizeVideoEmbedAttributes } from "../video";

describe("normalizeVideoEmbedAttributes", () => {
  it("detects external provider when provider is unknown", () => {
    expect(
      normalizeVideoEmbedAttributes({
        src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        sourceType: "external",
        provider: VIDEO_EMBED_PROVIDERS.UNKNOWN,
      }).provider,
    ).toBe(VIDEO_EMBED_PROVIDERS.YOUTUBE);
  });

  it("keeps explicit resolved provider", () => {
    expect(
      normalizeVideoEmbedAttributes({
        src: "/api/lesson/lesson-resource/11111111-1111-1111-1111-111111111111",
        sourceType: "internal",
        provider: VIDEO_EMBED_PROVIDERS.BUNNY,
      }).provider,
    ).toBe(VIDEO_EMBED_PROVIDERS.BUNNY);
  });

  it("defaults internal resources with unknown provider to self", () => {
    expect(
      normalizeVideoEmbedAttributes({
        src: "/api/lesson/lesson-resource/11111111-1111-1111-1111-111111111111",
        sourceType: "internal",
        provider: VIDEO_EMBED_PROVIDERS.UNKNOWN,
      }).provider,
    ).toBe(VIDEO_EMBED_PROVIDERS.SELF);
  });
});
