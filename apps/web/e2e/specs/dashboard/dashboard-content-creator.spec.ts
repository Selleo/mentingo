import { DASHBOARD_WIDGET_SIZES, DASHBOARD_WIDGET_TYPES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import {
  DASHBOARD_DEADLINE_RISK_HANDLES,
  DASHBOARD_WIDGET_HANDLES,
} from "../../data/dashboard/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openDashboardFlow } from "../../flows/dashboard/open-dashboard.flow";
import { setDashboardWidgets } from "../../utils/dashboard-settings";

const DAY_MS = 24 * 60 * 60 * 1000;

test("content creator sees deadline risks of their own courses only", async ({
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
  const dueDate = new Date(Date.now() + 2 * DAY_MS).toISOString();
  let categoryId = "";
  let groupId = "";
  let ownCourseId = "";
  let otherCourseId = "";

  await withWorkerPage(USER_ROLE.admin, async () => {
    const category = await categoryFactory.create(`${prefix}-category`);
    categoryId = category.id;
    cleanup.add(() =>
      withWorkerPage(USER_ROLE.admin, async () => {
        await categoryFactory.delete(category.id);
      }),
    );
    const group = await groupFactory.create({ name: `${prefix}-group` });
    groupId = group.id;
    cleanup.add(() =>
      withWorkerPage(USER_ROLE.admin, async () => {
        await groupFactory.delete(group.id);
      }),
    );
    const student = await userFactory.create({ email: `${prefix}@example.com` });
    cleanup.add(() =>
      withWorkerPage(USER_ROLE.admin, async () => {
        await userFactory.delete(student.id);
      }),
    );
    await userFactory.update(student.id, { groups: [group.id] });

    const otherCourse = await courseFactory.create({
      title: `${prefix}-admin-course`,
      categoryId: category.id,
    });
    otherCourseId = otherCourse.id;
    cleanup.add(() =>
      withWorkerPage(USER_ROLE.admin, async () => {
        await courseFactory.delete(otherCourse.id);
      }),
    );
    await courseFactory.update(otherCourse.id, { status: "published", language: "en" });
    await enrollmentFactory.enrollGroups(otherCourse.id, [
      { id: group.id, isMandatory: true, dueDate },
    ]);
  });

  await withWorkerPage(USER_ROLE.contentCreator, async () => {
    const ownCourse = await courseFactory.create({ title: `${prefix}-course`, categoryId });
    ownCourseId = ownCourse.id;
    cleanup.add(() =>
      withWorkerPage(USER_ROLE.admin, async () => {
        await courseFactory.delete(ownCourse.id);
      }),
    );
    await courseFactory.update(ownCourse.id, { status: "published", language: "en" });
  });

  await withWorkerPage(USER_ROLE.admin, async () => {
    await enrollmentFactory.enrollGroups(ownCourseId, [
      { id: groupId, isMandatory: true, dueDate },
    ]);
  });

  await withWorkerPage(USER_ROLE.contentCreator, async ({ page }) => {
    cleanup.add(
      await setDashboardWidgets(apiClient, [
        { type: DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS, size: DASHBOARD_WIDGET_SIZES.THREE_BY_TWO },
        {
          type: DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION,
          size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
        },
      ]),
    );

    await openDashboardFlow(page);

    const deadlineRisks = page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_DEADLINE_RISKS);
    await expect(
      deadlineRisks.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.course(ownCourseId)),
    ).toBeVisible();
    await expect(
      deadlineRisks.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.course(otherCourseId)),
    ).toHaveCount(0);
    // Only the own course counts: its group has one learner who has not completed it.
    const chart = page
      .getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION)
      .getByTestId(DASHBOARD_WIDGET_HANDLES.CHART);
    await expect(chart.getByTestId(DASHBOARD_WIDGET_HANDLES.CHART_COMPLETED_OF_TOTAL)).toHaveText(
      "0/1",
    );
  });
});
