import { COURSE_ENROLLMENT } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { COURSE_ENROLLED_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { confirmEnrollSelectedUsersFlow } from "../../flows/courses/confirm-enroll-selected-users.flow";
import { filterEnrolledUsersFlow } from "../../flows/courses/filter-enrolled-users.flow";
import { openCourseEnrolledTabFlow } from "../../flows/courses/open-course-enrolled-tab.flow";
import { selectEnrolledUsersFlow } from "../../flows/courses/select-enrolled-users.flow";

test("admin can bulk enroll selected users", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const enrollmentFactory = factories.createEnrollmentFactory();
    const userFactory = factories.createUserFactory();
    const prefix = `bulk-enroll-${Date.now()}`;
    const category = await categoryFactory.create(`Bulk Enroll Category ${prefix}`);
    const users = await userFactory.createMany(2, (index) => ({
      email: `${prefix}-${index}@example.com`,
      firstName: `Bulk Enroll ${index}`,
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

    const selectedUsers = [users[0]];
    const unselectedUser = users[1];

    await openCourseEnrolledTabFlow(page, course.id);
    await filterEnrolledUsersFlow(page, { keyword: prefix });

    for (const user of selectedUsers) {
      await expect(
        page.getByTestId(
          COURSE_ENROLLED_HANDLES.statusBadge(user.id, COURSE_ENROLLMENT.NOT_ENROLLED),
        ),
      ).toBeVisible();
    }

    await selectEnrolledUsersFlow(
      page,
      selectedUsers.map((user) => user.id),
    );
    await confirmEnrollSelectedUsersFlow(page);

    await expect
      .poll(async () => {
        const enrolledUsers = await Promise.all(
          selectedUsers.map((user) => enrollmentFactory.getUser(course.id, user.id)),
        );

        return enrolledUsers.every((user) => Boolean(user?.enrolledAt));
      })
      .toBe(true);

    await expect
      .poll(async () => {
        const user = await enrollmentFactory.getUser(course.id, unselectedUser.id);

        return user?.enrolledAt ?? null;
      })
      .toBeNull();
  });
});
