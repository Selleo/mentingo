import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { QA_PAGE_HANDLES } from "../../data/qa/handles";
import { QAFactory } from "../../factories/qa.factory";
import { openQAPageFlow } from "../../flows/qa/open-qa-page.flow";
import { overrideContentModuleState, setContentModuleState } from "../../utils/content-features";

import { expect, test } from "./qa.fixture";

const ROLES = [
  { role: USER_ROLE.admin, canManage: true },
  { role: USER_ROLE.contentCreator, canManage: false },
  { role: USER_ROLE.student, canManage: false },
] as const;

for (const { role, canManage } of ROLES) {
  test(`${role} can read Q&A answers`, async ({
    cleanup,
    withWorkerPage,
    workerTenantApiClient,
  }) => {
    const qaFactory = new QAFactory(workerTenantApiClient);
    const title = `qa-access-${role}-${Date.now()}`;
    const description = `qa-access-answer-${Date.now()}`;
    const qa = await qaFactory.create({ title, description });
    cleanup.add(() => qaFactory.safeDelete(qa.id));

    await withWorkerPage(role, async ({ page }) => {
      await openQAPageFlow(page);

      await expect(page.getByTestId(QA_PAGE_HANDLES.itemTitle(qa.id))).toContainText(title);
      await page.getByTestId(QA_PAGE_HANDLES.itemTrigger(qa.id)).click();
      await expect(page.getByTestId(QA_PAGE_HANDLES.itemDescription(qa.id))).toHaveText(
        description,
      );
      await expect(page.getByTestId(QA_PAGE_HANDLES.CREATE_BUTTON)).toHaveCount(canManage ? 1 : 0);
      await expect(page.getByTestId(QA_PAGE_HANDLES.itemEditButton(qa.id))).toHaveCount(
        canManage ? 1 : 0,
      );
      await expect(page.getByTestId(QA_PAGE_HANDLES.itemDeleteButton(qa.id))).toHaveCount(
        canManage ? 1 : 0,
      );
    });
  });

  // Managers see every entry; other roles only entries translated to their UI language.
  test(`${role} ${canManage ? "sees" : "does not see"} Q&A missing the current UI language`, async ({
    apiClient,
    cleanup,
    withWorkerPage,
    workerTenantApiClient,
  }) => {
    const qaFactory = new QAFactory(workerTenantApiClient);
    const qa = await qaFactory.create({
      language: SUPPORTED_LANGUAGES.EN,
      title: `qa-language-${role}-${Date.now()}`,
      description: `qa-language-answer-${Date.now()}`,
    });
    cleanup.add(() => qaFactory.safeDelete(qa.id));
    const translatedQA = await qaFactory.create({
      language: SUPPORTED_LANGUAGES.DE,
      title: `qa-language-de-${role}-${Date.now()}`,
      description: `qa-language-de-answer-${Date.now()}`,
    });
    cleanup.add(() => qaFactory.safeDelete(translatedQA.id));

    await withWorkerPage(role, async ({ page }) => {
      const originalLanguage = (await apiClient.api.settingsControllerGetUserSettings()).data.data
        ?.language;

      if (!originalLanguage) throw new Error("Expected the user's UI language");

      await apiClient.api.settingsControllerUpdateUserSettings({
        language: SUPPORTED_LANGUAGES.DE,
      });
      cleanup.add(async () => {
        await apiClient.api.settingsControllerUpdateUserSettings({ language: originalLanguage });
      });

      await openQAPageFlow(page);
      // The translated entry proves the list has loaded in the UI language before the negative check.
      await expect(page.getByTestId(QA_PAGE_HANDLES.item(translatedQA.id))).toBeVisible();
      await expect(page.getByTestId(QA_PAGE_HANDLES.item(qa.id))).toHaveCount(canManage ? 1 : 0);
    });
  });
}

test("visitor can read Q&A only while public Q&A access is enabled", async ({
  cleanup,
  createWorkspacePage,
  workerTenantApiClient,
}) => {
  cleanup.add(
    await overrideContentModuleState(workerTenantApiClient, "qa", { enabled: true, public: true }),
  );
  const qaFactory = new QAFactory(workerTenantApiClient);
  const qa = await qaFactory.create({
    title: `public-qa-question-${Date.now()}`,
    description: `public-qa-answer-${Date.now()}`,
  });
  cleanup.add(() => qaFactory.safeDelete(qa.id));
  const { context, page } = await createWorkspacePage();
  cleanup.add(() => context.close());

  await openQAPageFlow(page);
  await expect(page.getByTestId(QA_PAGE_HANDLES.item(qa.id))).toBeVisible();

  await setContentModuleState(workerTenantApiClient, "qa", { public: false });

  await page.goto("/qa");
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByTestId(QA_PAGE_HANDLES.PAGE)).toHaveCount(0);
});
