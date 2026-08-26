import { test as base } from "../../fixtures/test.fixture";
import { ensureNewsModuleEnabled } from "../../utils/content-features";

export const test = base.extend<{ _newsEnabled: void }>({
  _newsEnabled: [
    async ({ workerTenantApiClient }, use) => {
      await ensureNewsModuleEnabled(workerTenantApiClient);

      await use();
    },
    { auto: true },
  ],
});

export { expect } from "../../fixtures/test.fixture";
