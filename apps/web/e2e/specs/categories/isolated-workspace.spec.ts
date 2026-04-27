import { USER_ROLE } from "~/config/userRoles";

import { expect, test } from "../../fixtures/test.fixture";

test("isolated workspace keeps changes tenant-scoped", async ({ createIsolatedWorkspace }) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const peerWorkspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const email = `isolated-user-${Date.now()}@example.com`;
  const peerUserFactory = peerWorkspace.factories.createUserFactory();

  const isolatedUser = await workspace.createTenantUserWithPasswordAndRole({
    firstName: "Isolated",
    lastName: "User",
    email,
    password: "Password123@",
    role: USER_ROLE.student,
  });

  await expect(await peerUserFactory.getByEmail(email)).toBeNull();
  await expect(
    await workspace.factories.createUserFactory().getById(isolatedUser.user.id),
  ).not.toBeNull();
  await expect(workspace.origin).toContain(new URL(workspace.tenant.host).host);
  await expect(peerWorkspace.origin).toContain(new URL(peerWorkspace.tenant.host).host);
});

test("isolated worker helper opens a tenant-scoped workspace", async ({
  withIsolatedWorkerPage,
}) => {
  await withIsolatedWorkerPage(USER_ROLE.admin, async (workspace) => {
    const title = `Isolated category ${Date.now()}`;
    const categoryFactory = workspace.factories.createCategoryFactory();

    await categoryFactory.create({ title });
    await expect(await categoryFactory.findByTitle(title)).not.toBeNull();

    await expect(workspace.origin).toContain(new URL(workspace.tenant.host).host);
  });
});
