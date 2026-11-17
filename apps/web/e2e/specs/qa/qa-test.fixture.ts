import { USER_ROLE } from "~/config/userRoles";

import { test as base } from "../../fixtures/test.fixture";
import { ensureQAEnabled } from "../../utils/qa-features";

import type { PageHandle } from "../../fixtures/types";
import type { UserRole } from "~/config/userRoles";

type WithAuthPageOptions = {
  root?: boolean;
};

type WithAuthPage = (
  role: UserRole,
  run: (handle: PageHandle) => Promise<void>,
  options?: WithAuthPageOptions,
) => Promise<void>;

export const test = base.extend<{
  withWorkerPage: WithAuthPage;
}>({
  withWorkerPage: async (
    {
      apiClient,
      withWorkerPage,
    }: {
      apiClient: Parameters<typeof ensureQAEnabled>[0];
      withWorkerPage: WithAuthPage;
    },
    use: (value: WithAuthPage) => Promise<void>,
  ) => {
    await use(async (role, run, options) => {
      // Non-admin roles cannot change settings, so enable Q&A as admin first.
      if (role !== USER_ROLE.admin) {
        await withWorkerPage(USER_ROLE.admin, async () => {
          await ensureQAEnabled(apiClient);
        });
      }

      await withWorkerPage(
        role,
        async (handle) => {
          if (role === USER_ROLE.admin) {
            await ensureQAEnabled(apiClient);
          }

          await run(handle);
        },
        options,
      );
    });
  },
});

export { expect } from "../../fixtures/test.fixture";
