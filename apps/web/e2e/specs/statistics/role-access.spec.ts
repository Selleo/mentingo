import { USER_ROLE } from "~/config/userRoles";

import { COURSE_STATISTICS_HANDLES } from "../../data/statistics/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { createSingleChoiceQuizLessonCourse } from "../learning/learning-test-helpers";

test("course statistics tab is visible for admin and hidden for student", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const { courseId } = await createSingleChoiceQuizLessonCourse({
    cleanup,
    factories,
    prefix: `statistics-role-access-${Date.now()}`,
    withWorkerPage,
  });

  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      await openCourseOverviewFlow(page, courseId);
      await expect(
        page.getByTestId(COURSE_STATISTICS_HANDLES.COURSE_VIEW_STATISTICS_TAB),
      ).toBeVisible();
    },
    { root: true },
  );

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await openCourseOverviewFlow(page, courseId);
      await expect(
        page.getByTestId(COURSE_STATISTICS_HANDLES.COURSE_VIEW_STATISTICS_TAB),
      ).toHaveCount(0);
    },
    { root: true },
  );
});
