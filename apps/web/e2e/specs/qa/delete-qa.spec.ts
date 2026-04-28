import { USER_ROLE } from "~/config/userRoles";

import { QA_PAGE_HANDLES } from "../../data/qa/handles";
import { deleteQAFlow } from "../../flows/qa/delete-qa.flow";
import { openQAPageFlow } from "../../flows/qa/open-qa-page.flow";

import { expect, test } from "./qa-test.fixture";

test("admin can delete a Q&A entry", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const qaFactory = factories.createQAFactory();
    const qa = await qaFactory.create({
      title: `delete-qa-question-${Date.now()}`,
      description: `delete-qa-answer-${Date.now()}`,
    });
    let deleted = false;

    cleanup.add(async () => {
      if (deleted) return;

      const existingQA = await qaFactory.safeGetById(qa.id);

      if (existingQA) {
        await qaFactory.delete(qa.id);
      }
    });

    await openQAPageFlow(page);
    await deleteQAFlow(page, qa.id);
    deleted = true;

    await expect(page.getByTestId(QA_PAGE_HANDLES.item(qa.id))).toHaveCount(0);
    await expect.poll(async () => qaFactory.safeGetById(qa.id)).toBeNull();
  });
});
