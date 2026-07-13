import { USER_ROLE } from "~/config/userRoles";

import {
  CERTIFICATE_RESET_DIALOG_HANDLES,
  COURSE_SETTINGS_HANDLES,
  COURSE_TAB_VALUES,
} from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openEditCoursePageFlow } from "../../flows/courses/open-edit-course-page.flow";

import { createCertificatedCourseForStudent } from "./certificate-test-helpers";

test("admin can reset all certificates issued for a course", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const certificateFactory = factories.createCertificateFactory();

  const { courseId, studentId } = await createCertificatedCourseForStudent({
    cleanup,
    factories,
    prefix: `certificate-reset-${Date.now()}`,
    withWorkerPage,
  });

  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      await openEditCoursePageFlow(page, courseId, COURSE_TAB_VALUES.SETTINGS);
      await page.getByTestId(COURSE_SETTINGS_HANDLES.CERTIFICATE_RESET_BUTTON).click();

      const dialog = page.getByTestId(CERTIFICATE_RESET_DIALOG_HANDLES.DIALOG);
      await expect(dialog).toBeVisible();

      await page.getByTestId(CERTIFICATE_RESET_DIALOG_HANDLES.SUBMIT_BUTTON).click();

      await expect(dialog).toBeHidden();
    },
    { root: true },
  );

  await expect
    .poll(
      async () => {
        const certificate = await certificateFactory.getForCourse({ courseId, userId: studentId });
        return certificate;
      },
      { timeout: 15_000 },
    )
    .toBeNull();
});
