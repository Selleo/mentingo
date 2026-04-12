import { test as base } from "@playwright/test";

import { createFixtureApiClient } from "../utils/api-client";

import type { FixtureApiClient } from "../utils/api-client";

export const apiFixture = base.extend<{
  apiClient: FixtureApiClient;
}>({
  apiClient: async (_args, use) => {
    await use(createFixtureApiClient());
  },
});
