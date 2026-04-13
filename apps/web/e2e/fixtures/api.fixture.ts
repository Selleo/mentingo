import { test as base } from "@playwright/test";

import { createFixtureApiClient } from "../utils/api-client";

import type { FixtureApiClient } from "../utils/api-client";

export const apiFixture = base.extend<{
  apiClient: FixtureApiClient;
}>({
  apiClient: async ({ baseURL }, use) => {
    void baseURL;
    await use(createFixtureApiClient());
  },
});
