import { describe, expect, it } from "vitest";

import { extractResourceIdFromUrl } from "../resourceNode";

const resourceId = "11111111-1111-4111-8111-111111111111";

describe("resourceNode", () => {
  it("extracts lesson resource ids from absolute URLs", () => {
    expect(
      extractResourceIdFromUrl(
        `https://tenant.lms.localhost/api/lesson/lesson-resource/${resourceId}`,
      ),
    ).toBe(resourceId);
  });

  it("extracts article and news resource ids from relative URLs", () => {
    expect(extractResourceIdFromUrl(`/api/articles/articles-resource/${resourceId}`)).toBe(
      resourceId,
    );
    expect(extractResourceIdFromUrl(`/api/news/news-resource/${resourceId}?download=true`)).toBe(
      resourceId,
    );
  });

  it("ignores external URLs", () => {
    expect(extractResourceIdFromUrl("https://www.youtube.com/watch?v=abc")).toBeNull();
  });
});
