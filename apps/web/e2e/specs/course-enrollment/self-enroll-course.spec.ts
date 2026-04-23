import { USER_ROLE } from "~/config/userRoles";

import { expect, test } from "../../fixtures/test.fixture";
import { selfEnrollCourseFlow } from "../../flows/courses/self-enroll-course.flow";

test("student can self-enroll in a free published course", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const categoryFactory = factories.createCategoryFactory();
  const courseFactory = factories.createCourseFactory();
  const enrollmentFactory = factories.createEnrollmentFactory();
  let categoryId = "";
  let courseId = "";
  let studentUserId = "";

  await withWorkerPage(USER_ROLE.admin, async () => {
    const prefix = `self-enroll-${Date.now()}`;
    const category = await categoryFactory.create(`Self Enroll Category ${prefix}`);
    const course = await courseFactory.create({
      title: `${prefix}-course`,
      categoryId: category.id,
      status: "published",
    });

    categoryId = category.id;
    courseId = course.id;

    cleanup.add(async () => {
      await courseFactory.update(courseId, { status: "draft", language: "en" });
      await courseFactory.delete(courseId);
      await categoryFactory.delete(categoryId);
    });
  });

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    studentUserId = await enrollmentFactory.getCurrentUserId();

    await selfEnrollCourseFlow(page, courseId);
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
