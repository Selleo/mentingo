import { describe, expect, it } from "vitest";

import { createInlineDiff, INLINE_DIFF_SEGMENT_TYPE } from "./inlineDiff";

describe("createInlineDiff", () => {
  it("keeps the complete text while marking inserted and removed words", () => {
    const result = createInlineDiff(
      "Ask one question about the need",
      "Ask two focused questions about the client need",
    );

    expect(
      result
        .filter(({ type }) => type !== INLINE_DIFF_SEGMENT_TYPE.ADDED)
        .map(({ value }) => value)
        .join(""),
    ).toBe("Ask one question about the need");
    expect(
      result
        .filter(({ type }) => type !== INLINE_DIFF_SEGMENT_TYPE.REMOVED)
        .map(({ value }) => value)
        .join(""),
    ).toBe("Ask two focused questions about the client need");
  });
});
