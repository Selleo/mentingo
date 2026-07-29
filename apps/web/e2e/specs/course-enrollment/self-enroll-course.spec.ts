import { USER_ROLE } from "~/config/userRoles";

import { expect, test } from "../../fixtures/test.fixture";
import { selfEnrollCourseFlow } from "../../flows/courses/self-enroll-course.flow";
import { createTwoContentLessonsCourse } from "../learning/learning-test-helpers";

test("student can self-enroll in a free published course", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();
  let studentUserId = "";

  const { courseId, lessons } = await createTwoContentLessonsCourse({
    cleanup,
    factories,
    prefix: `self-enroll-${Date.now()}`,
    withWorkerPage,
  });

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    studentUserId = await enrollmentFactory.getCurrentUserId();

    await selfEnrollCourseFlow(page, courseId);
    await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${lessons.firstLesson.id}$`));
  });

  await withWorkerPage(USER_ROLE.admin, async () => {
    await expect
      .poll(async () => {
        const enrolledUser = await enrollmentFactory.getUser(courseId, studentUserId);

        return Boolean(enrolledUser?.enrolledAt);
      })
      .toBe(true);
  });
});
