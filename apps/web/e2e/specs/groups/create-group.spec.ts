import { USER_ROLE } from "~/config/userRoles";

import {
  CREATE_GROUP_PAGE_HANDLES,
  GROUP_FORM_HANDLES,
  GROUPS_PAGE_HANDLES,
} from "../../data/groups/handles";
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

    cleanup.add(async () => {
      const createdGroup = await groupFactory.findByName(name);

      if (createdGroup) await groupFactory.delete(createdGroup.id);
    });

    await openCreateGroupPageFlow(page);
    await fillGroupFormFlow(page, { name, characteristic });
    await submitGroupFormFlow(page);

    await expect(page).toHaveURL(/\/admin\/groups$/);
    await expect.poll(async () => (await groupFactory.findByName(name))?.id).toBeTruthy();
    const createdGroup = await groupFactory.findByName(name);

    if (!createdGroup) throw new Error(`Expected group ${name} to exist`);

    await expect(page.getByTestId(GROUPS_PAGE_HANDLES.row(createdGroup.id))).toBeVisible();
  });
});

test("admin cannot submit invalid group data", async ({ withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openCreateGroupPageFlow(page);
    await fillGroupFormFlow(page, {
      name: "A",
      characteristic: "x".repeat(1025),
    });
    await submitGroupFormFlow(page);

    await expect(page).toHaveURL(/\/admin\/groups\/new$/);
    await expect(page.getByTestId(GROUP_FORM_HANDLES.NAME_ERROR)).toBeVisible();
    await expect(page.getByTestId(GROUP_FORM_HANDLES.CHARACTERISTIC_ERROR)).toBeVisible();
    await expect(page.getByTestId(CREATE_GROUP_PAGE_HANDLES.PAGE)).toBeVisible();
  });
});

test("admin can cancel group creation without persisting data", async ({
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
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
    await expect.poll(() => groupFactory.findByName(name)).toBeNull();
  });
});
