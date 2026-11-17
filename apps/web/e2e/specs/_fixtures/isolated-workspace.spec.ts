import { USER_ROLE } from "~/config/userRoles";

import { TEST_PASSWORD } from "../../data/test-data/credentials.data";
import { expect, test } from "../../fixtures/test.fixture";

// Self-test of the isolated-workspace fixtures, not a product test.
test("isolated workspace keeps changes tenant-scoped", async ({ createIsolatedWorkspace }) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const peerWorkspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const email = `isolated-user-${Date.now()}@example.com`;
  const peerUserFactory = peerWorkspace.factories.createUserFactory();

  const isolatedUser = await workspace.createTenantUserWithPasswordAndRole({
    firstName: "Isolated",
    lastName: "User",
    email,
    password: TEST_PASSWORD,
    role: USER_ROLE.student,
  });

  await expect.poll(() => peerUserFactory.getByEmail(email)).toBeNull();
  await expect
    .poll(
      async () => (await workspace.factories.createUserFactory().getById(isolatedUser.user.id)).id,
    )
    .toBe(isolatedUser.user.id);
  expect(workspace.origin).toContain(new URL(workspace.tenant.host).host);
  expect(peerWorkspace.origin).toContain(new URL(peerWorkspace.tenant.host).host);
});

test("isolated worker helper opens a tenant-scoped workspace", async ({
  withIsolatedWorkerPage,
}) => {
  await withIsolatedWorkerPage(USER_ROLE.admin, async (workspace) => {
    const title = `Isolated category ${Date.now()}`;
    const categoryFactory = workspace.factories.createCategoryFactory();

    await categoryFactory.create({ title });
    await expect.poll(async () => (await categoryFactory.findByTitle(title))?.title).toBe(title);

    expect(workspace.origin).toContain(new URL(workspace.tenant.host).host);
  });
});
