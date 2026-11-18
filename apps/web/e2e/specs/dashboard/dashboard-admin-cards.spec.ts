import {
  DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS,
  DASHBOARD_WIDGET_SIZES,
  DASHBOARD_WIDGET_TYPES,
} from "@repo/shared";
import { startOfWeek } from "date-fns";

import { USER_ROLE } from "~/config/userRoles";

import {
  DEADLINE_RISK_COURSES_PATH,
  dashboardWidget,
  deadlineRiskCourse,
  deadlineRiskGroup,
  deadlineRiskGroupsPageFor,
  deadlineRiskGroupsPath,
  deadlineRiskPage,
  deadlineRiskPageFor,
  overdueDeadlineRiskCourses,
  overdueDeadlineRiskGroups,
} from "../../data/dashboard/dashboard.data";
import {
  DASHBOARD_DEADLINE_RISK_HANDLES,
  DASHBOARD_EDIT_HANDLES,
  DASHBOARD_TODO_HANDLES,
  DASHBOARD_WIDGET_HANDLES,
} from "../../data/dashboard/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { dragByPointerFlow } from "../../flows/dashboard/drag-by-pointer.flow";
import {
  createDashboardResponseGate,
  mockDashboardFlow,
} from "../../flows/dashboard/mock-dashboard.flow";
import { openDashboardFlow } from "../../flows/dashboard/open-dashboard.flow";
import {
  expandDeadlineRiskGroupFlow,
  openDeadlineRiskCourseFlow,
} from "../../flows/dashboard/open-deadline-risk-course.flow";
import { scrollDashboardListToEndFlow } from "../../flows/dashboard/scroll-dashboard-list.flow";
import { setDashboardWidgets } from "../../utils/dashboard-settings";

const COURSE_ONE = "66666666-6666-4666-8666-666666666666";
const COURSE_TWO = "66666666-6666-4666-8666-666666666667";
const COURSE_THREE = "66666666-6666-4666-8666-666666666668";
const SALES = deadlineRiskGroup("77777777-7777-4777-8777-777777777777", "Sales", {
  id: "88888888-8888-4888-8888-888888888888",
  name: "Alex Learner",
});
const SUPPORT = deadlineRiskGroup(
  "77777777-7777-4777-8777-777777777778",
  "Support",
  { id: "88888888-8888-4888-8888-888888888889", name: "Morgan Learner" },
  "dueSoon",
);
// One full page of courses plus COURSE_THREE on the second page.
const DEADLINE_RISK_COURSES = [
  deadlineRiskCourse(COURSE_ONE, "Overdue course"),
  deadlineRiskCourse(COURSE_TWO, "Due soon course", "dueSoon"),
  ...overdueDeadlineRiskCourses(18),
  deadlineRiskCourse(COURSE_THREE, "Another overdue course"),
];
// Overdue "Sales" matches fill one page and spill one group onto the next.
const SALES_REGIONS = overdueDeadlineRiskGroups("Sales region", 20);
const LAST_SALES_REGION = SALES_REGIONS[SALES_REGIONS.length - 1];
const deadlineRisksWidget = dashboardWidget(
  DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS,
  DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
);
const trainingCompletionWidget = dashboardWidget(
  DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION,
  DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
);

test.describe("admin dashboard utility cards", () => {
  test("deadline risks sort, load more courses and groups, filter the dialog and keep it contained", async ({
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const state = await mockDashboardFlow(page, {
        widgets: [deadlineRisksWidget],
        language: "pl",
        responses: [
          {
            path: DEADLINE_RISK_COURSES_PATH,
            respond: ({ url }) =>
              url.searchParams.get("urgencyOrder") ===
              DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS.LEAST_URGENT
                ? deadlineRiskPage(
                    [deadlineRiskCourse(COURSE_TWO, "Due soon course", "dueSoon")],
                    1,
                    1,
                  )
                : deadlineRiskPageFor(DEADLINE_RISK_COURSES, url),
          },
          {
            path: deadlineRiskGroupsPath(COURSE_ONE),
            respond: ({ url }) =>
              deadlineRiskGroupsPageFor([SALES, SUPPORT, ...SALES_REGIONS], url),
          },
        ],
      });

      await openDashboardFlow(page);
      const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_DEADLINE_RISKS);
      await expect(
        widget.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.course(COURSE_ONE)),
      ).toBeVisible();
      await scrollDashboardListToEndFlow(
        widget.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.COURSE_LIST),
      );
      await expect(
        widget.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.course(COURSE_THREE)),
      ).toBeVisible();

      await openDeadlineRiskCourseFlow(page, COURSE_ONE);
      const dialog = page.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.DIALOG);
      await dialog.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.STATUS_FILTER).click();
      await page.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.statusOption("overdue")).click();
      await dialog.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.SEARCH).fill("Sales");
      await dialog.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.groupSort("studentCount")).click();
      await expect
        .poll(() =>
          state
            .requestsTo(deadlineRiskGroupsPath(COURSE_ONE))
            .some(
              (url) =>
                url.searchParams.get("urgency") === "overdue" &&
                url.searchParams.get("search") === "Sales" &&
                url.searchParams.get("sortBy") === "studentCount" &&
                url.searchParams.get("sortDirection") === "desc" &&
                url.searchParams.get("page") === "1" &&
                url.searchParams.get("perPage") === "20",
            ),
        )
        .toBe(true);

      await expandDeadlineRiskGroupFlow(page, SALES.id);
      await expect(
        dialog.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.learner(SALES.students[0].id)),
      ).toBeVisible();
      await dialog.click({ position: { x: 20, y: 20 } });
      await expect(dialog).toBeVisible();
      await expect(dialog).not.toHaveCSS("overflow-x", "visible");

      await scrollDashboardListToEndFlow(
        dialog.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.GROUP_LIST),
      );
      await expandDeadlineRiskGroupFlow(page, LAST_SALES_REGION.id);
      await expect(
        dialog.getByTestId(
          DASHBOARD_DEADLINE_RISK_HANDLES.learner(LAST_SALES_REGION.students[0].id),
        ),
      ).toBeVisible();
      await expect(
        dialog.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.group(SUPPORT.id)),
      ).toHaveCount(0);
      const nextGroupsPage = state
        .requestsTo(deadlineRiskGroupsPath(COURSE_ONE))
        .find((url) => url.searchParams.get("page") === "2");
      expect(
        Object.fromEntries(
          ["language", "perPage", "urgency", "search", "sortBy", "sortDirection"].map((key) => [
            key,
            nextGroupsPage?.searchParams.get(key),
          ]),
        ),
      ).toEqual({
        language: "pl",
        perPage: "20",
        urgency: "overdue",
        search: "Sales",
        sortBy: "studentCount",
        sortDirection: "desc",
      });

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await widget.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.SORT_TRIGGER).click();
      await page
        .getByTestId(
          DASHBOARD_DEADLINE_RISK_HANDLES.sortOption(
            DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS.LEAST_URGENT,
          ),
        )
        .click();
      await expect(
        widget.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.course(COURSE_TWO)),
      ).toBeVisible();
      await expect(
        widget.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.course(COURSE_ONE)),
      ).toHaveCount(0);
      const languages = state
        .requestsTo(DEADLINE_RISK_COURSES_PATH)
        .map((url) => url.searchParams.get("language"));
      expect(languages.length).toBeGreaterThan(0);
      expect(languages.every((language) => language === "pl")).toBe(true);
      expect(state.unexpectedRequests).toEqual([]);
    });
  });

  test("keeps the same-course rows visible during sorting and expands learners without bubbling out of the dialog", async ({
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const sortedGroups = createDashboardResponseGate();
      const initial = deadlineRiskGroup("group-1", "Initial Sales", {
        id: "learner-1",
        name: "Initial Learner",
      });
      const sorted = deadlineRiskGroup("group-2", "Sorted Sales", {
        id: "learner-2",
        name: "Sorted Learner",
      });
      const state = await mockDashboardFlow(page, {
        widgets: [deadlineRisksWidget],
        responses: [
          {
            path: DEADLINE_RISK_COURSES_PATH,
            body: deadlineRiskPage([deadlineRiskCourse(COURSE_ONE, "Security onboarding")], 1, 1),
          },
          {
            path: deadlineRiskGroupsPath(COURSE_ONE),
            respond: async ({ url }) => {
              if (url.searchParams.get("sortBy") !== "name")
                return deadlineRiskPage([initial], 1, 1);
              await sortedGroups.released;
              return deadlineRiskPage([sorted], 1, 1);
            },
          },
        ],
      });

      await openDashboardFlow(page);
      await openDeadlineRiskCourseFlow(page, COURSE_ONE);
      const dialog = page.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.DIALOG);
      await expandDeadlineRiskGroupFlow(page, initial.id);
      await expect(
        dialog.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.learner("learner-1")),
      ).toBeVisible();

      await dialog.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.groupSort("name")).click();
      await expect(
        dialog.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.group(initial.id)),
      ).toBeVisible();
      sortedGroups.release();
      await expect(
        dialog.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.group(sorted.id)),
      ).toBeVisible();
      await expect(
        dialog.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.group(initial.id)),
      ).toHaveCount(0);

      await dialog.click({ position: { x: 20, y: 20 } });
      await expect(dialog).toBeVisible();
      expect(state.unexpectedRequests).toEqual([]);
    });
  });

  test("does not show groups from the previous course after switching courses", async ({
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const courseTwoGroups = createDashboardResponseGate();
      const oneGroup = deadlineRiskGroup("one-group", "One group", {
        id: "one",
        name: "One learner",
      });
      const twoGroup = deadlineRiskGroup("two-group", "Two group", {
        id: "two",
        name: "Two learner",
      });
      const state = await mockDashboardFlow(page, {
        widgets: [deadlineRisksWidget],
        responses: [
          {
            path: DEADLINE_RISK_COURSES_PATH,
            body: deadlineRiskPage(
              [
                deadlineRiskCourse(COURSE_ONE, "Course one"),
                deadlineRiskCourse(COURSE_TWO, "Course two", "dueSoon"),
              ],
              1,
              2,
            ),
          },
          { path: deadlineRiskGroupsPath(COURSE_ONE), body: deadlineRiskPage([oneGroup], 1, 1) },
          {
            path: deadlineRiskGroupsPath(COURSE_TWO),
            respond: async () => {
              await courseTwoGroups.released;
              return deadlineRiskPage([twoGroup], 1, 1);
            },
          },
        ],
      });

      await openDashboardFlow(page);
      await openDeadlineRiskCourseFlow(page, COURSE_ONE);
      const dialog = page.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.DIALOG);
      await expect(
        dialog.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.group(oneGroup.id)),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await openDeadlineRiskCourseFlow(page, COURSE_TWO);
      await expect(dialog).toBeVisible();
      // The dialog has switched to course two once its groups are requested.
      await expect.poll(() => state.requestsTo(deadlineRiskGroupsPath(COURSE_TWO)).length).toBe(1);
      await expect(
        dialog.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.group(oneGroup.id)),
      ).toHaveCount(0);
      courseTwoGroups.release();
      await expect(
        dialog.getByTestId(DASHBOARD_DEADLINE_RISK_HANDLES.group(twoGroup.id)),
      ).toBeVisible();
      expect(state.unexpectedRequests).toEqual([]);
    });
  });

  test("renders training completion totals in the chart", async ({ withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const state = await mockDashboardFlow(page, {
        widgets: [trainingCompletionWidget],
        responses: [
          {
            path: "/api/statistics/dashboard/training-completion",
            body: {
              data: { completed: 4, inProgress: 2, notStarted: 1, total: 7, percentage: 57 },
            },
          },
        ],
      });

      await openDashboardFlow(page);
      const chart = page
        .getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION)
        .getByTestId(DASHBOARD_WIDGET_HANDLES.CHART);
      await expect(chart.getByTestId(DASHBOARD_WIDGET_HANDLES.CHART_PERCENTAGE)).toHaveText("57%");
      await expect(chart.getByTestId(DASHBOARD_WIDGET_HANDLES.CHART_COMPLETED_OF_TOTAL)).toHaveText(
        "4/7",
      );
      // Screen readers get the totals from the chart's image label; recharts 2 shows no pie tooltip on keyboard focus.
      await expect(chart).toHaveRole("img");
      await expect(chart).toHaveAccessibleName(/4 of 7.*57/);
      expect(state.unexpectedRequests).toEqual([]);
    });
  });

  test("shows the training completion empty state", async ({ withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const state = await mockDashboardFlow(page, { widgets: [trainingCompletionWidget] });

      await openDashboardFlow(page);
      const card = page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION);
      await expect(card.getByTestId(DASHBOARD_WIDGET_HANDLES.EMPTY_STATE)).toBeVisible();
      expect(state.unexpectedRequests).toEqual([]);
    });
  });

  test("shows the training completion error state with a retry", async ({ withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const state = await mockDashboardFlow(page, {
        widgets: [trainingCompletionWidget],
        responses: [
          {
            path: "/api/statistics/dashboard/training-completion",
            status: 500,
            body: { message: "unavailable" },
          },
        ],
      });

      await openDashboardFlow(page);
      const card = page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION);
      await expect(card.getByTestId(DASHBOARD_WIDGET_HANDLES.ERROR_STATE)).toBeVisible();
      await expect(card.getByTestId(DASHBOARD_WIDGET_HANDLES.RETRY)).toBeVisible();
      expect(state.unexpectedRequests).toEqual([]);
    });
  });

  test("renders calendar events on mobile, loads the next month, and handles an empty upcoming list", async ({
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const state = await mockDashboardFlow(page, {
        widgets: [
          dashboardWidget(
            DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
            DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO,
          ),
        ],
        responses: [
          {
            path: "/api/calendar/dashboard/events",
            respond: ({ url }) => ({
              data:
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
            }),
          },
        ],
      });

      await page.setViewportSize({ width: 390, height: 844 });
      await openDashboardFlow(page);
      const card = page.getByTestId(DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR);
      await expect(card.getByRole("grid")).toBeVisible();
      await expect(card).toContainText("Planning session");
      await expect(card.getByTestId(DASHBOARD_WIDGET_HANDLES.EMPTY_STATE)).toBeVisible();

      // The widget requests whole weeks (Monday first) around the month; Date rolls December into January.
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const nextMonthStart = startOfWeek(nextMonth, { weekStartsOn: 1 }).toISOString();
      // The caption renders the month dropdown before the year dropdown; option values are numbers.
      const [monthSelect, yearSelect] = [
        card.getByRole("combobox").first(),
        card.getByRole("combobox").nth(1),
      ];
      await yearSelect.selectOption(String(nextMonth.getFullYear()));
      await monthSelect.selectOption(String(nextMonth.getMonth()));
      await expect
        .poll(() =>
          state
            .requestsTo("/api/calendar/dashboard/events")
            .map((url) => url.searchParams.get("start")),
        )
        .toContain(nextMonthStart);
      expect(state.unexpectedRequests).toEqual([]);
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
          { type: DASHBOARD_WIDGET_TYPES.TODO_LIST, size: DASHBOARD_WIDGET_SIZES.THREE_BY_TWO },
        ]);
        const reviewTask = await taskFactory.create({ title: "Review inbox" });
        cleanup.add(() => taskFactory.delete(reviewTask.id));
        const agendaTask = await taskFactory.create({ title: "Prepare agenda" });
        cleanup.add(() => taskFactory.delete(agendaTask.id));
        const archiveTask = await taskFactory.create({ title: "Archive notes" });
        cleanup.add(() => taskFactory.delete(archiveTask.id));
        await taskFactory.update(archiveTask.id, { completed: true });

        await openDashboardFlow(page, origin);
        const card = page.getByTestId(DASHBOARD_WIDGET_HANDLES.TODO_TASKS);
        const tasks = card.getByTestId(DASHBOARD_TODO_HANDLES.TASK);
        await expect(tasks.filter({ hasText: "Archive notes" })).toBeVisible();
        await expect(
          page.getByTestId(DASHBOARD_EDIT_HANDLES.dragHandle(DASHBOARD_WIDGET_TYPES.TODO_LIST)),
        ).toHaveCount(0);
        await dragByPointerFlow(
          page,
          tasks
            .filter({ hasText: "Review inbox" })
            .getByTestId(DASHBOARD_TODO_HANDLES.TASK_REORDER),
          tasks
            .filter({ hasText: "Prepare agenda" })
            .getByTestId(DASHBOARD_TODO_HANDLES.TASK_REORDER),
        );
        await expect
          .poll(async () => {
            const storedTasks = await taskFactory.list();
            const agenda = storedTasks.find((task) => task.id === agendaTask.id);
            const review = storedTasks.find((task) => task.id === reviewTask.id);
            return (
              agenda !== undefined && review !== undefined && agenda.position < review.position
            );
          })
          .toBe(true);

        await card.getByTestId(DASHBOARD_TODO_HANDLES.NEW_TASK_INPUT).fill("Send follow-up");
        await card.getByTestId(DASHBOARD_TODO_HANDLES.ADD_TASK).click();
        await expect(tasks.filter({ hasText: "Send follow-up" })).toBeVisible();
        await expect
          .poll(async () =>
            (await taskFactory.list()).some((task) => task.title === "Send follow-up"),
          )
          .toBe(true);
        const followUpTask = (await taskFactory.list()).find(
          (task) => task.title === "Send follow-up",
        );
        if (!followUpTask) throw new Error("The created to-do task was not saved");
        cleanup.add(() => taskFactory.delete(followUpTask.id));
        // Workaround for #2275: a new task keeps its optimistic id until a refetch, so reload first.
        await page.reload();
        await expect(tasks.filter({ hasText: "Send follow-up" })).toBeVisible();

        await tasks
          .filter({ hasText: "Review inbox" })
          .getByTestId(DASHBOARD_TODO_HANDLES.TASK_TOGGLE)
          .click();
        await expect(
          tasks.filter({ hasText: "Review inbox" }).getByTestId(DASHBOARD_TODO_HANDLES.TASK_TITLE),
        ).toHaveClass(/line-through/);
        // Let the completion save before editing the title, so the two updates do not race.
        await expect
          .poll(async () => (await taskFactory.list()).find((task) => task.id === reviewTask.id))
          .toMatchObject({ completed: true });

        await tasks
          .filter({ hasText: "Review inbox" })
          .getByTestId(DASHBOARD_TODO_HANDLES.TASK_EDIT)
          .click();
        const titleInput = card.getByTestId(DASHBOARD_TODO_HANDLES.TASK_TITLE_INPUT);
        await titleInput.fill("Review the inbox");
        await titleInput.press("Enter");
        await expect(tasks.filter({ hasText: "Review the inbox" })).toBeVisible();

        await tasks
          .filter({ hasText: "Send follow-up" })
          .getByTestId(DASHBOARD_TODO_HANDLES.TASK_DELETE)
          .click();
        await expect(tasks.filter({ hasText: "Send follow-up" })).toHaveCount(0);

        await page.reload();
        await expect(tasks.filter({ hasText: "Review the inbox" })).toBeVisible();
        await expect(tasks.filter({ hasText: "Archive notes" })).toBeVisible();
        await expect(tasks.filter({ hasText: "Send follow-up" })).toHaveCount(0);
        await expect
          .poll(async () => (await taskFactory.list()).find((task) => task.id === reviewTask.id))
          .toMatchObject({ title: "Review the inbox", completed: true });
      },
    );
  });
});
