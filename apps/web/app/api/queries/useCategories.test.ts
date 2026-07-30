import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "../api-client";

import { categoriesQueryOptions } from "./useCategories";

vi.mock("../api-client", () => ({
  ApiClient: {
    api: {
      categoryControllerGetAllCategories: vi.fn(),
    },
  },
}));

describe("categoriesQueryOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ApiClient.api.categoryControllerGetAllCategories).mockResolvedValue({
      data: { data: [], pagination: { page: 1, perPage: 100, totalItems: 0 } },
    } as Awaited<ReturnType<typeof ApiClient.api.categoryControllerGetAllCategories>>);
  });

  it("passes the requested language to the categories endpoint", async () => {
    const query = categoriesQueryOptions({ language: SUPPORTED_LANGUAGES.PL });

    await query.queryFn();

    expect(ApiClient.api.categoryControllerGetAllCategories).toHaveBeenCalledWith({
      language: SUPPORTED_LANGUAGES.PL,
      page: 1,
      perPage: 100,
    });
  });
});
