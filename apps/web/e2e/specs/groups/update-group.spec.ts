import { USER_ROLE } from "~/config/userRoles";

import { GROUP_FORM_HANDLES, GROUPS_PAGE_HANDLES } from "../../data/groups/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { cancelGroupFormFlow } from "../../flows/groups/cancel-group-form.flow";
import { fillGroupFormFlow } from "../../flows/groups/fill-group-form.flow";
import { openGroupPageFlow } from "../../flows/groups/open-group-page.flow";
import { submitGroupFormFlow } from "../../flows/groups/submit-group-form.flow";

test("admin can update a group", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const groupFactory = factories.createGroupFactory();
    const group = await groupFactory.create();
    const updatedName = `updated-group-${Date.now()}`;
    const updatedCharacteristic = `Updated characteristic ${Date.now()}`;

    cleanup.add(async () => {
      await Promise.allSettled([groupFactory.delete(group.id)]);
    });

    await openGroupPageFlow(page, group.id);
    await fillGroupFormFlow(page, {
      name: updatedName,
      characteristic: updatedCharacteristic,
    });
    await submitGroupFormFlow(page);

    await expect(page).toHaveURL(/\/admin\/groups$/);
    await expect(page.getByTestId(GROUPS_PAGE_HANDLES.row(group.id))).toBeVisible();

    await expect
      .poll(async () => {
        const updatedGroup = await groupFactory.getById(group.id);

        return (
          updatedGroup.name === updatedName &&
          (updatedGroup.characteristic ?? "") === updatedCharacteristic
        );
      })
      .toBe(true);
  });
});

test("admin sees existing group values prefilled on the edit page", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const groupFactory = factories.createGroupFactory();
    const group = await groupFactory.create({
      name: `prefilled-group-${Date.now()}`,
      characteristic: "Prefilled characteristic",
    });

    cleanup.add(async () => {
      await Promise.allSettled([groupFactory.delete(group.id)]);
    });

    await openGroupPageFlow(page, group.id);

    await expect(page.getByTestId(GROUP_FORM_HANDLES.NAME_INPUT)).toHaveValue(group.name);
    await expect(page.getByTestId(GROUP_FORM_HANDLES.CHARACTERISTIC_INPUT)).toHaveValue(
      group.characteristic ?? "",
    );
  });
});

test("admin can cancel group editing without persisting changes", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const groupFactory = factories.createGroupFactory();
    const group = await groupFactory.create({
      name: `cancel-edit-group-${Date.now()}`,
      characteristic: "Original characteristic",
    });

    cleanup.add(async () => {
      await Promise.allSettled([groupFactory.delete(group.id)]);
    });

    await openGroupPageFlow(page, group.id);
    await fillGroupFormFlow(page, {
      name: `${group.name}-updated`,
      characteristic: "Changed characteristic",
    });
    await cancelGroupFormFlow(page);

    await expect(page).toHaveURL(/\/admin\/groups$/);
    await expect(page.getByTestId(GROUPS_PAGE_HANDLES.PAGE)).toBeVisible();

    await expect
      .poll(async () => {
        const unchangedGroup = await groupFactory.getById(group.id);

        return (
          unchangedGroup.name === group.name &&
          (unchangedGroup.characteristic ?? "") === (group.characteristic ?? "")
        );
      })
      .toBe(true);
  });
});
