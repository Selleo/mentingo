import { createFixtureFactories } from "../factories";

import { apiFixture } from "./api.fixture";

import type { FixtureFactories } from "../factories";

export const factoryFixture = apiFixture.extend<{
  factories: FixtureFactories;
}>({
  factories: async ({ apiClient }, use) => {
    await use(createFixtureFactories(apiClient));
  },
});
