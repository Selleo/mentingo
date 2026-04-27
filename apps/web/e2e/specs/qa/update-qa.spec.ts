import { USER_ROLE } from "~/config/userRoles";

import { updateQAFlow } from "../../flows/qa/update-qa.flow";

import { expect, test } from "./qa-test.fixture";

test("admin can update a Q&A entry", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const qaFactory = factories.createQAFactory();
    const qa = await qaFactory.create({
      title: `update-qa-original-${Date.now()}`,
      description: `update-qa-original-answer-${Date.now()}`,
    });
    const updatedTitle = `update-qa-updated-${Date.now()}`;
    const updatedDescription = `update-qa-updated-answer-${Date.now()}`;

    cleanup.add(async () => {
      const existingQA = await qaFactory.safeGetById(qa.id);

      if (existingQA) {
        await qaFactory.delete(qa.id);
      }
    });

    await updateQAFlow(page, {
      qaId: qa.id,
      title: updatedTitle,
      description: updatedDescription,
    });

    await expect(page).toHaveURL(/\/qa$/);
    await expect
      .poll(async () => qaFactory.getById(qa.id))
      .toMatchObject({
        title: updatedTitle,
        description: updatedDescription,
      });
  });
});
