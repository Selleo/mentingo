import { USER_ROLE } from "~/config/userRoles";

import { CERTIFICATE_PREVIEW_HANDLES } from "../../data/certificates/handles";
import { LEARNING_PATH_SETTINGS_DRAWER_HANDLES } from "../../data/learning-paths/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openAdminLearningPathsPageFlow } from "../../flows/learning-paths/open-learning-paths-page.flow";
import { openLearningPathSettingsDrawerFlow } from "../../flows/learning-paths/publish-learning-path.flow";
import { ensureLearningPathsEnabled } from "../../utils/learning-paths-features";

test("admin can change the learning path certificate font color", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      await ensureLearningPathsEnabled(apiClient);

      const learningPathFactory = factories.createLearningPathFactory();
      const learningPath = await learningPathFactory.create({
        title: `learning-path-certificate-color-${Date.now()}`,
        includesCertificate: true,
      });

      cleanup.add(async () => {
        await learningPathFactory.delete(learningPath.id);
      });

      await openAdminLearningPathsPageFlow(page);
      await openLearningPathSettingsDrawerFlow(page, learningPath.id);

      await page
        .getByTestId(LEARNING_PATH_SETTINGS_DRAWER_HANDLES.CERTIFICATE_PREVIEW_BUTTON)
        .click();

      const modal = page.getByTestId(CERTIFICATE_PREVIEW_HANDLES.MODAL);
      await expect(modal).toBeVisible();

      await modal.getByTestId(CERTIFICATE_PREVIEW_HANDLES.COLOR_PICKER_TRIGGER).click();

      const targetColor = "2563eb";
      await modal.getByTestId(CERTIFICATE_PREVIEW_HANDLES.COLOR_INPUT).fill(targetColor);

      await expect
        .poll(
          async () => {
            const updated = await learningPathFactory.getById(learningPath.id);
            return updated.settings.certificateFontColor;
          },
          { timeout: 15_000 },
        )
        .toBe(`#${targetColor}`);
    },
    { root: true },
  );
});
