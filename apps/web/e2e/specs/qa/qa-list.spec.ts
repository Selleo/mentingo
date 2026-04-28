import { USER_ROLE } from "~/config/userRoles";

import { QA_PAGE_HANDLES } from "../../data/qa/handles";
import { openQAPageFlow } from "../../flows/qa/open-qa-page.flow";

import { expect, test } from "./qa-test.fixture";

test("admin can browse Q&A list and open an answer", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const qaFactory = factories.createQAFactory();
    const qa = await qaFactory.create({
      title: `qa-list-question-${Date.now()}`,
      description: `qa-list-answer-${Date.now()}`,
    });

    cleanup.add(async () => {
      const existingQA = await qaFactory.safeGetById(qa.id);

      if (existingQA) {
        await qaFactory.delete(qa.id);
      }
    });

    await openQAPageFlow(page);

    await expect(page.getByTestId(QA_PAGE_HANDLES.item(qa.id))).toBeVisible();
    await expect(page.getByTestId(QA_PAGE_HANDLES.itemTitle(qa.id))).toContainText(qa.title ?? "");

    await page.getByTestId(QA_PAGE_HANDLES.itemTrigger(qa.id)).click();

    await expect(page.getByTestId(QA_PAGE_HANDLES.itemDescription(qa.id))).toHaveText(
      qa.description ?? "",
    );
  });
});
