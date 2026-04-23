import { COURSE_ENROLLMENT } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { COURSE_ENROLLED_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { filterEnrolledUsersFlow } from "../../flows/courses/filter-enrolled-users.flow";
import { openCourseEnrolledTabFlow } from "../../flows/courses/open-course-enrolled-tab.flow";

test("admin can verify enrolled users and filter by keyword and group", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const enrollmentFactory = factories.createEnrollmentFactory();
    const groupFactory = factories.createGroupFactory();
    const userFactory = factories.createUserFactory();
    const prefix = `enrolled-list-${Date.now()}`;
    const category = await categoryFactory.create(`Enrollment Category ${prefix}`);
    const group = await groupFactory.create({ name: `${prefix}-group` });
    const [notEnrolledUser, directUser, groupUser] = await userFactory.createMany(3, (index) => ({
      email: `${prefix}-${index}@example.com`,
      firstName: `Enrollment ${index}`,
      lastName: prefix,
    }));
    const course = await courseFactory.create({
      title: `${prefix}-course`,
      categoryId: category.id,
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await userFactory.deleteMany([notEnrolledUser.id, directUser.id, groupUser.id]);
      await groupFactory.delete(group.id);
      await categoryFactory.delete(category.id);
    });

    await userFactory.update(groupUser.id, { groups: [group.id] });
    await enrollmentFactory.enrollUsers(course.id, [directUser.id]);
    await enrollmentFactory.enrollGroups(course.id, [
      { id: group.id, isMandatory: false, dueDate: null },
    ]);

    await openCourseEnrolledTabFlow(page, course.id);
    await filterEnrolledUsersFlow(page, { keyword: prefix });

    await expect(page.getByTestId(COURSE_ENROLLED_HANDLES.row(notEnrolledUser.id))).toBeVisible();
    await expect(page.getByTestId(COURSE_ENROLLED_HANDLES.row(directUser.id))).toBeVisible();
    await expect(page.getByTestId(COURSE_ENROLLED_HANDLES.row(groupUser.id))).toBeVisible();
    await expect(
      page.getByTestId(
        COURSE_ENROLLED_HANDLES.statusBadge(notEnrolledUser.id, COURSE_ENROLLMENT.NOT_ENROLLED),
      ),
    ).toBeVisible();
    await expect(
      page.getByTestId(
        COURSE_ENROLLED_HANDLES.statusBadge(directUser.id, COURSE_ENROLLMENT.ENROLLED),
      ),
    ).toBeVisible();
    await expect(
      page.getByTestId(
        COURSE_ENROLLED_HANDLES.statusBadge(groupUser.id, COURSE_ENROLLMENT.GROUP_ENROLLED),
      ),
    ).toBeVisible();

    await page.getByTestId(COURSE_ENROLLED_HANDLES.sortButton("email")).click();
    await expect(page.getByTestId(COURSE_ENROLLED_HANDLES.row(directUser.id))).toBeVisible();

    await filterEnrolledUsersFlow(page, { groupIds: [group.id] });
    await expect(page.getByTestId(COURSE_ENROLLED_HANDLES.row(groupUser.id))).toBeVisible();
    await expect(page.getByTestId(COURSE_ENROLLED_HANDLES.row(directUser.id))).toBeHidden();
  });
});
