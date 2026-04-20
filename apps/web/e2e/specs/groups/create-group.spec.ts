import { USER_ROLE } from "~/config/userRoles";

import { CREATE_GROUP_PAGE_HANDLES, GROUPS_PAGE_HANDLES } from "../../data/groups/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { cancelGroupFormFlow } from "../../flows/groups/cancel-group-form.flow";
import { fillGroupFormFlow } from "../../flows/groups/fill-group-form.flow";
import { openCreateGroupPageFlow } from "../../flows/groups/open-create-group-page.flow";
import { submitGroupFormFlow } from "../../flows/groups/submit-group-form.flow";

test("admin can create a group from the create page", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const groupFactory = factories.createGroupFactory();
    const name = `create-group-${Date.now()}`;
    const characteristic = `Characteristic for ${name}`;

    await openCreateGroupPageFlow(page);
    await fillGroupFormFlow(page, { name, characteristic });
    await submitGroupFormFlow(page);

    await expect
      .poll(async () => {
        const createdGroup = await groupFactory.findByName(name);
        return createdGroup?.id ?? null;
      })
      .not.toBeNull();

    const createdGroup = await groupFactory.findByName(name);

    cleanup.add(async () => {
      if (createdGroup) {
        await groupFactory.delete(createdGroup.id);
      }
    });

    await expect(page).toHaveURL(/\/admin\/groups$/);
    await expect(page.getByTestId(GROUPS_PAGE_HANDLES.row(createdGroup!.id))).toBeVisible();
  });
});

test("admin cannot submit invalid group data", async ({ withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    await openCreateGroupPageFlow(page);
    await fillGroupFormFlow(page, {
      name: "A",
      characteristic: "x".repeat(1025),
    });
    await submitGroupFormFlow(page);

    await expect(page).toHaveURL(/\/admin\/groups\/new$/);
    await expect(page.getByText("Name must be at least 2 characters.")).toBeVisible();
    await expect(page.getByText("Name cannot be longer than 1024 characters.")).toBeVisible();
    await expect(page.getByTestId(CREATE_GROUP_PAGE_HANDLES.PAGE)).toBeVisible();
  });
});

test("admin can cancel group creation without persisting data", async ({
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const groupFactory = factories.createGroupFactory();
    const name = `cancel-create-group-${Date.now()}`;

    await openCreateGroupPageFlow(page);
    await fillGroupFormFlow(page, {
      name,
      characteristic: "This group should not be created",
    });
    await cancelGroupFormFlow(page);

    await expect(page).toHaveURL(/\/admin\/groups$/);
    await expect(page.getByTestId(GROUPS_PAGE_HANDLES.PAGE)).toBeVisible();
    await expect(await groupFactory.findByName(name)).toBeNull();
  });
});
