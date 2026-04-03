import { test as base } from "@playwright/test";

import { createFixtureApiClient } from "../api/client";

import type { FixtureApiClient } from "../api/client";

export const apiFixture = base.extend<{
  apiClient: FixtureApiClient;
}>({
  apiClient: async (args, use) => {
    void args;
    await use(createFixtureApiClient());
  },
});
