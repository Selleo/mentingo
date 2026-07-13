import { USER_ROLE } from "~/config/userRoles";

import { GLOBAL_SEARCH_HANDLES } from "../../data/navigation/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openGlobalSearchFlow } from "../../flows/navigation/open-global-search.flow";
import { prepareNavigationPageFlow } from "../../flows/navigation/prepare-navigation-page.flow";

test("only roles with user-management permission see the users section in global search", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const userFactory = factories.createUserFactory();

  const uniqueName = `GlobalSearchTarget${Date.now()}`;
  let targetUserId = "";

  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      const targetUser = await userFactory.create({
        firstName: uniqueName,
        lastName: "User",
        email: `${uniqueName.toLowerCase()}@example.com`,
      });
      targetUserId = targetUser.id;

      cleanup.add(async () => {
        await withWorkerPage(
          USER_ROLE.admin,
          async () => {
            await userFactory.delete(targetUser.id);
          },
          { root: true },
        );
      });

      await expect
        .poll(async () => {
          const response = await apiClient.api.globalSearchControllerSearch({
            searchQuery: uniqueName,
            language: "en",
          });
          const results = response.data.data;
          return results.users.some((user) => user.id === targetUser.id);
        })
        .toBe(true);

      await prepareNavigationPageFlow(page);
      await openGlobalSearchFlow(page);
      await page.getByTestId(GLOBAL_SEARCH_HANDLES.INPUT).fill(uniqueName);

      await expect(
        page.getByTestId(GLOBAL_SEARCH_HANDLES.resultItem("users", targetUser.id)),
      ).toBeVisible();
    },
    { root: true },
  );

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await prepareNavigationPageFlow(page);
      await openGlobalSearchFlow(page);
      await page.getByTestId(GLOBAL_SEARCH_HANDLES.INPUT).fill(uniqueName);

      await expect(
        page.getByTestId(GLOBAL_SEARCH_HANDLES.resultItem("users", targetUserId)),
      ).toHaveCount(0);
      await expect(page.getByTestId(GLOBAL_SEARCH_HANDLES.EMPTY_STATE)).toBeVisible();
    },
    { root: true },
  );
});
