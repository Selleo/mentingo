import { USER_ROLE } from "~/config/userRoles";

import { QA_FORM_PAGE_HANDLES, QA_LANGUAGE_SELECTOR_HANDLES } from "../../data/qa/handles";
import { createQALanguageFlow } from "../../flows/qa/create-qa-language.flow";
import { deleteQALanguageFlow } from "../../flows/qa/delete-qa-language.flow";
import { fillQAFormFlow } from "../../flows/qa/fill-qa-form.flow";
import { openEditQAPageFlow } from "../../flows/qa/open-edit-qa-page.flow";
import { selectQALanguageFlow } from "../../flows/qa/select-qa-language.flow";
import { submitQAFormFlow } from "../../flows/qa/submit-qa-form.flow";

import { expect, test } from "./qa.fixture";

test("admin can add update and delete a Q&A translation language", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const qaFactory = factories.createQAFactory();
    const qa = await qaFactory.create({
      language: "en",
      title: `qa-translation-base-${Date.now()}`,
      description: `qa-translation-base-answer-${Date.now()}`,
    });
    cleanup.add(() => qaFactory.safeDelete(qa.id));
    const germanTitle = `qa-translation-de-${Date.now()}`;
    const germanDescription = `qa-translation-de-answer-${Date.now()}`;

    await openEditQAPageFlow(page, qa.id);
    await createQALanguageFlow(page, "de");
    await fillQAFormFlow(page, {
      title: germanTitle,
      description: germanDescription,
    });
    await submitQAFormFlow(page);

    await expect
      .poll(async () => qaFactory.getById(qa.id, "de"))
      .toMatchObject({
        title: germanTitle,
        description: germanDescription,
        availableLocales: expect.arrayContaining(["en", "de"]),
      });

    await openEditQAPageFlow(page, qa.id);
    await selectQALanguageFlow(page, "de");
    await expect(page.getByTestId(QA_FORM_PAGE_HANDLES.TITLE_INPUT)).toHaveValue(germanTitle);
    await expect(page.getByTestId(QA_FORM_PAGE_HANDLES.DESCRIPTION_INPUT)).toHaveValue(
      germanDescription,
    );
    await deleteQALanguageFlow(page);

    await expect
      .poll(async () => qaFactory.getById(qa.id, "en"))
      .toMatchObject({ availableLocales: ["en"] });

    await openEditQAPageFlow(page, qa.id);
    await selectQALanguageFlow(page, "de");
    // Selecting a removed translation offers to create it again.
    await expect(page.getByTestId(QA_LANGUAGE_SELECTOR_HANDLES.CREATE_DIALOG)).toBeVisible();
  });
});
