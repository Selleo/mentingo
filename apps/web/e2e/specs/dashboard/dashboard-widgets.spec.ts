import { DASHBOARD_WIDGET_IDS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { DASHBOARD_WIDGET_HANDLES } from "../../data/dashboard/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { mockDashboardWidget } from "../../flows/dashboard/mock-dashboard-widget.flow";

const CONTINUE_COURSE_ID = "11111111-1111-4111-8111-111111111111";
const CONTINUE_LESSON_ID = "22222222-2222-4222-8222-222222222222";
const REQUIRED_COURSE_ID = "33333333-3333-4333-8333-333333333333";
const CERTIFICATE_ID = "44444444-4444-4444-8444-444444444444";
const EVENT_ID = "55555555-5555-4555-8555-555555555555";

const studentSummary = {
  continueLearningCourses: [
    {
      courseId: CONTINUE_COURSE_ID,
      slug: "customer-onboarding",
      title: "Customer onboarding",
      thumbnailUrl: null,
      completedChapterCount: 2,
      courseChapterCount: 4,
      lesson: {
        id: CONTINUE_LESSON_ID,
        title: "Prepare the call",
      },
    },
  ],
  requiredCourses: [
    {
      courseId: REQUIRED_COURSE_ID,
      slug: "security-basics",
      title: "Security basics",
      dueDate: "2026-08-01T00:00:00.000Z",
      urgency: "overdue",
    },
  ],
  completion: {
    total: 5,
    completed: 3,
    inProgress: 1,
    notStarted: 1,
    percentage: 60,
  },
};

const dashboardEvent = {
  id: EVENT_ID,
  sourceType: "live_training" as const,
  targetId: EVENT_ID,
  title: "E2E planning session",
  startsAt: new Date().toISOString(),
  allDay: true,
};

test.describe("student dashboard widgets", () => {
  test("shows the continue learning course and progress", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
      await mockDashboardWidget(page, DASHBOARD_WIDGET_IDS.STUDENT_CONTINUE_LEARNING, [
        { path: "/api/course/dashboard-summary", body: studentSummary },
      ]);

      await page.goto("/dashboard");

      const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CONTINUE_LEARNING);
      await expect(widget).toBeVisible();
      await expect(widget.getByRole("heading", { name: "Continue learning" })).toBeVisible();
      await expect(widget.getByRole("heading", { name: "Customer onboarding" })).toBeVisible();
      await expect(widget.getByText("50%", { exact: true })).toBeVisible();
      await expect(widget.getByText("Next: Prepare the call")).toBeVisible();
    });
  });

  test("shows the student's calendar event", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
      await mockDashboardWidget(page, DASHBOARD_WIDGET_IDS.STUDENT_EVENT_CALENDAR, [
        { path: "/api/calendar/dashboard/events", body: [dashboardEvent] },
      ]);

      await page.goto("/dashboard");

      const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR);
      await expect(widget).toBeVisible();
      await expect(widget.getByRole("heading", { name: "Event calendar" })).toBeVisible();
      await expect(widget.getByText("E2E planning session")).toBeVisible();
      await expect(widget.getByText("Live training")).toBeVisible();
    });
  });

  test("shows required course urgency and due-date data", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
      await mockDashboardWidget(page, DASHBOARD_WIDGET_IDS.STUDENT_REQUIRED_COURSE, [
        { path: "/api/course/dashboard-summary", body: studentSummary },
      ]);

      await page.goto("/dashboard");

      const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_REQUIRED_COURSE);
      await expect(widget).toBeVisible();
      await expect(widget.getByRole("heading", { name: "Required courses" })).toBeVisible();
      await expect(widget.getByRole("heading", { name: "Security basics" })).toBeVisible();
      await expect(widget.getByText("Overdue", { exact: true })).toBeVisible();
      await expect(widget.getByText("1 overdue")).toBeVisible();
    });
  });

  test("shows the student's course completion totals", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
      await mockDashboardWidget(page, DASHBOARD_WIDGET_IDS.STUDENT_COURSE_COMPLETION, [
        { path: "/api/course/dashboard-summary", body: studentSummary },
      ]);

      await page.goto("/dashboard");

      const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_COURSE_COMPLETION);
      await expect(widget).toBeVisible();
      await expect(widget.getByRole("heading", { name: "Course progress" })).toBeVisible();
      await expect(widget.getByRole("img", { name: "3 of 5 completed" })).toBeVisible();
      await expect(widget.getByText("Completed", { exact: true })).toBeVisible();
      await expect(widget.getByText("In progress", { exact: true })).toBeVisible();
      await expect(widget.getByText("Not started", { exact: true })).toBeVisible();
    });
  });

  test("shows active and expiring certificates", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
      await mockDashboardWidget(page, DASHBOARD_WIDGET_IDS.STUDENT_CERTIFICATES, [
        {
          path: "/api/certificates/dashboard-summary",
          body: {
            activeCount: 3,
            expiringSoon: {
              certificateId: CERTIFICATE_ID,
              courseId: CONTINUE_COURSE_ID,
              courseSlug: "customer-onboarding",
              courseTitle: "Customer onboarding",
              expiresAt: "2026-08-20T00:00:00.000Z",
            },
          },
        },
      ]);

      await page.goto("/dashboard");

      const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CERTIFICATES);
      await expect(widget).toBeVisible();
      await expect(widget.getByRole("heading", { name: "Certificates" })).toBeVisible();
      await expect(widget.getByText("3", { exact: true })).toBeVisible();
      await expect(widget.getByText("Active certificates")).toBeVisible();
      await expect(widget.getByText("Expiring within 30 days")).toBeVisible();
      await expect(widget.getByText("Customer onboarding")).toBeVisible();
    });
  });
});

test.describe("admin dashboard widgets", () => {
  test("shows the admin event calendar event", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      await mockDashboardWidget(page, DASHBOARD_WIDGET_IDS.ADMIN_EVENT_CALENDAR, [
        { path: "/api/calendar/dashboard/events", body: [dashboardEvent] },
      ]);

      await page.goto("/dashboard");

      const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR);
      await expect(widget).toBeVisible();
      await expect(widget.getByRole("heading", { name: "Event calendar" })).toBeVisible();
      await expect(widget.getByText("E2E planning session")).toBeVisible();
      await expect(widget.getByText("Live training")).toBeVisible();
    });
  });

  test("shows training completion totals", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      await mockDashboardWidget(page, DASHBOARD_WIDGET_IDS.ADMIN_TRAINING_COMPLETION, [
        {
          path: "/api/statistics/dashboard/training-completion",
          body: {
            completed: 3,
            inProgress: 1,
            notStarted: 1,
            total: 5,
            percentage: 60,
          },
        },
      ]);

      await page.goto("/dashboard");

      const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION);
      await expect(widget).toBeVisible();
      await expect(widget.getByRole("heading", { name: "Training completion" })).toBeVisible();
      await expect(
        widget.getByRole("img", {
          name: "3 of 5 enrollments completed, 60 percent.",
        }),
      ).toBeVisible();
    });
  });

  test("shows incomplete course enrollment data", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      await mockDashboardWidget(page, DASHBOARD_WIDGET_IDS.ADMIN_INCOMPLETE_COURSES, [
        {
          path: "/api/statistics/dashboard/incomplete-courses",
          body: {
            hasEnrollments: true,
            courses: [
              {
                id: CONTINUE_COURSE_ID,
                title: "Customer onboarding",
                total: 10,
                overdue: 0,
                completed: 5,
                inProgress: 3,
                notStarted: 2,
              },
            ],
          },
        },
      ]);

      await page.goto("/dashboard");

      const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_INCOMPLETE_COURSES);
      await expect(widget).toBeVisible();
      await expect(widget.getByRole("heading", { name: "Incomplete courses" })).toBeVisible();
      await expect(widget.getByText("Customer onboarding")).toBeVisible();
      await expect(widget.getByText("10 enrollments")).toBeVisible();
      await expect(widget.getByText("5 not completed")).toBeVisible();
    });
  });

  test("shows overdue and due-soon deadline risk totals", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
      await mockDashboardWidget(page, DASHBOARD_WIDGET_IDS.ADMIN_DEADLINE_RISKS, [
        {
          path: "/api/statistics/dashboard/deadline-risks/summary",
          body: {
            overdueCount: 2,
            dueSoonCount: 1,
          },
        },
      ]);

      await page.goto("/dashboard");

      const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_DEADLINE_RISKS);
      await expect(widget).toBeVisible();
      await expect(widget.getByRole("heading", { name: "Deadline risks" })).toBeVisible();
      await expect(widget.getByRole("button", { name: /2 Overdue/ })).toBeVisible();
      await expect(widget.getByRole("button", { name: /1 Due soon/ })).toBeVisible();
    });
  });
});
