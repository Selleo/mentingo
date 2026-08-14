import { USER_ROLE } from "~/config/userRoles";

import { AI_MENTOR_PRACTICE_HANDLES } from "../../data/ai-mentor-practice/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";

import type { Page, Route } from "@playwright/test";

const PRACTICE_ID = "11111111-1111-4111-8111-111111111111";
const THREAD_ID = "22222222-2222-4222-8222-222222222222";

const evaluation = {
  passed: true,
  minScore: 2,
  score: 3,
  maxScore: 3,
  percentage: 100,
  criteria: [
    {
      criterionId: "33333333-3333-4333-8333-333333333333",
      title: "State the request clearly",
      awardedScore: 3,
      maxScore: 3,
      status: "met",
      learnerSafeFeedback: "You made the request clear and actionable.",
    },
  ],
  blockingErrors: [],
};

type PracticeSession = {
  id: string;
  practiceDate: string;
  language: "en";
  title: string | null;
  aiMentorName: string | null;
  threadId: string | null;
  threadStatus: "active" | "completed" | null;
  taskGoal: string | null;
  evaluation: typeof evaluation | null;
  status: "queued" | "ready";
  errorCode: string | null;
};

const readyPractice: PracticeSession = {
  id: PRACTICE_ID,
  practiceDate: "2026-08-07",
  language: "en",
  title: "A difficult workload conversation",
  aiMentorName: "Maya Chen",
  threadId: THREAD_ID,
  threadStatus: "active",
  taskGoal: "<p>Explain the workload impact and agree on a practical next step.</p>",
  evaluation: null,
  status: "ready",
  errorCode: null,
};

const fulfillJson = async (route: Route, body: unknown) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: body }),
  });
};

const installDashboardAndPracticeMocks = async (page: Page) => {
  let createdScenario: unknown;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (request.method() === "GET" && path === "/api/settings") {
      await fulfillJson(route, {
        language: "en",
        isMFAEnabled: false,
        MFASecret: null,
        dashboard: {
          widgets: [{ id: "s_ai_mentor_practice", order: 0, width: 2 }],
        },
      });
      return;
    }

    if (request.method() === "GET" && path === "/api/settings/dashboard") {
      await fulfillJson(route, ["s_ai_mentor_practice"]);
      return;
    }

    if (request.method() === "GET" && path === "/api/ai/practice/today") {
      await fulfillJson(route, null);
      return;
    }

    if (request.method() === "POST" && path === "/api/ai/practice") {
      createdScenario = request.postDataJSON();
      await fulfillJson(route, {
        ...readyPractice,
        status: "queued",
        title: null,
        aiMentorName: null,
        threadId: null,
        threadStatus: null,
        taskGoal: null,
      });
      return;
    }

    if (request.method() === "GET" && path === `/api/ai/practice/${PRACTICE_ID}`) {
      await fulfillJson(route, {
        ...readyPractice,
        status: "queued",
        title: null,
        aiMentorName: null,
        threadId: null,
        threadStatus: null,
        taskGoal: null,
      });
      return;
    }

    await route.continue();
  });

  return {
    getCreatedScenario: () => createdScenario,
  };
};

test("student can start a practice from the dashboard and see background preparation", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    const mockState = await installDashboardAndPracticeMocks(page);

    await page.goto("/dashboard");

    const widget = page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.WIDGET);
    await expect(widget).toBeVisible();
    await expect(widget.getByRole("heading", { name: "AI Mentor practice" })).toBeVisible();
    await widget.getByRole("link", { name: "Start practice" }).click();

    await expect(page).toHaveURL(/\/ai-mentor\/practice\/new$/);
    await page
      .getByTestId(AI_MENTOR_PRACTICE_HANDLES.SCENARIO_INPUT)
      .fill("I want to practice asking my manager for help with an overloaded workload.");
    await page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.SUBMIT_BUTTON).click();

    await expect(page).toHaveURL(new RegExp(`/ai-mentor/practice/${PRACTICE_ID}$`));
    await expect(page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.PREPARING_STATE)).toBeVisible();
    await expect(page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.GO_TO_DASHBOARD_BUTTON)).toBeVisible();
    await expect(mockState.getCreatedScenario()).toEqual({
      language: "en",
      scenario: "I want to practice asking my manager for help with an overloaded workload.",
    });
  });
});

test("student can review practice feedback and start the practice again", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    let currentPractice = { ...readyPractice };
    let releaseReplay: (() => void) | undefined;
    const replayResponse = new Promise<void>((resolve) => {
      releaseReplay = resolve;
    });

    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;

      if (request.method() === "GET" && path === `/api/ai/practice/${PRACTICE_ID}`) {
        await fulfillJson(route, currentPractice);
        return;
      }

      if (request.method() === "GET" && path === "/api/ai/thread/messages") {
        await fulfillJson(route, [
          {
            id: "44444444-4444-4444-8444-444444444444",
            role: "assistant",
            content: "Let us work through the workload conversation.",
            userName: "Maya Chen",
          },
          {
            id: "55555555-5555-4555-8555-555555555555",
            role: "user",
            content: "I need help prioritizing the work that is already committed.",
            userName: null,
          },
        ]);
        return;
      }

      if (request.method() === "GET" && path === "/api/env/luma") {
        await fulfillJson(route, {
          enabled: false,
          courseGenerationEnabled: false,
          voiceMentorEnabled: false,
          voiceTtsProvider: "cartesia",
        });
        return;
      }

      if (request.method() === "POST" && path === `/api/ai/judge/${THREAD_ID}`) {
        currentPractice = {
          ...currentPractice,
          evaluation,
          threadStatus: "completed",
        };
        await fulfillJson(route, evaluation);
        return;
      }

      if (request.method() === "POST" && path === `/api/ai/practice/${PRACTICE_ID}/replay`) {
        await replayResponse;
        currentPractice = {
          ...readyPractice,
          evaluation: null,
        };
        await fulfillJson(route, currentPractice);
        return;
      }

      await route.continue();
    });

    await page.goto(`/ai-mentor/practice/${PRACTICE_ID}`);

    await expect(page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.CONVERSATION)).toBeVisible();
    await page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.TASK_BUTTON).click();
    await expect(
      page.getByText("Explain the workload impact and agree on a practical next step."),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.CHECK_BUTTON).click();
    const feedbackDialog = page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.FEEDBACK_DIALOG);
    await expect(feedbackDialog).toBeVisible();
    await page.getByTestId(LEARNING_HANDLES.AI_MENTOR_RESULT_CLOSE_BUTTON).click();
    await expect(feedbackDialog).toBeHidden();

    await expect(page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.VIEW_FEEDBACK_BUTTON)).toBeVisible();
    await page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.VIEW_FEEDBACK_BUTTON).click();

    await expect(feedbackDialog).toBeVisible();
    await expect(feedbackDialog.getByText("State the request clearly")).toBeVisible();
    await page.getByTestId(LEARNING_HANDLES.AI_MENTOR_RESULT_CLOSE_BUTTON).click();

    await page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.PRACTICE_AGAIN_BUTTON).click();
    await expect(page.getByRole("status")).toContainText("Setting up your next rehearsal");
    releaseReplay?.();
    await expect(page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.CONVERSATION)).toBeVisible();
    await expect(page.getByTestId(LEARNING_HANDLES.AI_MENTOR_MESSAGE_INPUT)).toBeVisible();
  });
});
