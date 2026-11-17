import {
  AI_MENTOR_PRACTICE_STATUSES,
  DASHBOARD_WIDGET_SIZES,
  DASHBOARD_WIDGET_TYPES,
  STUDENT_COURSE_URGENCY,
} from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { AI_MENTOR_PRACTICE_HANDLES } from "../../data/ai-mentor-practice/handles";
import {
  AI_PRACTICE_MESSAGES,
  DASHBOARD_MOCK_IDS,
  LEARNER_SUMMARY,
  MOCK_STUDENT_SESSION,
  aiPracticeSession,
  dashboardCertificate,
  dashboardWidget,
} from "../../data/dashboard/dashboard.data";
import {
  DASHBOARD_EDIT_HANDLES,
  DASHBOARD_STUDENT_HANDLES,
  DASHBOARD_WIDGET_HANDLES,
} from "../../data/dashboard/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openWidgetPickerFlow } from "../../flows/dashboard/customize-dashboard.flow";
import { mockDashboardFlow } from "../../flows/dashboard/mock-dashboard.flow";
import { openDashboardFlow } from "../../flows/dashboard/open-dashboard.flow";
import { scrollDashboardListToEndFlow } from "../../flows/dashboard/scroll-dashboard-list.flow";

const W = DASHBOARD_WIDGET_TYPES;
const SIZE = DASHBOARD_WIDGET_SIZES;
const SUMMARY_PATH = "/api/course/dashboard-summary";
const PRACTICE_TODAY_PATH = "/api/ai/practice/today";
const SUMMARY_WIDGETS = [
  dashboardWidget(W.CONTINUE_LEARNING, SIZE.TWO_BY_ONE),
  dashboardWidget(W.REQUIRED_COURSES, SIZE.TWO_BY_ONE),
  dashboardWidget(W.COURSE_COMPLETION, SIZE.ONE_BY_ONE),
];
const SUMMARY_HANDLES = [
  DASHBOARD_WIDGET_HANDLES.STUDENT_CONTINUE_LEARNING,
  DASHBOARD_WIDGET_HANDLES.STUDENT_REQUIRED_COURSE,
  DASHBOARD_WIDGET_HANDLES.STUDENT_COURSE_COMPLETION,
];
const FIRST_CERTIFICATES = Array.from({ length: 10 }, (_, index) =>
  dashboardCertificate(
    `99999999-9999-4999-8999-99999999999${index}`,
    `Completed course ${index + 1}`,
  ),
);
const LAST_CERTIFICATE = dashboardCertificate(
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "Final compliance course",
);

test.describe("learner dashboard card contracts", () => {
  test("omits AI Mentor from the learner layout and catalog when AI is unavailable", async ({
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.student, async ({ page }) => {
      await mockDashboardFlow(page, {
        widgets: [dashboardWidget(W.CONTINUE_LEARNING, SIZE.TWO_BY_ONE)],
        responses: [{ path: "/api/env/ai", body: { data: { enabled: false } } }],
      });

      await openDashboardFlow(page);
      await expect(
        page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CONTINUE_LEARNING),
      ).toBeVisible();
      await expect(page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET)).toHaveCount(0);

      await openWidgetPickerFlow(page);
      await expect(
        page.getByTestId(DASHBOARD_EDIT_HANDLES.widgetToggle(W.CONTINUE_LEARNING)),
      ).toBeVisible();
      await expect(
        page.getByTestId(DASHBOARD_EDIT_HANDLES.widgetToggle(W.AI_MENTOR_PRACTICE)),
      ).toHaveCount(0);
    });
  });

  test("sends the learner language and renders each summary card from its response", async ({
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.student, async ({ page }) => {
      const state = await mockDashboardFlow(page, {
        widgets: [
          dashboardWidget(W.CONTINUE_LEARNING, SIZE.TWO_BY_TWO),
          dashboardWidget(W.REQUIRED_COURSES, SIZE.TWO_BY_TWO),
          dashboardWidget(W.COURSE_COMPLETION, SIZE.TWO_BY_TWO),
        ],
        responses: [{ path: SUMMARY_PATH, body: LEARNER_SUMMARY }],
      });

      await openDashboardFlow(page);

      const continueCourse = page.getByTestId(
        DASHBOARD_STUDENT_HANDLES.continueCourse(DASHBOARD_MOCK_IDS.continueCourse),
      );
      await expect(continueCourse).toContainText("Customer onboarding");
      await expect(
        continueCourse.getByTestId(DASHBOARD_STUDENT_HANDLES.CONTINUE_NEXT_LESSON),
      ).toContainText("Prepare the call");
      const requiredCourse = page.getByTestId(
        DASHBOARD_STUDENT_HANDLES.requiredCourse(DASHBOARD_MOCK_IDS.requiredCourse),
      );
      await expect(requiredCourse).toContainText("Security basics");
      await expect(
        requiredCourse.getByTestId(
          DASHBOARD_STUDENT_HANDLES.requiredCourseUrgency(STUDENT_COURSE_URGENCY.OVERDUE),
        ),
      ).toBeVisible();
      await expect(
        page
          .getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_COURSE_COMPLETION)
          .getByTestId(DASHBOARD_WIDGET_HANDLES.CHART),
      ).toContainText("3/5");
      expect(state.requestsTo(SUMMARY_PATH).map((url) => url.searchParams.get("language"))).toEqual(
        ["en"],
      );
    });
  });

  test("shows shared empty states for continue learning, required courses, and completion", async ({
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.student, async ({ page }) => {
      await mockDashboardFlow(page, { widgets: SUMMARY_WIDGETS });

      await openDashboardFlow(page);

      for (const handle of SUMMARY_HANDLES) {
        const widget = page.getByTestId(handle);
        await expect(widget.getByTestId(DASHBOARD_WIDGET_HANDLES.EMPTY_STATE)).toBeVisible();
        await expect(widget.getByTestId(DASHBOARD_WIDGET_HANDLES.CHART)).toHaveCount(0);
      }
    });
  });

  test("shows an error state for all summary cards when the dashboard query fails", async ({
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.student, async ({ page }) => {
      await mockDashboardFlow(page, {
        widgets: SUMMARY_WIDGETS,
        responses: [{ path: SUMMARY_PATH, status: 500, body: { message: "summary unavailable" } }],
      });

      await openDashboardFlow(page);

      for (const handle of SUMMARY_HANDLES) {
        const widget = page.getByTestId(handle);
        await expect(widget.getByTestId(DASHBOARD_WIDGET_HANDLES.ERROR_STATE)).toBeVisible();
        await expect(widget.getByTestId(DASHBOARD_WIDGET_HANDLES.RETRY)).toBeVisible();
      }
    });
  });

  test("compact cards hide secondary details that expanded cards show", async ({
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.student, async ({ page }) => {
      await mockDashboardFlow(page, {
        widgets: [
          dashboardWidget(W.CONTINUE_LEARNING, SIZE.TWO_BY_ONE),
          dashboardWidget(W.REQUIRED_COURSES, SIZE.TWO_BY_TWO),
          dashboardWidget(W.CERTIFICATES, SIZE.TWO_BY_ONE),
        ],
        responses: [
          { path: SUMMARY_PATH, body: LEARNER_SUMMARY },
          { path: "/api/auth/current-user", body: MOCK_STUDENT_SESSION },
        ],
      });

      await openDashboardFlow(page);

      const continueWidget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CONTINUE_LEARNING);
      await expect(
        continueWidget.getByTestId(
          DASHBOARD_STUDENT_HANDLES.continueCourse(DASHBOARD_MOCK_IDS.continueCourse),
        ),
      ).toBeVisible();
      await expect(
        continueWidget.getByTestId(DASHBOARD_STUDENT_HANDLES.CONTINUE_NEXT_LESSON),
      ).toHaveCount(0);
      const requiredWidget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_REQUIRED_COURSE);
      await expect(
        requiredWidget.getByTestId(DASHBOARD_STUDENT_HANDLES.REQUIRED_COURSES_TOTAL),
      ).toContainText("1");
      await expect(
        requiredWidget.getByTestId(DASHBOARD_STUDENT_HANDLES.REQUIRED_COURSES_OVERDUE),
      ).toContainText("1");
      await expect(
        page
          .getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CERTIFICATES)
          .getByTestId(DASHBOARD_WIDGET_HANDLES.EMPTY_STATE),
      ).toBeVisible();
    });
  });
});

test.describe("learner AI Mentor practice card", () => {
  for (const status of [
    AI_MENTOR_PRACTICE_STATUSES.QUEUED,
    AI_MENTOR_PRACTICE_STATUSES.PROCESSING,
  ]) {
    test(`renders the ${status} generation state`, async ({ withWorkerPage }) => {
      await withWorkerPage(USER_ROLE.student, async ({ page }) => {
        await mockDashboardFlow(page, {
          widgets: [dashboardWidget(W.AI_MENTOR_PRACTICE, SIZE.THREE_BY_TWO)],
          responses: [
            {
              path: PRACTICE_TODAY_PATH,
              body: {
                data: aiPracticeSession({
                  title: null,
                  aiMentorName: null,
                  threadId: null,
                  threadStatus: null,
                  taskGoal: null,
                  status,
                }),
              },
            },
          ],
        });

        await openDashboardFlow(page);

        const widget = page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET);
        await expect(
          widget.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET_BETA_BADGE),
        ).toBeVisible();
        await expect(
          widget.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET_GENERATING),
        ).toBeVisible();
      });
    });
  }

  test("renders an empty generation form", async ({ withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.student, async ({ page }) => {
      await mockDashboardFlow(page, {
        widgets: [dashboardWidget(W.AI_MENTOR_PRACTICE, SIZE.TWO_BY_TWO)],
      });

      await openDashboardFlow(page);

      const widget = page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET);
      await expect(widget.getByTestId(AI_MENTOR_PRACTICE_HANDLES.SCENARIO_INPUT)).toBeVisible();
      await expect(widget.getByTestId(AI_MENTOR_PRACTICE_HANDLES.SUBMIT_BUTTON)).toBeDisabled();
    });
  });

  test("offers retry for failed generation", async ({ withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.student, async ({ page }) => {
      await mockDashboardFlow(page, {
        widgets: [dashboardWidget(W.AI_MENTOR_PRACTICE, SIZE.TWO_BY_TWO)],
        responses: [
          {
            path: PRACTICE_TODAY_PATH,
            body: { data: aiPracticeSession({ status: "failed", errorCode: "generation_failed" }) },
          },
        ],
      });

      await openDashboardFlow(page);

      const widget = page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET);
      await expect(widget.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET_FAILED)).toBeVisible();
      await expect(widget.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET_RETRY)).toBeEnabled();
    });
  });

  for (const { threadStatus, canReply } of [
    { threadStatus: "active", canReply: true },
    { threadStatus: "completed", canReply: false },
  ] as const) {
    test(`keeps inline thread messages for a ${threadStatus} practice`, async ({
      withWorkerPage,
    }) => {
      await withWorkerPage(USER_ROLE.student, async ({ page }) => {
        await mockDashboardFlow(page, {
          widgets: [dashboardWidget(W.AI_MENTOR_PRACTICE, SIZE.THREE_BY_TWO)],
          responses: [
            { path: PRACTICE_TODAY_PATH, body: { data: aiPracticeSession({ threadStatus }) } },
            { path: "/api/ai/thread/messages", body: AI_PRACTICE_MESSAGES },
          ],
        });

        await openDashboardFlow(page);

        const widget = page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET);
        for (const message of AI_PRACTICE_MESSAGES.data) {
          await expect(widget).toContainText(message.content);
        }
        await expect(
          widget.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET_MESSAGE_INPUT),
        ).toHaveCount(canReply ? 1 : 0);
      });
    });
  }
});

test("learner certificates card paginates and opens the preview", async ({ withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    const state = await mockDashboardFlow(page, {
      widgets: [dashboardWidget(W.CERTIFICATES, SIZE.TWO_BY_TWO)],
      responses: [
        { path: "/api/auth/current-user", body: MOCK_STUDENT_SESSION },
        { path: "/api/settings/global", body: { data: {} } },
        {
          path: "/api/certificates/dashboard",
          respond: ({ url }) =>
            url.searchParams.get("page") === "2"
              ? { data: [LAST_CERTIFICATE], pagination: { totalItems: 11, page: 2, perPage: 10 } }
              : { data: FIRST_CERTIFICATES, pagination: { totalItems: 11, page: 1, perPage: 10 } },
        },
      ],
    });

    await openDashboardFlow(page);

    const widget = page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CERTIFICATES);
    const firstCertificate = widget.getByTestId(
      DASHBOARD_STUDENT_HANDLES.certificate(FIRST_CERTIFICATES[0].id),
    );
    await expect(firstCertificate).toContainText("Completed course 1");
    await scrollDashboardListToEndFlow(
      widget.getByTestId(DASHBOARD_STUDENT_HANDLES.CERTIFICATE_LIST),
    );
    await expect(
      widget.getByTestId(DASHBOARD_STUDENT_HANDLES.certificate(LAST_CERTIFICATE.id)),
    ).toBeVisible();

    const [firstPage] = state.requestsTo("/api/certificates/dashboard");
    expect(firstPage?.searchParams.get("page")).toBe("1");
    expect(firstPage?.searchParams.get("perPage")).toBe("10");
    expect(firstPage?.searchParams.get("language")).toBe("en");

    await firstCertificate.click();
    await expect(page.getByRole("dialog")).toContainText("Taylor Student");
  });
});
