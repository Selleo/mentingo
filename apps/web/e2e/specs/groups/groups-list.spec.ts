import { USER_ROLE } from "~/config/userRoles";

import { GROUPS_PAGE_HANDLES, GROUP_PAGE_HANDLES } from "../../data/groups/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openGroupDetailsFromListFlow } from "../../flows/groups/open-group-details-from-list.flow";
import { openGroupsPageFlow } from "../../flows/groups/open-groups-page.flow";
import { shiftSelectGroupRangeFlow } from "../../flows/groups/shift-select-group-range.flow";

import type { Page } from "@playwright/test";

const getGroupRowOrder = async (page: Page, groupIds: string[]) => {
  const rows = page.getByTestId(GROUPS_PAGE_HANDLES.TABLE_BODY).getByRole("row");
  const rowTestIds = await rows.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-testid") ?? ""),
  );

  return groupIds.map((groupId) => rowTestIds.indexOf(GROUPS_PAGE_HANDLES.row(groupId)));
};

const expectAdjacentOrder = (indexes: number[], expectedDirection: "asc" | "desc") => {
  if (indexes.some((index) => index < 0)) {
    return false;
  }

  const expectedStep = expectedDirection === "asc" ? 1 : -1;

  return indexes
    .slice(1)
    .every((index, currentIndex) => index - indexes[currentIndex] === expectedStep);
};

test("admin can browse, sort, and open group details from the groups list", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const groupFactory = factories.createGroupFactory();
    const prefix = `groups-list-${Date.now()}`;
    const nameOrder = ["00", "11", "22"] as const;
    const characteristicOrder = ["22", "11", "00"] as const;
    const groups = await groupFactory.createMany(3, (index) => ({
      name: `${nameOrder[index]}-${prefix}`,
      characteristic: `${characteristicOrder[index]}-${prefix}`,
    }));

    cleanup.add(async () => {
      await Promise.allSettled(groups.map((group) => groupFactory.delete(group.id)));
    });

    await openGroupsPageFlow(page);

    await expect(page.getByTestId(GROUPS_PAGE_HANDLES.HEADING)).toBeVisible();
    await expect(page.getByTestId(GROUPS_PAGE_HANDLES.CREATE_BUTTON)).toBeVisible();
    await expect(page.getByTestId(GROUPS_PAGE_HANDLES.row(groups[0].id))).toBeVisible();
    await expect(page.getByTestId(GROUPS_PAGE_HANDLES.row(groups[1].id))).toBeVisible();
    await expect(page.getByTestId(GROUPS_PAGE_HANDLES.row(groups[2].id))).toBeVisible();

    const firstRowCheckbox = page.getByTestId(GROUPS_PAGE_HANDLES.rowCheckbox(groups[0].id));
    const middleRowCheckbox = page.getByTestId(GROUPS_PAGE_HANDLES.rowCheckbox(groups[1].id));
    const lastRowCheckbox = page.getByTestId(GROUPS_PAGE_HANDLES.rowCheckbox(groups[2].id));

    await page.getByTestId(GROUPS_PAGE_HANDLES.SORT_NAME).click();
    await expect
      .poll(async () =>
        expectAdjacentOrder(
          await getGroupRowOrder(
            page,
            groups.map((group) => group.id),
          ),
          "asc",
        ),
      )
      .toBe(true);

    await shiftSelectGroupRangeFlow(page, groups[0].id, groups[2].id);
    await expect(firstRowCheckbox).toHaveAttribute("data-state", "checked");
    await expect(middleRowCheckbox).toHaveAttribute("data-state", "checked");
    await expect(lastRowCheckbox).toHaveAttribute("data-state", "checked");

    await page.getByTestId(GROUPS_PAGE_HANDLES.SORT_CHARACTERISTIC).click();
    await expect
      .poll(async () =>
        expectAdjacentOrder(
          await getGroupRowOrder(
            page,
            groups.map((group) => group.id),
          ),
          "desc",
        ),
      )
      .toBe(true);

    await openGroupDetailsFromListFlow(page, groups[1].id);

    await expect(page).toHaveURL(new RegExp(`/admin/groups/${groups[1].id}$`));
    await expect(page.getByTestId(GROUP_PAGE_HANDLES.PAGE)).toBeVisible();
  });
});
