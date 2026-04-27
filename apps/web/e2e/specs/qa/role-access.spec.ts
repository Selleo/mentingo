import { USER_ROLE } from "~/config/userRoles";

import { QA_PAGE_HANDLES } from "../../data/qa/handles";
import { openQAPageFlow } from "../../flows/qa/open-qa-page.flow";

import { expect, test } from "./qa-test.fixture";

test("student can read Q&A without management actions", async ({
  cleanup,
  factories,
  withReadonlyPage,
  withWorkerPage,
}) => {
  const qaFactory = factories.createQAFactory();
  let qaId = "";

  cleanup.add(async () => {
    if (!qaId) return;

    await withWorkerPage(USER_ROLE.admin, async () => {
      const existingQA = await qaFactory.safeGetById(qaId);

      if (existingQA) {
        await qaFactory.delete(qaId);
      }
    });
  });

  await withWorkerPage(USER_ROLE.admin, async () => {
    const qa = await qaFactory.create({
      title: `qa-role-question-${Date.now()}`,
      description: `qa-role-answer-${Date.now()}`,
    });

    qaId = qa.id;
  });

  await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
    await openQAPageFlow(page);

    await expect(page.getByTestId(QA_PAGE_HANDLES.item(qaId))).toBeVisible();
    await expect(page.getByTestId(QA_PAGE_HANDLES.CREATE_BUTTON)).toHaveCount(0);
    await expect(page.getByTestId(QA_PAGE_HANDLES.itemEditButton(qaId))).toHaveCount(0);
    await expect(page.getByTestId(QA_PAGE_HANDLES.itemDeleteButton(qaId))).toHaveCount(0);
  });
});
