import { USER_ROLE } from "~/config/userRoles";

import { test as base } from "../../fixtures/test.fixture";
import { ensureArticlesModuleEnabled } from "../../utils/content-features";

export const test = base.extend<{ _articlesEnabled: void }>({
  _articlesEnabled: [
    async ({ apiClient, withWorkerPage }, use) => {
      await withWorkerPage(USER_ROLE.admin, async () => {
        await ensureArticlesModuleEnabled(apiClient);
      });

      await use();
    },
    { auto: true },
  ],
});

export { expect } from "../../fixtures/test.fixture";
