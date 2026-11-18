import { DASHBOARD_WIDGET_SIZES, DASHBOARD_WIDGET_TYPES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import {
  DASHBOARD_DEADLINE_RISK_HANDLES,
  DASHBOARD_WIDGET_HANDLES,
} from "../../data/dashboard/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openDashboardFlow } from "../../flows/dashboard/open-dashboard.flow";
import {
  expandDeadlineRiskGroupFlow,
  openDeadlineRiskCourseFlow,
} from "../../flows/dashboard/open-deadline-risk-course.flow";
import { setDashboardWidgets } from "../../utils/dashboard-settings";

const HOUR_MS = 60 * 60 * 1000;

test.describe("admin dashboard widgets", () => {
  test("shows a live-training event in the real calendar response", async ({
    apiClient,
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const liveTrainingFactory = factories.createLiveTrainingFactory();
      const title = `Dashboard event ${Date.now()}`;
      await liveTrainingFactory.createOffline(cleanup, {
        title,
        startsAt: new Date(Date.now() + HOUR_MS).toISOString(),
        endsAt: new Date(Date.now() + 2 * HOUR_MS).toISOString(),
        allDay: true,
      });

      cleanup.add(
        await setDashboardWidgets(apiClient, [
          { type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR, size: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO },
        ]),
      );

      await openDashboardFlow(page);

      await expect(page.getByTestId(DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR)).toContainText(title);
    });
  });

  test("shows training completion calculated from a real group enrollment", async ({
    apiClient,
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const categoryFactory = factories.createCategoryFactory();
      const courseFactory = factories.createCourseFactory();
      const groupFactory = factories.createGroupFactory();
      const userFactory = factories.createUserFactory();
      const prefix = `dashboard-training-${Date.now()}`;
      const category = await categoryFactory.create(`${prefix}-category`);
      cleanup.add(() => categoryFactory.delete(category.id));
      const course = await courseFactory.create({
        title: `${prefix}-course`,
        categoryId: category.id,
      });
      cleanup.add(() => courseFactory.delete(course.id));
      const group = await groupFactory.create({ name: `${prefix}-group` });
      cleanup.add(() => groupFactory.delete(group.id));
      const student = await userFactory.create({ email: `${prefix}@example.com` });
      cleanup.add(() => userFactory.delete(student.id));

      await userFactory.update(student.id, { groups: [group.id] });
      await factories
        .createEnrollmentFactory()
        .enrollGroups(course.id, [{ id: group.id, isMandatory: false }]);
      cleanup.add(
        await setDashboardWidgets(apiClient, [
          {
            type: DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION,
            size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
          },
        ]),
      );

      await openDashboardFlow(page);

      const chart = page
        .getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION)
        .getByTestId(DASHBOARD_WIDGET_HANDLES.CHART);
      await expect(chart.getByTestId(DASHBOARD_WIDGET_HANDLES.CHART_PERCENTAGE)).toHaveText("0%");
      await expect(chart.getByTestId(DASHBOARD_WIDGET_HANDLES.CHART_COMPLETED_OF_TOTAL)).toHaveText(
        "0/1",
      );
    });
  });

  test("opens real deadline-risk groups and learners", async ({
    apiClient,
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const categoryFactory = factories.createCategoryFactory();
      const courseFactory = factories.createCourseFactory();
      const groupFactory = factories.createGroupFactory();
      const userFactory = factories.createUserFactory();
      const prefix = `dashboard-deadline-${Date.now()}`;
      const category = await categoryFactory.create(`${prefix}-category`);
      cleanup.add(() => categoryFactory.delete(category.id));
      const course = await courseFactory.create({
        title: `${prefix}-course`,
        categoryId: category.id,
      });
      cleanup.add(() => courseFactory.delete(course.id));
      const group = await groupFactory.create({ name: `${prefix}-group` });
      cleanup.add(() => groupFactory.delete(group.id));
      const student = await userFactory.create({ email: `${prefix}@example.com` });
      cleanup.add(() => userFactory.delete(student.id));

      await userFactory.update(student.id, { groups: [group.id] });
      await factories.createEnrollmentFactory().enrollGroups(course.id, [
        {
          id: group.id,
          isMandatory: true,
          dueDate: new Date(Date.now() + 48 * HOUR_MS).toISOString(),
        },
      ]);
      cleanup.add(
        await setDashboardWidgets(apiClient, [
          { type: DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS, size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO },
        ]),
      );

      await openDashboardFlow(page);
      await openDeadlineRiskCourseFlow(page, course.id);
      await expandDeadlineRiskGroupFlow(page, group.id);

      await expect(
        page
          .getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.DIALOG)
          .getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.learner(student.id)),
      ).toBeVisible();
    });
  });
});
