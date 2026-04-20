import { USER_ROLE } from "~/config/userRoles";

import { GROUPS_PAGE_HANDLES } from "../../data/groups/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { cancelDeleteGroupsDialogFlow } from "../../flows/groups/cancel-delete-groups-dialog.flow";
import { confirmDeleteGroupsFlow } from "../../flows/groups/confirm-delete-groups.flow";
import { openDeleteGroupsDialogFlow } from "../../flows/groups/open-delete-groups-dialog.flow";
import { openGroupsPageFlow } from "../../flows/groups/open-groups-page.flow";
import { selectGroupsFlow } from "../../flows/groups/select-groups.flow";

test("admin cannot delete groups when no rows are selected", async ({ withReadonlyPage }) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    await openGroupsPageFlow(page);

    await expect(page.getByTestId(GROUPS_PAGE_HANDLES.DELETE_SELECTED_BUTTON)).toBeDisabled();
  });
});

test("admin can cancel group deletion from the delete dialog", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const groupFactory = factories.createGroupFactory();
    const prefix = `cancel-delete-group-${Date.now()}`;
    const groups = await groupFactory.createMany(2, (index) => ({
      name: `${prefix}-${index}`,
    }));

    cleanup.add(async () => {
      await Promise.allSettled(groups.map((group) => groupFactory.delete(group.id)));
    });

    await openGroupsPageFlow(page);
    await selectGroupsFlow(
      page,
      groups.map((group) => group.id),
    );
    await openDeleteGroupsDialogFlow(page);
    await cancelDeleteGroupsDialogFlow(page);

    for (const group of groups) {
      await expect(page.getByTestId(GROUPS_PAGE_HANDLES.row(group.id))).toBeVisible();
    }

    await expect
      .poll(async () => {
        const existingGroups = await Promise.all(
          groups.map((group) => groupFactory.findByName(group.name)),
        );
        return existingGroups.every((group) => group !== null);
      })
      .toBe(true);
  });
});

test("admin can delete a single selected group", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const groupFactory = factories.createGroupFactory();
    const group = await groupFactory.create({
      name: `single-delete-group-${Date.now()}`,
    });

    cleanup.add(async () => {
      await Promise.allSettled([groupFactory.delete(group.id)]);
    });

    await openGroupsPageFlow(page);
    await selectGroupsFlow(page, [group.id]);
    await openDeleteGroupsDialogFlow(page);
    await confirmDeleteGroupsFlow(page);

    await expect(page.getByTestId(GROUPS_PAGE_HANDLES.DELETE_DIALOG)).toHaveCount(0);
    await expect
      .poll(async () => {
        return await groupFactory.findByName(group.name);
      })
      .toBeNull();
    await expect(page.getByTestId(GROUPS_PAGE_HANDLES.row(group.id))).toHaveCount(0);
  });
});

test("admin can bulk delete selected groups", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const groupFactory = factories.createGroupFactory();
    const prefix = `bulk-delete-group-${Date.now()}`;
    const groups = await groupFactory.createMany(2, (index) => ({
      name: `${prefix}-${index}`,
    }));

    cleanup.add(async () => {
      await Promise.allSettled(groups.map((group) => groupFactory.delete(group.id)));
    });

    await openGroupsPageFlow(page);
    await selectGroupsFlow(
      page,
      groups.map((group) => group.id),
    );
    await openDeleteGroupsDialogFlow(page);
    await confirmDeleteGroupsFlow(page);

    await expect(page.getByTestId(GROUPS_PAGE_HANDLES.DELETE_DIALOG)).toHaveCount(0);

    await expect
      .poll(async () => {
        const existingGroups = await Promise.all(
          groups.map((group) => groupFactory.findByName(group.name)),
        );
        return existingGroups.every((group) => group === null);
      })
      .toBe(true);

    for (const group of groups) {
      await expect(page.getByTestId(GROUPS_PAGE_HANDLES.row(group.id))).toHaveCount(0);
    }
  });
});
