import { AI_MENTOR_PRACTICE_STATUSES, DASHBOARD_WIDGET_TYPES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { AI_MENTOR_PRACTICE_HANDLES } from "../../data/ai-mentor-practice/handles";
import { DASHBOARD_WIDGET_HANDLES } from "../../data/dashboard/handles";
import { expect, test } from "../../fixtures/test.fixture";

import type { Page, Route } from "@playwright/test";
import type { DashboardWidgetSize, DashboardWidgetType } from "@repo/shared";

const CONTINUE_COURSE_ID = "11111111-1111-4111-8111-111111111111";
const CONTINUE_LESSON_ID = "22222222-2222-4222-8222-222222222222";
const REQUIRED_COURSE_ID = "33333333-3333-4333-8333-333333333333";
const PRACTICE_ID = "44444444-4444-4444-8444-444444444444";
const THREAD_ID = "55555555-5555-4555-8555-555555555555";
const USER_ID = "66666666-6666-4666-8666-666666666666";

type LearnerWidget = {
  type: DashboardWidgetType;
  size: DashboardWidgetSize;
};

type DashboardRequestHandler = (route: Route, url: URL) => Promise<boolean>;

type PracticeSession = {
  id: string;
  practiceDate: string;
  language: "en";
  title: string | null;
  aiMentorName: string | null;
  threadId: string | null;
  threadStatus: "active" | "completed" | "archived" | null;
  taskGoal: string | null;
  evaluation: object | null;
  status: "queued" | "processing" | "ready" | "failed";
  errorCode: string | null;
};

const fulfillJson = async (route: Route, body: unknown, status = 200) => {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
};

const summaryWith = (overrides: Record<string, unknown> = {}) => ({
  continueLearningCourses: [],
  requiredCourses: [],
  completion: {
    total: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    percentage: 0,
  },
  ...overrides,
});

const defaultCatalog = (widgets: LearnerWidget[]) =>
  widgets.map(({ type, size }) => ({
    type,
    allowedSizes: [size],
    defaultSize: size,
  }));

const installLearnerDashboardMocks = async (
  page: Page,
  options: {
    widgets: LearnerWidget[];
    catalog?: LearnerWidget[];
    onRequest?: DashboardRequestHandler;
  },
) => {
  const catalog = options.catalog ?? options.widgets;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && url.pathname === "/api/settings") {
      await fulfillJson(route, {
        data: {
          language: "en",
          isMFAEnabled: false,
          MFASecret: null,
          dashboard: { widgets: [] },
        },
      });
      return;
    }

    if (request.method() === "GET" && url.pathname === "/api/settings/dashboard") {
      await fulfillJson(route, {
        data: {
          layout: {
            schemaVersion: 2,
            revision: 0,
            widgets: options.widgets.map(({ type, size }) => ({ type, size, visible: true })),
          },
          catalog: defaultCatalog(catalog),
        },
      });
      return;
    }

    if (options.onRequest && (await options.onRequest(route, url))) return;

    await route.continue();
  });
};

const aiPractice = (overrides: Partial<PracticeSession> = {}): PracticeSession => ({
  id: PRACTICE_ID,
  practiceDate: "2026-08-17",
  language: "en",
  title: "A difficult workload conversation",
  aiMentorName: "Maya Chen",
  threadId: THREAD_ID,
  threadStatus: "active",
  taskGoal: "Agree on a practical next step.",
  evaluation: null,
  status: "ready",
  errorCode: null,
  ...overrides,
});

const learnerSummary = summaryWith({
  continueLearningCourses: [
    {
      courseId: CONTINUE_COURSE_ID,
      slug: "customer-onboarding",
      title: "Customer onboarding",
      thumbnailUrl: null,
      completedChapterCount: 2,
      courseChapterCount: 4,
      lesson: { id: CONTINUE_LESSON_ID, title: "Prepare the call" },
    },
  ],
  requiredCourses: [
    {
      courseId: REQUIRED_COURSE_ID,
      slug: "security-basics",
      title: "Security basics",
      thumbnailUrl: null,
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
});

const learnerCard = (type: DashboardWidgetType, size: DashboardWidgetSize = "2x1") => ({
  type,
  size,
});

test.describe("learner dashboard card contracts", () => {
  test("omits AI Mentor from the learner layout and catalog when AI is unavailable", async ({
    withReadonlyPage,
  }) => {
    await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
      await installLearnerDashboardMocks(page, {
        widgets: [learnerCard(DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING)],
        catalog: [learnerCard(DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING)],
        onRequest: async (route, url) => {
          if (
            route.request().method() === "GET" &&
            url.pathname === "/api/course/dashboard-summary"
          ) {
            await fulfillJson(route, { data: summaryWith() });
            return true;
          }
          if (route.request().method() !== "GET" || url.pathname !== "/api/env/ai") return false;
          await fulfillJson(route, { data: { enabled: false } });
          return true;
        },
      });

      await page.goto("/dashboard");

      await expect(
        page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CONTINUE_LEARNING),
      ).toBeVisible();
      await expect(page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET)).toHaveCount(0);

      await page.getByRole("button", { name: "Customize dashboard" }).click();
      await page.getByRole("button", { name: "Widgets" }).click();
      await expect(page.getByRole("switch", { name: "Toggle AI Mentor practice" })).toHaveCount(0);
    });
  });

  test("sends the learner language and renders each summary card from its response", async ({
    withReadonlyPage,
  }) => {
    await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
      const summaryLanguages: string[] = [];
      await installLearnerDashboardMocks(page, {
        widgets: [
          learnerCard(DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING, "2x2"),
          learnerCard(DASHBOARD_WIDGET_TYPES.REQUIRED_COURSES, "2x2"),
          learnerCard(DASHBOARD_WIDGET_TYPES.COURSE_COMPLETION, "2x2"),
        ],
        onRequest: async (route, url) => {
          if (
            route.request().method() !== "GET" ||
            url.pathname !== "/api/course/dashboard-summary"
          ) {
            return false;
          }
          summaryLanguages.push(url.searchParams.get("language") ?? "");
          await fulfillJson(route, { data: learnerSummary });
          return true;
        },
      });

      await page.goto("/dashboard");

      await expect(
        page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CONTINUE_LEARNING),
      ).toContainText("Customer onboarding");
      await expect(
        page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_REQUIRED_COURSE),
      ).toContainText("Due Aug 1, 2026");
      await expect(
        page
          .getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_COURSE_COMPLETION)
          .getByRole("img", { name: "3 of 5 completed" }),
      ).toBeVisible();
      await expect.poll(() => summaryLanguages).toEqual(["en"]);
    });
  });

  test("shows shared empty states for continue learning, required courses, and completion", async ({
    withReadonlyPage,
  }) => {
    await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
      await installLearnerDashboardMocks(page, {
        widgets: [
          learnerCard(DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING),
          learnerCard(DASHBOARD_WIDGET_TYPES.REQUIRED_COURSES),
          learnerCard(DASHBOARD_WIDGET_TYPES.COURSE_COMPLETION, "1x1"),
        ],
        onRequest: async (route, url) => {
          if (
            route.request().method() !== "GET" ||
            url.pathname !== "/api/course/dashboard-summary"
          ) {
            return false;
          }
          await fulfillJson(route, { data: summaryWith() });
          return true;
        },
      });

      await page.goto("/dashboard");

      await expect(
        page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CONTINUE_LEARNING),
      ).toContainText("You have no courses in progress.");
      await expect(
        page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_REQUIRED_COURSE),
      ).toContainText("You have no required courses to complete.");
      const completion = page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_COURSE_COMPLETION);
      await expect(completion).toContainText("You have no assigned courses yet.");
      await expect(completion.getByRole("img")).toHaveCount(0);
    });
  });

  test("shows an error state for all summary cards when the dashboard query fails", async ({
    withReadonlyPage,
  }) => {
    await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
      await installLearnerDashboardMocks(page, {
        widgets: [
          learnerCard(DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING),
          learnerCard(DASHBOARD_WIDGET_TYPES.REQUIRED_COURSES),
          learnerCard(DASHBOARD_WIDGET_TYPES.COURSE_COMPLETION, "1x1"),
        ],
        onRequest: async (route, url) => {
          if (
            route.request().method() !== "GET" ||
            url.pathname !== "/api/course/dashboard-summary"
          ) {
            return false;
          }
          await fulfillJson(route, { message: "summary unavailable" }, 500);
          return true;
        },
      });

      await page.goto("/dashboard");

      for (const handle of [
        DASHBOARD_WIDGET_HANDLES.STUDENT_CONTINUE_LEARNING,
        DASHBOARD_WIDGET_HANDLES.STUDENT_REQUIRED_COURSE,
        DASHBOARD_WIDGET_HANDLES.STUDENT_COURSE_COMPLETION,
      ]) {
        const widget = page.getByTestId(handle);
        await expect(widget).toContainText("We could not load this widget.");
        await expect(widget.getByRole("button", { name: "Try again" })).toBeVisible();
      }
    });
  });

  test("keeps the card content aligned to compact and expanded learner layouts", async ({
    withReadonlyPage,
  }) => {
    await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
      await installLearnerDashboardMocks(page, {
        widgets: [
          learnerCard(DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING, "2x1"),
          learnerCard(DASHBOARD_WIDGET_TYPES.REQUIRED_COURSES, "2x2"),
          learnerCard(DASHBOARD_WIDGET_TYPES.CERTIFICATES, "2x1"),
          learnerCard(DASHBOARD_WIDGET_TYPES.COURSE_COMPLETION, "1x1"),
        ],
        onRequest: async (route, url) => {
          if (
            route.request().method() === "GET" &&
            url.pathname === "/api/course/dashboard-summary"
          ) {
            await fulfillJson(route, { data: learnerSummary });
            return true;
          }
          if (route.request().method() === "GET" && url.pathname === "/api/auth/current-user") {
            await fulfillJson(route, {
              data: { id: USER_ID, roleSlugs: ["student"], permissions: [] },
            });
            return true;
          }
          if (
            route.request().method() === "GET" &&
            url.pathname === "/api/certificates/dashboard"
          ) {
            await fulfillJson(route, {
              data: [],
              pagination: { totalItems: 0, page: 1, perPage: 10 },
            });
            return true;
          }
          return false;
        },
      });

      await page.goto("/dashboard");

      const continueWidget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CONTINUE_LEARNING);
      const requiredWidget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_REQUIRED_COURSE);
      await expect(continueWidget).not.toContainText("Next: Prepare the call");
      await expect(requiredWidget).toContainText("1 required courses");
      await expect(requiredWidget).toContainText("1 overdue");
      await expect(page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CERTIFICATES)).toContainText(
        "You do not have any active certificates.",
      );
    });
  });
});

test.describe("learner AI Mentor practice card", () => {
  for (const status of [
    AI_MENTOR_PRACTICE_STATUSES.QUEUED,
    AI_MENTOR_PRACTICE_STATUSES.PROCESSING,
  ]) {
    test(`renders the ${status} generation state`, async ({ withReadonlyPage }) => {
      await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
        await installLearnerDashboardMocks(page, {
          widgets: [learnerCard(DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE, "3x2")],
          onRequest: async (route, url) => {
            if (route.request().method() !== "GET" || url.pathname !== "/api/ai/practice/today") {
              return false;
            }
            await fulfillJson(route, {
              data: aiPractice({
                title: null,
                aiMentorName: null,
                threadId: null,
                threadStatus: null,
                taskGoal: null,
                status,
              }),
            });
            return true;
          },
        });

        await page.goto("/dashboard");

        const widget = page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET);
        await expect(widget).toBeVisible();
        await expect(widget).toContainText(
          status === AI_MENTOR_PRACTICE_STATUSES.QUEUED
            ? "Your practice scenario is queued."
            : "Your practice scenario is being prepared.",
        );
      });
    });
  }

  test("renders an empty generation form", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
      await installLearnerDashboardMocks(page, {
        widgets: [learnerCard(DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE, "2x2")],
        onRequest: async (route, url) => {
          if (route.request().method() !== "GET" || url.pathname !== "/api/ai/practice/today") {
            return false;
          }
          await fulfillJson(route, { data: null });
          return true;
        },
      });

      await page.goto("/dashboard");

      const widget = page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET);
      await expect(widget).toContainText(
        "What conversation would you like to handle with more confidence?",
      );
      await expect(
        widget.getByRole("textbox", { name: "What would you like to practice?" }),
      ).toBeVisible();
      await expect(widget.getByRole("button", { name: "Create practice" })).toBeDisabled();
    });
  });

  test("offers retry for failed generation", async ({ withReadonlyPage }) => {
    await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
      await installLearnerDashboardMocks(page, {
        widgets: [learnerCard(DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE, "2x2")],
        onRequest: async (route, url) => {
          if (route.request().method() !== "GET" || url.pathname !== "/api/ai/practice/today") {
            return false;
          }
          await fulfillJson(route, {
            data: aiPractice({ status: "failed", errorCode: "generation_failed" }),
          });
          return true;
        },
      });

      await page.goto("/dashboard");

      const widget = page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET);
      await expect(widget).toContainText("Scenario generation failed. Open it to retry.");
      await expect(widget.getByRole("button", { name: "Try generation again" })).toBeVisible();
    });
  });

  test("keeps inline thread messages available for active and completed practices", async ({
    withReadonlyPage,
  }) => {
    for (const threadStatus of ["active", "completed"] as const) {
      await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
        await installLearnerDashboardMocks(page, {
          widgets: [learnerCard(DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE, "3x2")],
          onRequest: async (route, url) => {
            if (route.request().method() === "GET" && url.pathname === "/api/ai/practice/today") {
              await fulfillJson(route, {
                data: aiPractice({ threadStatus }),
              });
              return true;
            }
            if (
              route.request().method() === "GET" &&
              url.pathname === "/api/ai/thread/messages" &&
              url.searchParams.get("thread") === THREAD_ID
            ) {
              await fulfillJson(route, {
                data: [
                  {
                    id: "77777777-7777-4777-8777-777777777777",
                    role: "assistant",
                    content: "Let us work through the workload conversation.",
                    userName: "Maya Chen",
                  },
                  {
                    id: "88888888-8888-4888-8888-888888888888",
                    role: "user",
                    content: "I need help prioritizing the committed work.",
                    userName: null,
                  },
                ],
              });
              return true;
            }
            return false;
          },
        });

        await page.goto("/dashboard");

        const widget = page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET);
        await expect(widget).toContainText("Let us work through the workload conversation.");
        await expect(widget).toContainText("I need help prioritizing the committed work.");
        if (threadStatus === "active") {
          await expect(widget.getByRole("textbox", { name: "Message to AI Mentor" })).toBeVisible();
        } else {
          await expect(widget.getByRole("textbox", { name: "Message to AI Mentor" })).toHaveCount(
            0,
          );
        }
      });
    }
  });
});

test.describe("learner certificates card", () => {
  test("renders direct certificate rows, paginates, and opens the preview", async ({
    withReadonlyPage,
  }) => {
    await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
      const certificateRequests: string[] = [];
      const firstPage = Array.from({ length: 10 }, (_, index) => ({
        id: `99999999-9999-4999-8999-99999999999${index}`,
        userId: USER_ID,
        courseId: CONTINUE_COURSE_ID,
        courseTitle: index === 0 ? "Customer onboarding" : `Completed course ${index + 1}`,
        completionDate: "2026-07-20T00:00:00.000Z",
        fullName: "Taylor Student",
        certificateSignatureUrl: null,
        certificateFontColor: null,
        issuedAt: "2026-07-20T00:00:00.000Z",
        expiresAt: null,
        createdAt: "2026-07-20T00:00:00.000Z",
      }));
      const secondPage = [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          userId: USER_ID,
          courseId: CONTINUE_COURSE_ID,
          courseTitle: "Final compliance course",
          completionDate: "2026-07-21T00:00:00.000Z",
          fullName: "Taylor Student",
          certificateSignatureUrl: null,
          certificateFontColor: null,
          issuedAt: "2026-07-21T00:00:00.000Z",
          expiresAt: null,
          createdAt: "2026-07-21T00:00:00.000Z",
        },
      ];

      await installLearnerDashboardMocks(page, {
        widgets: [learnerCard(DASHBOARD_WIDGET_TYPES.CERTIFICATES, "2x2")],
        onRequest: async (route, url) => {
          if (route.request().method() === "GET" && url.pathname === "/api/auth/current-user") {
            await fulfillJson(route, {
              data: { id: USER_ID, roleSlugs: ["student"], permissions: [] },
            });
            return true;
          }
          if (route.request().method() === "GET" && url.pathname === "/api/settings/global") {
            await fulfillJson(route, { data: {} });
            return true;
          }
          if (
            route.request().method() !== "GET" ||
            url.pathname !== "/api/certificates/dashboard"
          ) {
            return false;
          }
          certificateRequests.push(url.search);
          const pageNumber = url.searchParams.get("page") === "2" ? 2 : 1;
          await fulfillJson(route, {
            data: pageNumber === 1 ? firstPage : secondPage,
            pagination: { totalItems: 11, page: pageNumber, perPage: 10 },
          });
          return true;
        },
      });

      await page.goto("/dashboard");

      const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CERTIFICATES);
      await expect(widget.getByRole("button")).toHaveCount(10);
      await expect(widget.getByRole("button", { name: /Customer onboarding/ })).toBeVisible();
      await widget.getByRole("button", { name: /Customer onboarding/ }).click();
      await expect(page.getByText("Taylor Student")).toBeVisible();

      await page.keyboard.press("Escape");
      const scrollArea = widget.locator("div.overflow-y-auto");
      await scrollArea.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        element.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
      await expect(widget.getByRole("button", { name: /Final compliance course/ })).toBeVisible();
      await expect
        .poll(() => certificateRequests)
        .toContainEqual(expect.stringContaining("page=2"));
      expect(certificateRequests[0]).toContain("page=1");
      expect(certificateRequests[0]).toContain("perPage=10");
      expect(certificateRequests[0]).toContain("language=en");
    });
  });

  test("shows the certificate empty state when the direct rows query is empty", async ({
    withReadonlyPage,
  }) => {
    await withReadonlyPage(USER_ROLE.student, async ({ page }) => {
      await installLearnerDashboardMocks(page, {
        widgets: [learnerCard(DASHBOARD_WIDGET_TYPES.CERTIFICATES)],
        onRequest: async (route, url) => {
          if (route.request().method() === "GET" && url.pathname === "/api/auth/current-user") {
            await fulfillJson(route, {
              data: { id: USER_ID, roleSlugs: ["student"], permissions: [] },
            });
            return true;
          }
          if (
            route.request().method() === "GET" &&
            url.pathname === "/api/certificates/dashboard"
          ) {
            await fulfillJson(route, {
              data: [],
              pagination: { totalItems: 0, page: 1, perPage: 10 },
            });
            return true;
          }
          return false;
        },
      });

      await page.goto("/dashboard");

      await expect(page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CERTIFICATES)).toContainText(
        "You do not have any active certificates.",
      );
    });
  });
});
