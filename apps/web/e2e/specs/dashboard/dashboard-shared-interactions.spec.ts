import { DASHBOARD_WIDGET_TYPES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { AI_MENTOR_PRACTICE_HANDLES } from "../../data/ai-mentor-practice/handles";
import { DASHBOARD_WIDGET_HANDLES } from "../../data/dashboard/handles";
import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { expect, test } from "../../fixtures/test.fixture";

import type { Page, Route } from "@playwright/test";

type DashboardWidget = {
  type: string;
  size: "1x1" | "2x1" | "1x2" | "2x2" | "3x2" | "4x2" | "4x3";
  visible: boolean;
};

type DashboardCatalogEntry = {
  type: string;
  allowedSizes: DashboardWidget["size"][];
  defaultSize: DashboardWidget["size"];
};

type DashboardMockOptions = {
  widgets: DashboardWidget[];
  catalog?: DashboardCatalogEntry[];
  onRequest?: (route: Route, url: URL) => Promise<boolean>;
};

const CERTIFICATE_ID_PREFIX = "88888888-8888-4888-8888-888888888";
const DEADLINE_COURSE_ONE = "66666666-6666-4666-8666-666666666666";
const DEADLINE_COURSE_TWO = "66666666-6666-4666-8666-666666666667";
const DEADLINE_COURSE_THREE = "66666666-6666-4666-8666-666666666668";

const fulfillJson = async (route: Route, body: unknown) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: body }),
  });
};

// Paginated endpoints expose their pagination object at the top level.
const fulfillRawJson = async (route: Route, body: unknown) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
};

const defaultCatalog = (widgets: DashboardWidget[]): DashboardCatalogEntry[] =>
  widgets.map((widget) => ({
    type: widget.type,
    allowedSizes: [widget.size],
    defaultSize: widget.size,
  }));

const installDashboardMocks = async (page: Page, options: DashboardMockOptions) => {
  let revision = 0;
  let widgets = options.widgets.map((widget) => ({ ...widget }));
  const updates: DashboardWidget[][] = [];
  const catalog = options.catalog ?? defaultCatalog(options.widgets);

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (request.method() === "GET" && path === "/api/settings") {
      await fulfillJson(route, {
        language: "en",
        isMFAEnabled: false,
        MFASecret: null,
        dashboard: { widgets: [] },
      });
      return;
    }

    if (request.method() === "GET" && path === "/api/settings/dashboard") {
      await fulfillJson(route, {
        layout: { schemaVersion: 2, revision, widgets },
        catalog,
      });
      return;
    }

    if (request.method() === "PUT" && path === "/api/settings/dashboard") {
      const payload = request.postDataJSON() as { widgets: DashboardWidget[] };
      widgets = payload.widgets.map((widget) => ({ ...widget }));
      updates.push(widgets);
      revision += 1;
      await fulfillJson(route, {
        layout: { schemaVersion: 2, revision, widgets },
        catalog,
      });
      return;
    }

    if (options.onRequest && (await options.onRequest(route, url))) return;

    await route.continue();
  });

  return {
    updates,
    getWidgets: () => widgets,
  };
};

const dashboardWidget = (type: string, size: DashboardWidget["size"] = "2x1") => ({
  type,
  size,
  visible: true,
});

test.describe("dashboard layout persistence", () => {
  test("clamps persisted wide spans on mobile and restores them at md", async ({
    withReadonlyPage,
  }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      const state = await installDashboardMocks(page, {
        widgets: [
          dashboardWidget(DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE, "3x2"),
          dashboardWidget(DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR, "4x2"),
        ],
        catalog: [
          {
            type: DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE,
            allowedSizes: ["2x2", "3x2"],
            defaultSize: "3x2",
          },
          {
            type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
            allowedSizes: ["4x2", "4x3"],
            defaultSize: "4x2",
          },
        ],
        onRequest: async (route, url) => {
          if (route.request().method() !== "GET") return false;
          if (url.pathname === "/api/ai/practice/today") {
            await fulfillJson(route, null);
            return true;
          }
          if (url.pathname === "/api/calendar/dashboard/events") {
            await fulfillJson(route, []);
            return true;
          }
          return false;
        },
      });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/dashboard");

      const aiWidget = page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET);
      const calendarWidget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR);
      const aiHitbox = page
        .locator('[data-dashboard-widget-hitbox="true"]')
        .filter({ has: aiWidget });
      const calendarHitbox = page
        .locator('[data-dashboard-widget-hitbox="true"]')
        .filter({ has: calendarWidget });

      await expect(aiHitbox).toHaveClass(/col-span-2/);
      await expect(calendarHitbox).toHaveClass(/col-span-2/);
      await expect
        .poll(async () => (await aiHitbox.boundingBox())?.width ?? 0)
        .toBeGreaterThan(340);
      await expect
        .poll(async () => (await calendarHitbox.boundingBox())?.width ?? 0)
        .toBeGreaterThan(340);
      expect(state.getWidgets().map((widget) => widget.size)).toEqual(["3x2", "4x2"]);

      await page.setViewportSize({ width: 1024, height: 900 });
      await expect(aiHitbox).toHaveClass(/md:col-span-3/);
      await expect(calendarHitbox).toHaveClass(/md:col-span-4/);
      expect(state.getWidgets().map((widget) => widget.size)).toEqual(["3x2", "4x2"]);
    });
  });

  test("autosaves visibility, resize, and reorder without a global save", async ({
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const state = await installDashboardMocks(page, {
        widgets: [
          dashboardWidget(DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR, "4x2"),
          dashboardWidget(DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION, "1x1"),
        ],
        catalog: [
          {
            type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
            allowedSizes: ["4x2", "4x3"],
            defaultSize: "4x2",
          },
          {
            type: DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION,
            allowedSizes: ["1x1", "2x2"],
            defaultSize: "2x2",
          },
        ],
      });

      await page.goto("/dashboard");
      await page.getByRole("button", { name: "Customize dashboard" }).click();
      const trainingWidget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION);
      await expect(trainingWidget).toBeVisible();

      const sizeButton = page.getByRole("button", { name: "Change size of Training completion" });
      await sizeButton.click();
      await page.getByRole("radio", { name: "2x2 — Large" }).click();
      await expect
        .poll(
          () =>
            state
              .getWidgets()
              .find((widget) => widget.type === DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION)?.size,
        )
        .toBe("2x2");

      const calendarDragHandle = page.getByLabel("Move Event calendar");
      const trainingDragHandle = page.getByLabel("Move Training completion");
      await expect(calendarDragHandle).toHaveCount(1);
      await expect(trainingDragHandle).toHaveCount(1);
      await calendarDragHandle.focus();
      await calendarDragHandle.press("Space");
      await calendarDragHandle.press("ArrowDown");
      await calendarDragHandle.press("Space");
      await expect.poll(() => state.updates.length).toBeGreaterThanOrEqual(2);

      const firstVisibleWidget = state.getWidgets().find((widget) => widget.visible);
      expect(firstVisibleWidget?.type).toBe(DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION);

      await page.getByRole("button", { name: "Widgets" }).click();
      await expect(page.getByRole("dialog").getByText("Beta", { exact: true })).toBeVisible();
      const calendarToggle = page.getByRole("switch", { name: "Toggle Event calendar" });
      await expect(calendarToggle).toBeChecked();
      await expect(calendarToggle).toBeDisabled();
      const trainingToggle = page.getByRole("switch", { name: "Toggle Training completion" });
      await expect(trainingToggle).toBeChecked();
      await trainingToggle.click();
      await expect.poll(() => state.updates.length).toBeGreaterThan(2);
      await expect
        .poll(
          () =>
            state
              .getWidgets()
              .find((widget) => widget.type === DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION)
              ?.visible,
        )
        .toBe(false);
      await expect(page.getByRole("button", { name: /^Save$/i })).toHaveCount(0);
      await page.getByRole("button", { name: "Close" }).last().click();

      await page.reload();
      await expect(page.getByTestId(DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR)).toBeVisible();
      await expect(
        page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION),
      ).toHaveCount(0);
      const persistedCalendarWidget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR);
      const persistedHitbox = page
        .locator('[data-dashboard-widget-hitbox="true"]')
        .filter({ has: persistedCalendarWidget });
      await expect(persistedHitbox).toHaveAttribute("style", /grid-row: span 2/);
    });
  });
});

test.describe("dashboard navigation and role catalog", () => {
  test("removes Calendar from the sidebar while keeping the card CTA route", async ({
    withReadonlyPage,
  }) => {
    await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
      await installDashboardMocks(page, {
        widgets: [dashboardWidget(DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR, "4x2")],
        catalog: [
          {
            type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
            allowedSizes: ["4x2", "4x3"],
            defaultSize: "4x2",
          },
        ],
        onRequest: async (route, url) => {
          if (
            route.request().method() !== "GET" ||
            url.pathname !== "/api/calendar/dashboard/events"
          )
            return false;
          await fulfillJson(route, []);
          return true;
        },
      });

      await page.goto("/dashboard");
      await expect(page.getByTestId(NAVIGATION_HANDLES.CALENDAR_LINK)).toHaveCount(0);

      const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR);
      await expect(widget).toBeVisible();
      await expect(widget.locator("table tbody tr")).toHaveCount(6);
      const hitbox = page.locator('[data-dashboard-widget-hitbox="true"]').filter({ has: widget });
      await expect(hitbox).toHaveAttribute("style", /grid-row: span 2/);
      await widget.hover();
      await expect(widget.getByRole("link", { name: "Calendar" })).toBeVisible();
      await widget.getByRole("link", { name: "Calendar" }).click();
      await expect(page).toHaveURL(/\/calendar$/);
    });
  });

  test("keeps learner widgets opt-in for admins while exposing eligible catalog entries", async ({
    withReadonlyPage,
  }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      await installDashboardMocks(page, {
        widgets: [
          dashboardWidget(DASHBOARD_WIDGET_TYPES.TODO_LIST, "2x2"),
          dashboardWidget(DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS, "2x1"),
        ],
        catalog: [
          {
            type: DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS,
            allowedSizes: ["2x1", "2x2", "3x2"],
            defaultSize: "2x1",
          },
          {
            type: DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING,
            allowedSizes: ["2x1", "2x2", "3x2"],
            defaultSize: "2x1",
          },
          {
            type: DASHBOARD_WIDGET_TYPES.CERTIFICATES,
            allowedSizes: ["2x1", "2x2"],
            defaultSize: "2x2",
          },
          {
            type: DASHBOARD_WIDGET_TYPES.TODO_LIST,
            allowedSizes: ["2x2"],
            defaultSize: "2x2",
          },
        ],
        onRequest: async (route, url) => {
          if (route.request().method() !== "GET" || url.pathname !== "/api/todo-tasks") {
            return false;
          }
          await fulfillJson(route, []);
          return true;
        },
      });

      await page.goto("/dashboard");
      await expect(
        page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CONTINUE_LEARNING),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Customize dashboard" }).click();
      await page.getByRole("button", { name: "Widgets" }).click();

      await expect(page.getByRole("switch", { name: "Toggle Continue learning" })).toBeVisible();
      await expect(
        page.getByRole("switch", { name: "Toggle Continue learning" }),
      ).not.toBeChecked();
      await expect(page.getByRole("switch", { name: "Toggle Certificates" })).not.toBeChecked();
      await expect(page.getByRole("switch", { name: "Toggle To-do list" })).toBeChecked();
    });
  });
});

test("admin can drill into deadline courses, sort urgency, load more, and keep the dialog contained", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    let groupPage = 1;
    await installDashboardMocks(page, {
      widgets: [dashboardWidget(DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS, "2x1")],
      catalog: [
        {
          type: DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS,
          allowedSizes: ["2x1", "2x2", "3x2"],
          defaultSize: "2x1",
        },
      ],
      onRequest: async (route, url) => {
        if (route.request().method() !== "GET") return false;
        if (url.pathname === "/api/statistics/dashboard/deadline-risks/courses") {
          const leastUrgent = url.searchParams.get("urgencyOrder") === "leastUrgent";
          const pageNumber = Number(url.searchParams.get("page") ?? "1");
          const courses = leastUrgent
            ? [
                {
                  id: DEADLINE_COURSE_TWO,
                  title: "Due soon course",
                  overdueCount: 0,
                  dueSoonCount: 2,
                  nearestDueDate: "2026-08-30T00:00:00.000Z",
                  urgency: "dueSoon",
                },
              ]
            : pageNumber === 1
              ? [
                  {
                    id: DEADLINE_COURSE_ONE,
                    title: "Overdue course",
                    overdueCount: 2,
                    dueSoonCount: 0,
                    nearestDueDate: "2026-08-01T00:00:00.000Z",
                    urgency: "overdue",
                  },
                  {
                    id: DEADLINE_COURSE_TWO,
                    title: "Due soon course",
                    overdueCount: 0,
                    dueSoonCount: 2,
                    nearestDueDate: "2026-08-30T00:00:00.000Z",
                    urgency: "dueSoon",
                  },
                ]
              : [
                  {
                    id: DEADLINE_COURSE_THREE,
                    title: "Another overdue course",
                    overdueCount: 1,
                    dueSoonCount: 0,
                    nearestDueDate: "2026-08-05T00:00:00.000Z",
                    urgency: "overdue",
                  },
                ];
          await fulfillRawJson(route, {
            data: courses,
            pagination: { totalItems: leastUrgent ? 1 : 3, page: pageNumber, perPage: 2 },
          });
          return true;
        }
        if (url.pathname.endsWith("/groups")) {
          groupPage = Number(url.searchParams.get("page") ?? "1");
          const groups =
            groupPage === 1
              ? [
                  {
                    id: "77777777-7777-4777-8777-777777777777",
                    name: "Sales cohort",
                    dueDate: "2026-08-01T00:00:00.000Z",
                    urgency: "overdue",
                    studentCount: 1,
                    students: [
                      {
                        id: "88888888-8888-4888-8888-888888888888",
                        name: "Taylor Student",
                      },
                    ],
                  },
                ]
              : [
                  {
                    id: "77777777-7777-4777-8777-777777777778",
                    name: "Support cohort",
                    dueDate: "2026-08-05T00:00:00.000Z",
                    urgency: "overdue",
                    studentCount: 1,
                    students: [
                      {
                        id: "88888888-8888-4888-8888-888888888889",
                        name: "Morgan Student",
                      },
                    ],
                  },
                ];
          await fulfillRawJson(route, {
            data: groups,
            pagination: { totalItems: 21, page: groupPage, perPage: 20 },
          });
          return true;
        }
        return false;
      },
    });

    await page.goto("/dashboard");
    const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_DEADLINE_RISKS);
    await expect(widget.getByText("Overdue course")).toBeVisible();

    const coursesScrollContainer = widget.locator("div.h-full.min-h-0.overflow-y-auto");
    await coursesScrollContainer.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(widget.getByText("Another overdue course")).toBeVisible();

    await widget.getByRole("button", { name: /sort/i }).click();
    await page.getByRole("menuitemradio", { name: "Least urgent first" }).click();
    await expect(widget.getByText("Due soon course")).toBeVisible();
    await expect(widget.getByText("Overdue course")).toHaveCount(0);

    await widget.getByRole("button", { name: /Due soon course/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByText("Sales cohort").click();
    await expect(dialog).toContainText("Taylor Student");
    await dialog.click({ position: { x: 20, y: 20 } });
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toHaveCSS("overflow-x", "visible");

    const groupsScrollContainer = dialog.locator("div.min-h-0.flex-1.overflow-y-auto");
    await groupsScrollContainer.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(dialog.getByText("Support cohort")).toBeVisible();
    await dialog.getByText("Support cohort").click();
    await expect(dialog).toContainText("Morgan Student");
    expect(groupPage).toBe(2);
  });
});

test("student certificate tile scroll-loads certificates and opens a preview", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
    const certificates = Array.from({ length: 10 }, (_, index) => ({
      id: `${CERTIFICATE_ID_PREFIX}${index}`,
      userId: "88888888-8888-4888-8888-888888888888",
      courseId: `99999999-9999-4999-8999-99999999999${index}`,
      courseTitle: `Completed course ${index + 1}`,
      completionDate: "2026-07-20T00:00:00.000Z",
      fullName: "Taylor Student",
      certificateSignatureUrl: null,
      certificateFontColor: null,
      issuedAt: "2026-07-20T00:00:00.000Z",
      expiresAt: null,
      createdAt: "2026-07-20T00:00:00.000Z",
    }));

    await installDashboardMocks(page, {
      widgets: [dashboardWidget(DASHBOARD_WIDGET_TYPES.CERTIFICATES, "2x2")],
      catalog: [
        {
          type: DASHBOARD_WIDGET_TYPES.CERTIFICATES,
          allowedSizes: ["2x1", "2x2"],
          defaultSize: "2x2",
        },
      ],
      onRequest: async (route, url) => {
        if (route.request().method() !== "GET" || url.pathname !== "/api/certificates/dashboard")
          return false;
        const pageNumber = Number(url.searchParams.get("page") ?? "1");
        await fulfillRawJson(route, {
          data:
            pageNumber === 1
              ? certificates
              : [
                  {
                    ...certificates[0],
                    id: `${CERTIFICATE_ID_PREFIX}10`,
                    courseTitle: "Completed course 11",
                  },
                ],
          pagination: { totalItems: 11, page: pageNumber, perPage: 10 },
        });
        return true;
      },
    });

    await page.goto("/dashboard");
    const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CERTIFICATES);
    await expect(widget.getByText("Completed course 1", { exact: true })).toBeVisible();
    const scrollContainer = widget.locator("div.h-full.min-h-0.space-y-2.overflow-y-auto");
    await scrollContainer.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(widget.getByText("Completed course 11")).toBeVisible();
    await widget.getByText("Completed course 1", { exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText("Taylor Student");
  });
});

test("student can create, complete, edit, delete, reorder, and reload todo tasks", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    const tasks = [
      { id: "todo-1", title: "Review inbox", completed: false, position: 0 },
      { id: "todo-2", title: "Prepare agenda", completed: false, position: 1 },
      { id: "todo-3", title: "Archive notes", completed: true, position: 2 },
    ];
    let nextId = 4;
    const reorderRequests: { activeTaskIds: string[]; completedTaskIds: string[] }[] = [];
    await installDashboardMocks(page, {
      widgets: [dashboardWidget(DASHBOARD_WIDGET_TYPES.TODO_LIST, "2x2")],
      catalog: [
        { type: DASHBOARD_WIDGET_TYPES.TODO_LIST, allowedSizes: ["2x2"], defaultSize: "2x2" },
      ],
      onRequest: async (route, url) => {
        const request = route.request();
        const index = tasks.findIndex((task) => url.pathname.endsWith(`/${task.id}`));
        if (request.method() === "GET" && url.pathname === "/api/todo-tasks") {
          await fulfillJson(route, tasks);
          return true;
        }
        if (request.method() === "POST" && url.pathname === "/api/todo-tasks") {
          const payload = request.postDataJSON() as { title: string };
          tasks.push({
            id: `todo-${nextId++}`,
            title: payload.title,
            completed: false,
            position: tasks.length,
          });
          await fulfillJson(route, tasks.at(-1));
          return true;
        }
        if (request.method() === "PATCH" && index >= 0) {
          Object.assign(tasks[index], request.postDataJSON());
          await fulfillJson(route, tasks[index]);
          return true;
        }
        if (request.method() === "DELETE" && index >= 0) {
          tasks.splice(index, 1);
          await fulfillJson(route, null);
          return true;
        }
        if (request.method() === "PUT" && url.pathname === "/api/todo-tasks/order") {
          const payload = request.postDataJSON() as {
            activeTaskIds: string[];
            completedTaskIds: string[];
          };
          reorderRequests.push(payload);
          const orderedIds = [...payload.activeTaskIds, ...payload.completedTaskIds];
          orderedIds.forEach((id, position) => {
            const task = tasks.find((item) => item.id === id);
            if (task) task.position = position;
          });
          tasks.sort((first, second) => first.position - second.position);
          await fulfillJson(route, tasks);
          return true;
        }
        return false;
      },
    });

    await page.goto("/dashboard");
    const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.TODO_TASKS);
    await expect(widget).toBeVisible();
    await expect(page.getByLabel("Move To-do list")).toHaveCount(0);
    await widget.getByPlaceholder("Add a task").fill("Send follow-up");
    await widget.getByRole("button", { name: "Add task" }).click();
    await expect(widget.getByText("Send follow-up")).toBeVisible();

    const reviewRow = widget.getByRole("group", { name: "Review inbox" });
    const agendaRow = widget.getByRole("group", { name: "Prepare agenda" });
    await reviewRow
      .getByRole("button", { name: "Reorder task" })
      .dragTo(agendaRow.getByRole("button", { name: "Reorder task" }));
    await expect.poll(() => reorderRequests.length).toBeGreaterThan(0);
    expect(reorderRequests.at(-1)?.activeTaskIds).toEqual(["todo-2", "todo-1", "todo-4"]);

    await widget.getByRole("button", { name: "Toggle Review inbox" }).click();
    await expect(widget.getByText("Review inbox")).toHaveClass(/line-through/);

    const reviewTitleRow = widget.getByText("Review inbox", { exact: true }).locator("..");
    await reviewTitleRow.getByRole("button", { name: "Edit task" }).click();
    const titleInput = widget.locator("input").last();
    await titleInput.fill("Review the inbox");
    await titleInput.press("Enter");
    await expect(widget.getByText("Review the inbox")).toBeVisible();

    const followUpRow = widget.getByText("Send follow-up", { exact: true }).locator("..");
    await followUpRow.getByRole("button", { name: "Delete task" }).click();
    await expect(widget.getByText("Send follow-up")).toHaveCount(0);

    await page.reload();
    const persistedWidget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.TODO_TASKS);
    await expect(persistedWidget.getByText("Review the inbox")).toBeVisible();
    await expect(persistedWidget.getByText("Archive notes")).toBeVisible();
  });
});

test("student can generate an AI practice inline and continue from the card", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    const practiceId = "11111111-1111-4111-8111-111111111111";
    const threadId = "22222222-2222-4222-8222-222222222222";
    let todayRequests = 0;
    let createdScenario: unknown;

    await installDashboardMocks(page, {
      widgets: [dashboardWidget(DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE, "2x2")],
      catalog: [
        {
          type: DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE,
          allowedSizes: ["2x2", "3x2"],
          defaultSize: "3x2",
        },
      ],
      onRequest: async (route, url) => {
        const request = route.request();
        if (request.method() === "GET" && url.pathname === "/api/ai/practice/today") {
          todayRequests += 1;
          await fulfillJson(
            route,
            todayRequests < 2
              ? null
              : {
                  id: practiceId,
                  practiceDate: "2026-08-17",
                  language: "en",
                  title: "A workload conversation",
                  aiMentorName: "Maya Chen",
                  threadId,
                  threadStatus: "active",
                  taskGoal: null,
                  evaluation: null,
                  status: "ready",
                  errorCode: null,
                },
          );
          return true;
        }
        if (request.method() === "POST" && url.pathname === "/api/ai/practice") {
          createdScenario = request.postDataJSON();
          await fulfillJson(route, {
            id: practiceId,
            practiceDate: "2026-08-17",
            language: "en",
            title: null,
            aiMentorName: null,
            threadId: null,
            threadStatus: null,
            taskGoal: null,
            evaluation: null,
            status: "queued",
            errorCode: null,
          });
          return true;
        }
        if (request.method() === "GET" && url.pathname === "/api/ai/thread/messages") {
          await fulfillJson(route, [
            {
              id: "message-1",
              role: "assistant",
              content: "Let us practice that conversation.",
              userName: "Maya Chen",
            },
          ]);
          return true;
        }
        return false;
      },
    });

    await page.goto("/dashboard");
    const widget = page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET);
    await expect(widget).toBeVisible();
    await widget.getByRole("button", { name: "Start with an example" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.getByRole("menuitem").first().click();
    const scenarioInput = widget.getByRole("textbox", { name: "What would you like to practice?" });
    await expect(scenarioInput).not.toHaveValue("");
    await widget.getByRole("button", { name: "Create practice" }).click();
    await expect.poll(() => createdScenario).toMatchObject({ language: "en" });
    await expect.poll(() => todayRequests).toBeGreaterThan(1);
    await expect(widget.getByRole("link", { name: "Continue practice" })).toHaveAttribute(
      "href",
      `/ai-mentor/practice/${practiceId}`,
    );
    await expect(widget).toContainText("Let us practice that conversation.");
    await expect(widget).not.toContainText("Today's rehearsal");
    await expect(widget).not.toContainText("Your conversation is saved");
  });
});
