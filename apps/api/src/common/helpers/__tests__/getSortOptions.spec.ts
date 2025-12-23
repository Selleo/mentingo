import { asc, desc } from "drizzle-orm";

import { getSortOptions } from "../getSortOptions";

describe("getSortOptions", () => {
  it("returns asc order for field without prefix", () => {
    const result = getSortOptions("name");

    expect(result.sortOrder).toBe(asc);
    expect(result.sortedField).toBe("name");
  });

  it("returns desc order for field with - prefix", () => {
    const result = getSortOptions("-name");

    expect(result.sortOrder).toBe(desc);
    expect(result.sortedField).toBe("name");
  });

  it("handles undefined sort", () => {
    const result = getSortOptions(undefined);

    expect(result.sortOrder).toBe(asc);
    expect(result.sortedField).toBe("");
  });

  it("handles empty string", () => {
    const result = getSortOptions("");

    expect(result.sortOrder).toBe(asc);
    expect(result.sortedField).toBe("");
  });

  it("handles field with multiple dashes", () => {
    const result = getSortOptions("-created-at");

    expect(result.sortOrder).toBe(desc);
    expect(result.sortedField).toBe("created-at");
  });

  it("preserves field name for asc sort", () => {
    const result = getSortOptions("createdAt");

    expect(result.sortedField).toBe("createdAt");
  });

  it("only removes leading dash for desc sort", () => {
    const result = getSortOptions("-some-field-name");

    expect(result.sortedField).toBe("some-field-name");
  });
});
