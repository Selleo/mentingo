import { test as base } from "@playwright/test";

import { getWorkerAuthStatePath } from "../utils/auth-email";

import type { PageHandle } from "./types";
import type { UserRole } from "~/config/userRoles";

type PageRunner = (handle: PageHandle) => Promise<void>;

type WithAuthPage = (role: UserRole, run: PageRunner) => Promise<void>;

export const pageFixture = base.extend<{
  withWorkerPage: WithAuthPage;
}>({
  withWorkerPage: async ({ browser }, use, testInfo) => {
    await use(async (role, run) => {
      const context = await browser.newContext({
        storageState: getWorkerAuthStatePath(testInfo.project.name, testInfo.workerIndex, role),
      });
      const page = await context.newPage();

      try {
        await run({ context, page });
      } finally {
        await context.close();
      }
    });
  },
});
