import { DASHBOARD_WIDGET_SIZES, DASHBOARD_WIDGET_TYPES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { DASHBOARD_WIDGET_HANDLES } from "../../data/dashboard/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openDashboardFlow } from "../../flows/dashboard/open-dashboard.flow";
import {
  expandDeadlineRiskGroupFlow,
  openDeadlineRiskCourseFlow,
} from "../../flows/dashboard/open-deadline-risk-course.flow";
import { setDashboardWidgets } from "../../utils/dashboard-settings";

test.describe("admin dashboard widgets", () => {
  test("shows a live-training event in the real calendar response", async ({
    apiClient,
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const liveTrainingFactory = factories.createLiveTrainingFactory();
      const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const title = `Dashboard event ${Date.now()}`;
      const liveTraining = await liveTrainingFactory.createOffline({
        title,
        startsAt,
        endsAt,
        allDay: true,
      });

      cleanup.add(() => liveTrainingFactory.delete(liveTraining.id));
      await setDashboardWidgets(apiClient, [
        {
          type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
          size: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO,
        },
      ]);

      await openDashboardFlow(page);

      const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR);
      await expect(widget).toBeVisible();
      await expect(widget.getByRole("heading", { name: "Event calendar" })).toBeVisible();
      await expect(widget.getByText(title)).toBeVisible();
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
      const enrollmentFactory = factories.createEnrollmentFactory();
      const prefix = `dashboard-training-${Date.now()}`;
      const category = await categoryFactory.create(`${prefix}-category`);
      const course = await courseFactory.create({
        title: `${prefix}-course`,
        categoryId: category.id,
      });
      const group = await groupFactory.create({ name: `${prefix}-group` });
      const student = await userFactory.create({ email: `${prefix}@example.com` });

      cleanup.add(() => categoryFactory.delete(category.id));
      cleanup.add(() => groupFactory.delete(group.id));
      cleanup.add(() => courseFactory.delete(course.id));
      cleanup.add(() => userFactory.delete(student.id));

      await userFactory.update(student.id, { groups: [group.id] });
      await enrollmentFactory.enrollGroups(course.id, [{ id: group.id, isMandatory: false }]);
      await setDashboardWidgets(apiClient, [
        {
          type: DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION,
          size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
        },
      ]);

      await openDashboardFlow(page);

      const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION);
      await expect(widget).toBeVisible();
      await expect(widget.getByRole("img", { name: /of 1 enrollments completed/ })).toBeVisible();
      await expect(widget.getByText("0%", { exact: true })).toBeVisible();
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
      const enrollmentFactory = factories.createEnrollmentFactory();
      const prefix = `dashboard-deadline-${Date.now()}`;
      const category = await categoryFactory.create(`${prefix}-category`);
      const course = await courseFactory.create({
        title: `${prefix}-course`,
        categoryId: category.id,
      });
      const group = await groupFactory.create({ name: `${prefix}-group` });
      const student = await userFactory.create({
        email: `${prefix}@example.com`,
        firstName: "Deadline",
        lastName: "Learner",
      });

      cleanup.add(() => categoryFactory.delete(category.id));
      cleanup.add(() => groupFactory.delete(group.id));
      cleanup.add(() => courseFactory.delete(course.id));
      cleanup.add(() => userFactory.delete(student.id));

      await userFactory.update(student.id, { groups: [group.id] });
      await enrollmentFactory.enrollGroups(course.id, [
        {
          id: group.id,
          isMandatory: true,
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ]);
      await setDashboardWidgets(apiClient, [
        {
          type: DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS,
          size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
        },
      ]);

      await openDashboardFlow(page);

      const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_DEADLINE_RISKS);
      await expect(
        widget.getByRole("button", { name: new RegExp(`${prefix}-course`) }),
      ).toBeVisible();
      await openDeadlineRiskCourseFlow(page, `${prefix}-course`);

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText(`${prefix}-group`)).toBeVisible();
      await expandDeadlineRiskGroupFlow(page, `${prefix}-group`);
      await expect(dialog.getByText("Deadline Learner")).toBeVisible();
    });
  });
});
