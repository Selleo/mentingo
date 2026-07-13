import { USER_ROLE } from "~/config/userRoles";

import { CERTIFICATE_PREVIEW_HANDLES } from "../../data/certificates/handles";
import { COURSE_SETTINGS_HANDLES, COURSE_TAB_VALUES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openEditCoursePageFlow } from "../../flows/courses/open-edit-course-page.flow";

test("admin can preview the certificate and change its font color", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Certificate Preview Category ${Date.now()}`);
    const course = await courseFactory.create({
      title: `certificate-preview-course-${Date.now()}`,
      categoryId: category.id,
    });
    await courseFactory.updateHasCertificate(course.id, true);

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openEditCoursePageFlow(page, course.id, COURSE_TAB_VALUES.SETTINGS);
    await page.getByTestId(COURSE_SETTINGS_HANDLES.CERTIFICATE_PREVIEW_BUTTON).click();

    const modal = page.getByTestId(CERTIFICATE_PREVIEW_HANDLES.MODAL);
    await expect(modal).toBeVisible();

    await page.getByTestId(CERTIFICATE_PREVIEW_HANDLES.COLOR_PICKER_TRIGGER).click();

    const targetColor = "2563eb";
    await page.getByTestId(CERTIFICATE_PREVIEW_HANDLES.COLOR_INPUT).fill(targetColor);

    await expect
      .poll(
        async () => {
          const settings = await courseFactory.getSettings(course.id);
          return settings.certificateFontColor;
        },
        { timeout: 15_000 },
      )
      .toBe(`#${targetColor}`);
  });
});
