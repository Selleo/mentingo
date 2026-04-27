import { USER_ROLE } from "~/config/userRoles";

import { QA_PAGE_HANDLES } from "../../data/qa/handles";
import { openQAPageFlow } from "../../flows/qa/open-qa-page.flow";
import { ensureQAFeatures } from "../../utils/qa-features";

import { expect, test } from "./qa-test.fixture";

test("visitor can access Q&A when public access is enabled", async ({
  apiClient,
  cleanup,
  createWorkspacePage,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async () => {
    const restoreQAFeatures = await ensureQAFeatures(apiClient, {
      QAEnabled: true,
      unregisteredUserQAAccessibility: true,
    });

    cleanup.add(restoreQAFeatures);

    const qaFactory = factories.createQAFactory();
    const qa = await qaFactory.create({
      title: `public-qa-question-${Date.now()}`,
      description: `public-qa-answer-${Date.now()}`,
    });

    cleanup.add(async () => {
      const existingQA = await qaFactory.safeGetById(qa.id);

      if (existingQA) {
        await qaFactory.delete(qa.id);
      }
    });

    const { context: publicContext, page: publicPage } = await createWorkspacePage();

    try {
      await openQAPageFlow(publicPage);
      await expect(publicPage.getByTestId(QA_PAGE_HANDLES.item(qa.id))).toBeVisible();
    } finally {
      await publicContext.close();
    }
  });
});

test("visitor cannot access Q&A when public access is disabled", async ({
  apiClient,
  cleanup,
  createWorkspacePage,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async () => {
    const restoreQAFeatures = await ensureQAFeatures(apiClient, {
      QAEnabled: true,
      unregisteredUserQAAccessibility: false,
    });

    cleanup.add(restoreQAFeatures);

    const { context: publicContext, page: publicPage } = await createWorkspacePage();

    try {
      await publicPage.goto("/qa");
      await expect(publicPage.getByTestId(QA_PAGE_HANDLES.PAGE)).toHaveCount(0);
    } finally {
      await publicContext.close();
    }
  });
});
