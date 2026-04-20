import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { login } from "../fixtures/auth.actions";

import type { UserFactory, UserFactoryRecord } from "../factories/user.factory";
import type { Browser, BrowserContext, Page } from "@playwright/test";

const DISPOSABLE_ADMIN_PASSWORD = "Password123@";

type CleanupHandle = {
  add: (task: () => Promise<void> | void) => void;
};

export const createDisposableAdminSession = async ({
  browser,
  cleanup,
  userFactory,
  email,
}: {
  browser: Browser;
  cleanup: CleanupHandle;
  userFactory: UserFactory;
  email: string;
}): Promise<{ context: BrowserContext; page: Page; user: UserFactoryRecord }> => {
  const registeredUser = await userFactory.register({
    email,
    firstName: "Disposable",
    lastName: "Admin",
    password: DISPOSABLE_ADMIN_PASSWORD,
  });

  const adminUser = await userFactory.update(registeredUser.id, {
    roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
  });

  cleanup.add(async () => {
    await userFactory.delete(adminUser.id);
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  cleanup.add(async () => {
    await context.close();
  });

  await login(page, adminUser.email, DISPOSABLE_ADMIN_PASSWORD);

  return { context, page, user: adminUser };
};
