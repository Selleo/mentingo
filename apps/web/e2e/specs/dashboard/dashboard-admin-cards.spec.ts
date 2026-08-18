import {
  DASHBOARD_WIDGET_SIZES,
  DASHBOARD_WIDGET_TYPES,
  type DashboardWidgetSize,
  type DashboardWidgetType,
} from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { DASHBOARD_WIDGET_HANDLES } from "../../data/dashboard/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openDashboardFlow } from "../../flows/dashboard/open-dashboard.flow";
import { setDashboardWidgets } from "../../utils/dashboard-settings";

import type { Page, Route } from "@playwright/test";

type DashboardWidget = {
  type: DashboardWidgetType;
  size: DashboardWidgetSize;
  visible: boolean;
};

type RequestHandler = (route: Route, url: URL) => Promise<boolean>;

const COURSE_ONE = "66666666-6666-4666-8666-666666666666";
const COURSE_TWO = "66666666-6666-4666-8666-666666666667";

const json = async (route: Route, body: unknown, status = 200) => {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
};

const wrapped = async (route: Route, body: unknown, status = 200) =>
  json(route, { data: body }, status);

const dashboardMocks = async (
  page: Page,
  widgets: DashboardWidget[],
  onRequest: RequestHandler,
) => {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && url.pathname === "/api/settings") {
      await wrapped(route, {
        language: "en",
        isMFAEnabled: false,
        MFASecret: null,
        dashboard: { widgets: [] },
      });
      return;
    }

    if (request.method() === "GET" && url.pathname === "/api/settings/dashboard") {
      await wrapped(route, {
        layout: { schemaVersion: 2, revision: 0, widgets },
        catalog: widgets.map((widget) => ({
          type: widget.type,
          allowedSizes: [widget.size],
          defaultSize: widget.size,
        })),
      });
      return;
    }

    if (await onRequest(route, url)) return;
    await route.continue();
  });
};

const widget = (
  type: DashboardWidgetType,
  size: DashboardWidget["size"] = "2x2",
): DashboardWidget => ({
  type,
  size,
  visible: true,
});

const course = (id: string, title: string, urgency: "overdue" | "dueSoon" = "overdue") => ({
  id,
  title,
  thumbnailUrl: null,
  overdueCount: urgency === "overdue" ? 2 : 0,
  dueSoonCount: urgency === "dueSoon" ? 2 : 0,
  nearestDueDate: urgency === "overdue" ? "2026-08-01T00:00:00.000Z" : "2026-08-30T00:00:00.000Z",
  urgency,
});

const group = (
  id: string,
  name: string,
  studentName: string,
  urgency: "overdue" | "dueSoon" = "overdue",
) => ({
  id,
  name,
  dueDate: "2026-08-20T00:00:00.000Z",
  urgency,
  studentCount: 1,
  students: [{ id: `${id}-student`, name: studentName }],
});

test.describe("admin dashboard utility cards", () => {
  test("deadline risks sends urgency, filter, search, sort and pagination parameters", async ({
    withReadonlyPage,
  }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      const requests: URL[] = [];
      await dashboardMocks(
        page,
        [widget(DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS, "2x2")],
        async (route, url) => {
          if (route.request().method() !== "GET") return false;

          if (url.pathname === "/api/statistics/dashboard/deadline-risks/courses") {
            requests.push(url);
            await json(route, {
              data: [course(COURSE_ONE, "Security onboarding")],
              pagination: { totalItems: 1, page: 1, perPage: 20 },
            });
            return true;
          }

          if (
            url.pathname === `/api/statistics/dashboard/deadline-risks/courses/${COURSE_ONE}/groups`
          ) {
            requests.push(url);
            const pageNumber = url.searchParams.get("page") ?? "1";
            await json(route, {
              data:
                pageNumber === "1"
                  ? [group("group-1", "Sales", "Alex Learner")]
                  : [group("group-2", "Support", "Morgan Learner", "dueSoon")],
              pagination: { totalItems: 2, page: Number(pageNumber), perPage: 1 },
            });
            return true;
          }

          return false;
        },
      );

      await page.goto("/dashboard");
      const widgetCard = page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_DEADLINE_RISKS);
      await widgetCard.getByRole("button", { name: /Security onboarding/ }).click();
      const dialog = page.getByRole("dialog");

      await dialog.getByRole("combobox", { name: "Status" }).click();
      await page.getByRole("option", { name: "Overdue" }).click();
      await dialog.getByRole("searchbox", { name: "Search groups or learners" }).fill("Sales");
      await expect
        .poll(() =>
          requests.some(
            (request) =>
              request.pathname.endsWith(`/courses/${COURSE_ONE}/groups`) &&
              request.searchParams.get("urgency") === "overdue" &&
              request.searchParams.get("search") === "Sales",
          ),
        )
        .toBe(true);
      await expect(dialog.getByText("Sales")).toBeVisible();
      await dialog.getByRole("button", { name: "Learners" }).click();

      await expect
        .poll(() =>
          requests.some(
            (request) =>
              request.pathname.endsWith(`/courses/${COURSE_ONE}/groups`) &&
              request.searchParams.get("urgency") === "overdue" &&
              request.searchParams.get("search") === "Sales" &&
              request.searchParams.get("sortBy") === "studentCount" &&
              request.searchParams.get("sortDirection") === "desc" &&
              request.searchParams.get("page") === "1" &&
              request.searchParams.get("perPage") === "20",
          ),
        )
        .toBe(true);

      const scrollContainer = dialog.locator("div.min-h-0.flex-1.overflow-y-auto");
      await scrollContainer.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        element.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
      await expect(dialog.getByText("Support")).toBeVisible();

      const paginatedGroupRequest = requests.find(
        (request) =>
          request.pathname.endsWith(`/courses/${COURSE_ONE}/groups`) &&
          request.searchParams.get("page") === "2",
      );
      expect(paginatedGroupRequest?.searchParams.get("language")).toBe("en");
      expect(paginatedGroupRequest?.searchParams.get("perPage")).toBe("20");

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await widgetCard.getByRole("button", { name: /sort/i }).click();
      await page.getByRole("menuitemradio", { name: "Least urgent first" }).click();
      await expect
        .poll(() =>
          requests
            .filter((request) => request.pathname.endsWith("/courses"))
            .at(-1)
            ?.searchParams.get("urgencyOrder"),
        )
        .toBe("leastUrgent");
    });
  });

  test("keeps the same-course rows visible during sorting and expands learners without bubbling out of the dialog", async ({
    withReadonlyPage,
  }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      let releaseSortedGroups!: () => void;
      const sortedGroups = new Promise<void>((resolve) => {
        releaseSortedGroups = resolve;
      });

      await dashboardMocks(
        page,
        [widget(DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS)],
        async (route, url) => {
          if (route.request().method() !== "GET") return false;
          if (url.pathname === "/api/statistics/dashboard/deadline-risks/courses") {
            await json(route, {
              data: [course(COURSE_ONE, "Security onboarding")],
              pagination: { totalItems: 1, page: 1, perPage: 20 },
            });
            return true;
          }
          if (url.pathname.endsWith(`/courses/${COURSE_ONE}/groups`)) {
            if (url.searchParams.get("sortBy") === "name") {
              await sortedGroups;
              await json(route, {
                data: [group("group-2", "Sorted Sales", "Sorted Learner")],
                pagination: { totalItems: 1, page: 1, perPage: 20 },
              });
            } else {
              await json(route, {
                data: [group("group-1", "Initial Sales", "Initial Learner")],
                pagination: { totalItems: 1, page: 1, perPage: 20 },
              });
            }
            return true;
          }
          return false;
        },
      );

      await page.goto("/dashboard");
      const card = page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_DEADLINE_RISKS);
      await card.getByRole("button", { name: /Security onboarding/ }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Initial Sales")).toBeVisible();
      await dialog.getByText("Initial Sales").click();
      await expect(dialog.getByText("Initial Learner")).toBeVisible();

      await dialog.getByRole("button", { name: "Group" }).click();
      await expect(dialog.getByText("Initial Sales")).toBeVisible();
      releaseSortedGroups();
      await expect(dialog.getByText("Sorted Sales")).toBeVisible();
      await expect(dialog.getByText("Initial Sales")).toHaveCount(0);

      await dialog.click({ position: { x: 20, y: 20 } });
      await expect(dialog).toBeVisible();
    });
  });

  test("does not show groups from the previous course after switching courses", async ({
    withReadonlyPage,
  }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      let releaseCourseTwo!: () => void;
      const courseTwoResponse = new Promise<void>((resolve) => {
        releaseCourseTwo = resolve;
      });

      await dashboardMocks(
        page,
        [widget(DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS)],
        async (route, url) => {
          if (route.request().method() !== "GET") return false;
          if (url.pathname === "/api/statistics/dashboard/deadline-risks/courses") {
            await json(route, {
              data: [course(COURSE_ONE, "Course one"), course(COURSE_TWO, "Course two", "dueSoon")],
              pagination: { totalItems: 2, page: 1, perPage: 20 },
            });
            return true;
          }
          if (url.pathname.endsWith(`/courses/${COURSE_ONE}/groups`)) {
            await json(route, {
              data: [group("one-group", "One group", "One learner")],
              pagination: { totalItems: 1, page: 1, perPage: 20 },
            });
            return true;
          }
          if (url.pathname.endsWith(`/courses/${COURSE_TWO}/groups`)) {
            await courseTwoResponse;
            await json(route, {
              data: [group("two-group", "Two group", "Two learner")],
              pagination: { totalItems: 1, page: 1, perPage: 20 },
            });
            return true;
          }
          return false;
        },
      );

      await page.goto("/dashboard");
      const card = page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_DEADLINE_RISKS);
      await card.getByRole("button", { name: /Course one/ }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("One group")).toBeVisible();
      await page.keyboard.press("Escape");
      await card.getByRole("button", { name: /Course two/ }).click();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("One group")).toHaveCount(0);
      releaseCourseTwo();
      await expect(dialog.getByText("Two group")).toBeVisible();
    });
  });

  test("renders training completion data, empty state, and an accessible chart tooltip", async ({
    withReadonlyPage,
  }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      await dashboardMocks(
        page,
        [widget(DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION)],
        async (route, url) => {
          if (
            route.request().method() !== "GET" ||
            url.pathname !== "/api/statistics/dashboard/training-completion"
          )
            return false;
          await wrapped(route, {
            completed: 4,
            inProgress: 2,
            notStarted: 1,
            total: 7,
            percentage: 57,
          });
          return true;
        },
      );
      await page.goto("/dashboard");
      const card = page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION);
      const chart = card.getByRole("img", { name: "4 of 7 enrollments completed, 57 percent." });
      await expect(chart).toBeVisible();
      await expect(card.getByText("57%", { exact: true })).toBeVisible();
      const chartSurface = card.locator("svg.recharts-surface");
      await chartSurface.hover({ position: { x: 220, y: 128 } });
      await expect(card.getByText("Completed", { exact: true })).toBeVisible();
    });
  });

  test("shows training completion empty and error states", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      let requestCount = 0;
      await dashboardMocks(
        page,
        [widget(DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION)],
        async (route, url) => {
          if (
            route.request().method() !== "GET" ||
            url.pathname !== "/api/statistics/dashboard/training-completion"
          )
            return false;
          requestCount += 1;
          await wrapped(
            route,
            requestCount === 1
              ? { completed: 0, inProgress: 0, notStarted: 0, total: 0, percentage: 0 }
              : {},
            requestCount === 1 ? 200 : 500,
          );
          return true;
        },
      );
      await page.goto("/dashboard");
      const card = page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION);
      await expect(card.getByText("No course enrollments yet.")).toBeVisible();
      await page.reload();
      await expect(card.getByText("We could not load this widget.")).toBeVisible();
      await expect(card.getByRole("button", { name: "Try again" })).toBeVisible();
    });
  });

  test("renders calendar events on mobile, navigates months, and handles an empty upcoming list", async ({
    withReadonlyPage,
  }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      const allRequests: URL[] = [];
      await dashboardMocks(
        page,
        [widget(DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR, "4x2")],
        async (route, url) => {
          if (
            route.request().method() !== "GET" ||
            url.pathname !== "/api/calendar/dashboard/events"
          )
            return false;
          allRequests.push(url);
          await wrapped(
            route,
            url.searchParams.get("view") === "all"
              ? [
                  {
                    id: "calendar-event-1",
                    sourceType: "live_training",
                    targetId: "calendar-event-1",
                    title: "Planning session",
                    startsAt: new Date().toISOString(),
                    allDay: true,
                  },
                ]
              : [],
          );
          return true;
        },
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/dashboard");
      const card = page.getByTestId(DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR);
      await expect(card).toBeVisible();
      await expect(card.getByRole("grid")).toBeVisible();
      await expect(card.getByText("Planning session")).toBeVisible();
      await expect(card.getByText("No events this month.")).toBeVisible();
      await expect(card.getByRole("button", { name: "Next month" })).toBeVisible();
      await card.getByRole("button", { name: "Next month" }).click();
      await expect
        .poll(
          () => allRequests.filter((request) => request.searchParams.get("view") === "all").length,
        )
        .toBeGreaterThan(1);
    });
  });

  test("supports to-do CRUD, completion, reorder and persistence outside dashboard edit mode", async ({
    cleanup,
    withIsolatedWorkerPage,
  }) => {
    await withIsolatedWorkerPage(
      USER_ROLE.admin,
      async ({ apiClient, factories, origin, page }) => {
        const taskFactory = factories.createTodoTaskFactory();
        await setDashboardWidgets(apiClient, [
          {
            type: DASHBOARD_WIDGET_TYPES.TODO_LIST,
            size: DASHBOARD_WIDGET_SIZES.THREE_BY_TWO,
          },
        ]);
        const reviewTask = await taskFactory.create({ title: "Review inbox" });
        const agendaTask = await taskFactory.create({ title: "Prepare agenda" });
        const archiveTask = await taskFactory.create({ title: "Archive notes" });
        cleanup.add(() => taskFactory.delete(reviewTask.id));
        cleanup.add(() => taskFactory.delete(agendaTask.id));
        cleanup.add(() => taskFactory.delete(archiveTask.id));
        await taskFactory.update(archiveTask.id, { completed: true });
        await openDashboardFlow(page, origin);
        const card = page.getByTestId(DASHBOARD_WIDGET_HANDLES.TODO_TASKS);
        await expect(page.getByRole("button", { name: "Customize dashboard" })).toBeVisible();
        await card.getByPlaceholder("Add a task").fill("Send follow-up");
        await card.getByRole("button", { name: "Add task" }).click();
        await expect(card.getByText("Send follow-up")).toBeVisible();

        const reviewRow = card.getByRole("group", { name: "Review inbox" });
        const agendaRow = card.getByRole("group", { name: "Prepare agenda" });
        await reviewRow
          .getByRole("button", { name: "Reorder task" })
          .dragTo(agendaRow.getByRole("button", { name: "Reorder task" }));
        await expect
          .poll(async () => {
            const tasks = await taskFactory.list();
            const agenda = tasks.find((task) => task.id === agendaTask.id);
            const review = tasks.find((task) => task.id === reviewTask.id);
            return (
              agenda !== undefined && review !== undefined && agenda.position < review.position
            );
          })
          .toBe(true);

        await card.getByRole("button", { name: "Toggle Review inbox" }).click();
        await expect(card.getByText("Review inbox")).toHaveClass(/line-through/);
        await expect
          .poll(async () => {
            const tasks = await taskFactory.list();
            return tasks.find((task) => task.id === reviewTask.id)?.completed;
          })
          .toBe(true);

        const row = card.getByText("Review inbox", { exact: true }).locator("..");
        await row.getByRole("button", { name: "Edit task" }).click();
        const titleInput = card.locator("input").last();
        await expect(titleInput).toBeVisible();
        await titleInput.fill("Review the inbox");
        await titleInput.press("Enter");
        await expect(card.getByText("Review the inbox")).toBeVisible();
        const followUpRow = card.getByText("Send follow-up", { exact: true }).locator("..");
        await followUpRow.getByRole("button", { name: "Delete task" }).click();
        await expect(card.getByText("Send follow-up")).toHaveCount(0);
        await page.reload();
        await expect(
          page.getByTestId(DASHBOARD_WIDGET_HANDLES.TODO_TASKS).getByText("Review the inbox"),
        ).toBeVisible();
      },
    );
  });
});
