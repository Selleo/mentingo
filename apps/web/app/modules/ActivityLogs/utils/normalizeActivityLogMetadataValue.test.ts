import { describe, expect, it } from "vitest";

import { normalizeActivityLogMetadataValue } from "./normalizeActivityLogMetadataValue";

describe("normalizeActivityLogMetadataValue", () => {
  it("recursively parses JSON-encoded objects and arrays", () => {
    expect(
      normalizeActivityLogMetadataValue({
        groups: '[{"id":"11111111-1111-4111-8111-111111111111","name":"Example group"}]',
      }),
    ).toEqual({
      groups: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Example group",
        },
      ],
    });
  });

  it("keeps ordinary and malformed strings unchanged", () => {
    expect(normalizeActivityLogMetadataValue("Example text")).toBe("Example text");
    expect(normalizeActivityLogMetadataValue("{invalid JSON}")).toBe("{invalid JSON}");
  });
});
