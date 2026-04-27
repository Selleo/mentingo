import { USER_ROLE } from "~/config/userRoles";

import { expect, test } from "../../fixtures/test.fixture";
import { enrollCourseGroupsFlow } from "../../flows/courses/enroll-course-groups.flow";
import { openCourseEnrolledTabFlow } from "../../flows/courses/open-course-enrolled-tab.flow";

test("admin can enroll a group to a course", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const enrollmentFactory = factories.createEnrollmentFactory();
    const groupFactory = factories.createGroupFactory();
    const userFactory = factories.createUserFactory();
    const prefix = `group-enroll-${Date.now()}`;
    const category = await categoryFactory.create(`Group Enroll Category ${prefix}`);
    const group = await groupFactory.create({ name: `${prefix}-group` });
    const users = await userFactory.createMany(2, (index) => ({
      email: `${prefix}-${index}@example.com`,
      firstName: `Group Enroll ${index}`,
      lastName: prefix,
    }));
    const course = await courseFactory.create({
      title: `${prefix}-course`,
      categoryId: category.id,
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await userFactory.deleteMany(users.map((user) => user.id));
      await groupFactory.delete(group.id);
      await categoryFactory.delete(category.id);
    });

    await Promise.all(users.map((user) => userFactory.update(user.id, { groups: [group.id] })));

    await openCourseEnrolledTabFlow(page, course.id);
    await enrollCourseGroupsFlow(page, [group.id]);

    await expect
      .poll(async () => {
        const enrolledGroups = await enrollmentFactory.getGroups(course.id);
        return enrolledGroups.some((enrolledGroup) => enrolledGroup.id === group.id);
      })
      .toBe(true);

    await expect
      .poll(async () => {
        const enrolledUsers = await Promise.all(
          users.map((user) => enrollmentFactory.getUser(course.id, user.id)),
        );

        return enrolledUsers.every((user) => user?.isEnrolledByGroup);
      })
      .toBe(true);
  });
});
