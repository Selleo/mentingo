import { DASHBOARD_WIDGET_SIZES, DASHBOARD_WIDGET_TYPES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { DASHBOARD_WIDGET_HANDLES } from "../../data/dashboard/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openDashboardFlow } from "../../flows/dashboard/open-dashboard.flow";
import { setDashboardWidgets } from "../../utils/dashboard-settings";

test("content creator sees scoped management data from real course records", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const categoryFactory = factories.createCategoryFactory();
  const courseFactory = factories.createCourseFactory();
  const groupFactory = factories.createGroupFactory();
  const userFactory = factories.createUserFactory();
  const enrollmentFactory = factories.createEnrollmentFactory();
  const prefix = `dashboard-creator-${Date.now()}`;

  let category!: Awaited<ReturnType<typeof categoryFactory.create>>;
  await withWorkerPage(USER_ROLE.admin, async () => {
    category = await categoryFactory.create(`${prefix}-category`);
  });

  let course!: Awaited<ReturnType<typeof courseFactory.create>>;
  await withWorkerPage(USER_ROLE.contentCreator, async () => {
    const createdCourse = await courseFactory.create({
      title: `${prefix}-course`,
      categoryId: category.id,
    });
    await courseFactory.update(createdCourse.id, { status: "published", language: "en" });
    course = await courseFactory.getById(createdCourse.id);
  });

  let groupId!: string;
  let studentId!: string;
  await withWorkerPage(USER_ROLE.admin, async () => {
    const group = await groupFactory.create({ name: `${prefix}-group` });
    const student = await userFactory.create({ email: `${prefix}@example.com` });
    groupId = group.id;
    studentId = student.id;

    await userFactory.update(student.id, { groups: [group.id] });
    await enrollmentFactory.enrollGroups(course.id, [
      {
        id: group.id,
        isMandatory: true,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]);
  });

  cleanup.add(async () => {
    await withWorkerPage(USER_ROLE.admin, async () => {
      await userFactory.delete(studentId);
      await courseFactory.delete(course.id);
      await groupFactory.delete(groupId);
      await categoryFactory.delete(category.id);
    });
  });

  await withWorkerPage(USER_ROLE.contentCreator, async ({ page }) => {
    await setDashboardWidgets(apiClient, [
      {
        type: DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS,
        size: DASHBOARD_WIDGET_SIZES.THREE_BY_TWO,
      },
      {
        type: DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION,
        size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
      },
    ]);

    await openDashboardFlow(page);

    await expect(page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_DEADLINE_RISKS)).toContainText(
      `${prefix}-course`,
    );
    await expect(
      page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION),
    ).toContainText("Training completion");
  });
});
