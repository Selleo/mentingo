import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { TEST_PASSWORD } from "../data/test-data/credentials.data";
import { login } from "../fixtures/auth.actions";

import type { UserFactory, UserFactoryRecord } from "../factories/user.factory";
import type { CreateWorkspacePage } from "../fixtures/test.fixture";
import type { BrowserContext, Page } from "@playwright/test";

type CleanupHandle = {
  add: (task: () => Promise<void> | void) => void;
};

export const createDisposableAdminSession = async ({
  createWorkspacePage,
  cleanup,
  userFactory,
  email,
}: {
  cleanup: CleanupHandle;
  createWorkspacePage: CreateWorkspacePage;
  email: string;
  userFactory: UserFactory;
}): Promise<{ context: BrowserContext; page: Page; user: UserFactoryRecord }> => {
  const registeredUser = await userFactory.register({
    email,
    firstName: "Disposable",
    lastName: "Admin",
    password: TEST_PASSWORD,
  });

  const adminUser = await userFactory.update(registeredUser.id, {
    roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
  });

  cleanup.add(async () => {
    await userFactory.delete(adminUser.id);
  });

  const { context, page } = await createWorkspacePage();

  cleanup.add(async () => {
    await context.close();
  });

  await login(page, adminUser.email, TEST_PASSWORD);

  return { context, page, user: adminUser };
};
