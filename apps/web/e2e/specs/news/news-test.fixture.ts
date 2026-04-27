import { USER_ROLE } from "~/config/userRoles";

import { test as base } from "../../fixtures/test.fixture";
import { ensureNewsModuleEnabled } from "../../utils/content-features";

export const test = base.extend<{ _newsEnabled: void }>({
  _newsEnabled: [
    async ({ apiClient, withWorkerPage }, use) => {
      await withWorkerPage(USER_ROLE.admin, async () => {
        await ensureNewsModuleEnabled(apiClient);
      });

      await use();
    },
    { auto: true },
  ],
});

export { expect } from "../../fixtures/test.fixture";
