import { USER_ROLE } from "~/config/userRoles";

import { QA_PAGE_HANDLES } from "../../data/qa/handles";
import { createQAFlow } from "../../flows/qa/create-qa.flow";

import { expect, test } from "./qa-test.fixture";

test("admin can create a Q&A entry", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const qaFactory = factories.createQAFactory();
    const title = `create-qa-question-${Date.now()}`;
    const description = `create-qa-answer-${Date.now()}`;
    let createdQAId = "";

    cleanup.add(async () => {
      if (!createdQAId) return;

      const existingQA = await qaFactory.safeGetById(createdQAId);

      if (existingQA) {
        await qaFactory.delete(createdQAId);
      }
    });

    await createQAFlow(page, { title, description });
    await expect(page).toHaveURL(/\/qa$/);

    await expect
      .poll(async () => {
        const createdQA = await qaFactory.findByTitle(title);
        createdQAId = createdQA?.id ?? "";

        return createdQA?.description;
      })
      .toBe(description);

    await expect(page.getByTestId(QA_PAGE_HANDLES.item(createdQAId))).toBeVisible();
  });
});
