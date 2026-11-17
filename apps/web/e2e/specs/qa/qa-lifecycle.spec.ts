import { USER_ROLE } from "~/config/userRoles";

import { QA_PAGE_HANDLES } from "../../data/qa/handles";
import { createQAFlow } from "../../flows/qa/create-qa.flow";
import { deleteQAFlow } from "../../flows/qa/delete-qa.flow";
import { updateQAFlow } from "../../flows/qa/update-qa.flow";

import { expect, test } from "./qa.fixture";

test("admin can create, update and delete a Q&A entry", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const qaFactory = factories.createQAFactory();
    const title = `qa-lifecycle-question-${Date.now()}`;
    const description = `qa-lifecycle-answer-${Date.now()}`;
    const updatedTitle = `${title}-updated`;
    const updatedDescription = `${description}-updated`;

    await createQAFlow(page, { title, description });
    await expect(page).toHaveURL(/\/qa$/);

    let qaId = "";
    await expect
      .poll(async () => {
        qaId = (await qaFactory.findByTitle(title))?.id ?? "";
        return qaId;
      })
      .not.toBe("");
    cleanup.add(() => qaFactory.safeDelete(qaId));

    await expect(page.getByTestId(QA_PAGE_HANDLES.itemTitle(qaId))).toContainText(title);
    await page.getByTestId(QA_PAGE_HANDLES.itemTrigger(qaId)).click();
    await expect(page.getByTestId(QA_PAGE_HANDLES.itemDescription(qaId))).toHaveText(description);

    await updateQAFlow(page, { qaId, title: updatedTitle, description: updatedDescription });

    await expect(page).toHaveURL(/\/qa$/);
    await expect(page.getByTestId(QA_PAGE_HANDLES.itemTitle(qaId))).toContainText(updatedTitle);
    await page.getByTestId(QA_PAGE_HANDLES.itemTrigger(qaId)).click();
    await expect(page.getByTestId(QA_PAGE_HANDLES.itemDescription(qaId))).toHaveText(
      updatedDescription,
    );
    await expect
      .poll(() => qaFactory.getById(qaId))
      .toMatchObject({ title: updatedTitle, description: updatedDescription });

    await deleteQAFlow(page, qaId);

    await expect(page.getByTestId(QA_PAGE_HANDLES.item(qaId))).toHaveCount(0);
    await expect.poll(() => qaFactory.safeGetById(qaId)).toBeNull();
  });
});
