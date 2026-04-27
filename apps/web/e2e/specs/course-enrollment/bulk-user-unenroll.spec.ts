import { COURSE_ENROLLMENT } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { COURSE_ENROLLED_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { confirmUnenrollSelectedUsersFlow } from "../../flows/courses/confirm-unenroll-selected-users.flow";
import { filterEnrolledUsersFlow } from "../../flows/courses/filter-enrolled-users.flow";
import { openCourseEnrolledTabFlow } from "../../flows/courses/open-course-enrolled-tab.flow";
import { selectEnrolledUsersFlow } from "../../flows/courses/select-enrolled-users.flow";

test("admin can bulk unenroll selected directly enrolled users", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const enrollmentFactory = factories.createEnrollmentFactory();
    const userFactory = factories.createUserFactory();
    const prefix = `bulk-unenroll-${Date.now()}`;
    const category = await categoryFactory.create(`Bulk Unenroll Category ${prefix}`);
    const users = await userFactory.createMany(2, (index) => ({
      email: `${prefix}-${index}@example.com`,
      firstName: `Bulk Unenroll ${index}`,
      lastName: prefix,
    }));
    const course = await courseFactory.create({
      title: `${prefix}-course`,
      categoryId: category.id,
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await userFactory.deleteMany(users.map((user) => user.id));
      await categoryFactory.delete(category.id);
    });

    await enrollmentFactory.enrollUsers(
      course.id,
      users.map((user) => user.id),
    );

    await openCourseEnrolledTabFlow(page, course.id);
    await filterEnrolledUsersFlow(page, { keyword: prefix });

    for (const user of users) {
      await expect(
        page.getByTestId(COURSE_ENROLLED_HANDLES.statusBadge(user.id, COURSE_ENROLLMENT.ENROLLED)),
      ).toBeVisible();
    }

    await selectEnrolledUsersFlow(
      page,
      users.map((user) => user.id),
    );
    await confirmUnenrollSelectedUsersFlow(page);

    await expect
      .poll(async () => {
        const enrolledUsers = await Promise.all(
          users.map((user) => enrollmentFactory.getUser(course.id, user.id)),
        );

        return enrolledUsers.every((user) => user?.enrolledAt === null);
      })
      .toBe(true);
  });
});
