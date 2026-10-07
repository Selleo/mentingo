import { USER_ROLE } from "~/config/userRoles";

import { COURSE_AUTHORING_HANDLES, CURRICULUM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseAuthoringFlow } from "../../flows/curriculum/open-course-authoring.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { createCurriculumCourse } from "../curriculum/curriculum-test-helpers";

import type { Page } from "@playwright/test";

const zeroUsage = () => ({
  total: {
    invocationCount: 0,
    pendingInvocationCount: 0,
    unknownTokenInvocationCount: 0,
    unknownCostInvocationCount: 0,
    reportedCostInvocationCount: 0,
    estimatedCostInvocationCount: 0,
    configurationEstimateInvocationCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    reportedUsd: "0",
    estimatedUsd: "0",
    knownUsd: "0",
    tokensComplete: true,
    costComplete: true,
  },
  byTask: [],
  byRequest: [],
  byApiKey: [],
});

const mockCourseAuthoringWorkspace = async (
  page: Page,
  courseId: string,
  records: Array<{ id: string; kind: string; payload: Record<string, unknown> }> = [],
) => {
  const session = {
    schemaVersion: 1,
    sessionId: "00000000-0000-4000-8000-000000000001",
    courseId,
    language: "en",
    status: "active",
    snapshotSequence: 4,
    workspaceRevision: 4,
    records,
    tasks: [],
    usage: zeroUsage(),
  };
  const context = {
    courseId,
    language: "en",
    title: "Deterministic authoring course",
    description: "A deterministic authoring fixture.",
    baselineHash: "baseline-hash",
    fieldHashes: {},
    chapters: [],
  };
  const restoredSession = { ...session, sessionId: "00000000-0000-4000-8000-000000000002" };
  const newSession = { ...session, sessionId: "00000000-0000-4000-8000-000000000003" };
  const sessionSummaries = [
    {
      ...session,
      title: "Current authoring chat",
      createdAt: "2026-09-22T08:00:00Z",
      lastActivityAt: "2026-09-22T09:00:00Z",
    },
    {
      ...restoredSession,
      title: "Earlier authoring chat",
      createdAt: "2026-09-21T08:00:00Z",
      lastActivityAt: "2026-09-21T09:00:00Z",
    },
    ...Array.from({ length: 12 }, (_, index) => ({
      ...session,
      sessionId: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
      title: `Archived authoring chat ${index + 1}`,
      createdAt: "2026-09-20T08:00:00Z",
      lastActivityAt: "2026-09-20T09:00:00Z",
    })),
  ];

  await page.route("**/api/luma/authoring/**", async (route) => {
    throw new Error(
      `Unexpected authoring request in deterministic fixture: ${route.request().url()}`,
    );
  });
  await page.route(`**/api/luma/authoring/courses/${courseId}/sessions`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        json: {
          data: sessionSummaries,
        },
      });
      return;
    }
    sessionSummaries.unshift({
      ...newSession,
      title: "New chat",
      createdAt: "2026-09-22T10:00:00Z",
      lastActivityAt: "2026-09-22T10:00:00Z",
    });
    await route.fulfill({ contentType: "application/json", json: { data: newSession } });
  });
  await page.route(`**/api/luma/authoring/courses/${courseId}/sessions/*`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const url = route.request().url();
    let selected = session;
    if (url.endsWith(restoredSession.sessionId)) selected = restoredSession;
    if (url.endsWith(newSession.sessionId)) selected = newSession;
    await route.fulfill({ contentType: "application/json", json: { data: selected } });
  });
  await page.route(`**/api/luma/authoring/courses/${courseId}/context*`, async (route) => {
    await route.fulfill({ contentType: "application/json", json: { data: context } });
  });
};

const mockLumaCourseGenerationConfig = async (page: Page, courseGenerationEnabled: boolean) => {
  await page.route("**/api/env/luma", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        data: {
          enabled: courseGenerationEnabled,
          courseGenerationEnabled,
          voiceMentorEnabled: false,
        },
      },
    });
  });
};

test("admin can open the course authoring workspace when generation is available", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      await mockLumaCourseGenerationConfig(page, true);
      const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
        factories,
        `ai-generation-available-${Date.now()}`,
      );

      cleanup.add(async () => {
        await courseFactory.delete(course.id);
        await categoryFactory.delete(category.id);
      });

      await mockCourseAuthoringWorkspace(page, course.id);
      await openCurriculumPageFlow(page, course.id);

      await openCourseAuthoringFlow(page);
      await expect(page.getByTestId(COURSE_AUTHORING_HANDLES.BRIEF_PANEL)).toBeVisible();
      const sessionTrigger = page.getByTestId(COURSE_AUTHORING_HANDLES.SESSION_MENU_TRIGGER);
      await sessionTrigger.click();
      await expect(page.getByTestId(COURSE_AUTHORING_HANDLES.NEW_CHAT_BUTTON)).toBeVisible();
      await page.getByTestId(COURSE_AUTHORING_HANDLES.SESSION_MENU_LIST).hover();
      await page.mouse.wheel(0, 240);
      await expect(page.getByText("Archived authoring chat 12", { exact: true })).toBeVisible();
      await page
        .getByTestId(
          COURSE_AUTHORING_HANDLES.sessionMenuItem("00000000-0000-4000-8000-000000000002"),
        )
        .click();
      await expect(page.getByTestId(COURSE_AUTHORING_HANDLES.NEW_CHAT_BUTTON)).toBeHidden();
      await sessionTrigger.click();
      await page.getByTestId(COURSE_AUTHORING_HANDLES.NEW_CHAT_BUTTON).click();
      await expect(page.getByTestId(COURSE_AUTHORING_HANDLES.NEW_CHAT_BUTTON)).toBeHidden();
      await sessionTrigger.click();
      await page.getByTestId(COURSE_AUTHORING_HANDLES.BRIEF_PANEL).click();
      await expect(page.getByTestId(COURSE_AUTHORING_HANDLES.NEW_CHAT_BUTTON)).toBeHidden();

      await page.setViewportSize({ width: 390, height: 844 });
      await sessionTrigger.click();
      await expect(page.getByTestId(COURSE_AUTHORING_HANDLES.NEW_CHAT_BUTTON)).toBeVisible();
      await page.getByTestId(COURSE_AUTHORING_HANDLES.NEW_CHAT_BUTTON).click();
      await expect(page.getByTestId(COURSE_AUTHORING_HANDLES.NEW_CHAT_BUTTON)).toBeHidden();
      await sessionTrigger.click();
      await expect(page.getByTestId(COURSE_AUTHORING_HANDLES.NEW_CHAT_BUTTON)).toBeVisible();
      await page.getByTestId(COURSE_AUTHORING_HANDLES.BRIEF_PANEL).click();
      await expect(page.getByTestId(COURSE_AUTHORING_HANDLES.NEW_CHAT_BUTTON)).toBeHidden();
    },
    { root: true },
  );
});

test("course generation button is hidden when Luma course generation is unavailable", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      await mockLumaCourseGenerationConfig(page, false);
      const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
        factories,
        `ai-generation-unavailable-${Date.now()}`,
      );

      cleanup.add(async () => {
        await courseFactory.delete(course.id);
        await categoryFactory.delete(category.id);
      });

      await openCurriculumPageFlow(page, course.id);

      await expect(page.getByTestId(CURRICULUM_HANDLES.COURSE_GENERATION_BUTTON)).toHaveCount(0);
    },
    { root: true },
  );
});

test("course authoring workspace remains available when course already has chapters", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      await mockLumaCourseGenerationConfig(page, true);
      const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
        factories,
        `ai-generation-with-chapter-${Date.now()}`,
      );
      const curriculumFactory = factories.createCurriculumFactory();
      await curriculumFactory.createChapter({
        courseId: course.id,
        title: `generation-existing-chapter-${Date.now()}`,
      });

      cleanup.add(async () => {
        await courseFactory.delete(course.id);
        await categoryFactory.delete(category.id);
      });

      await mockCourseAuthoringWorkspace(page, course.id);
      await openCurriculumPageFlow(page, course.id);

      await expect(page.getByTestId(CURRICULUM_HANDLES.COURSE_GENERATION_BUTTON)).toBeVisible();
      await openCourseAuthoringFlow(page);
      await expect(page.getByTestId(COURSE_AUTHORING_HANDLES.ROOT)).toBeVisible();
    },
    { root: true },
  );
});

test("reconnecting restores an unfinished authoring preview snapshot", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      await mockLumaCourseGenerationConfig(page, true);
      const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
        factories,
        `ai-generation-reconnect-${Date.now()}`,
      );

      cleanup.add(async () => {
        await courseFactory.delete(course.id);
        await categoryFactory.delete(category.id);
      });

      await mockCourseAuthoringWorkspace(page, course.id, [
        {
          id: "preview-reconnect",
          kind: "preview",
          payload: {
            provisional: true,
            taskId: "00000000-0000-4000-8000-000000000004",
            requestId: "00000000-0000-4000-8000-000000000005",
            revision: 1,
            title: "Recovered in-progress preview",
            outline: [
              {
                title: "Recovered chapter",
                lessons: [{ title: "Recovered lesson", lessonType: "content" }],
              },
            ],
          },
        },
      ]);
      await openCurriculumPageFlow(page, course.id);
      await openCourseAuthoringFlow(page);
      await expect(page.getByText("Recovered in-progress preview")).toBeVisible();

      await page.reload();
      await expect(page.getByTestId(COURSE_AUTHORING_HANDLES.ROOT)).toBeVisible();
      await expect(page.getByText("Recovered in-progress preview")).toBeVisible();
    },
    { root: true },
  );
});

test("admin can start course authoring from a brief", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      await mockLumaCourseGenerationConfig(page, true);

      const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
        factories,
        `ai-authoring-${Date.now()}`,
      );

      cleanup.add(async () => {
        await courseFactory.delete(course.id);
        await categoryFactory.delete(category.id);
      });

      await mockCourseAuthoringWorkspace(page, course.id);
      let commandBody: Record<string, unknown> | null = null;
      await page.route("**/api/luma/authoring/courses/*/sessions/*/commands", async (route) => {
        commandBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          contentType: "application/json",
          json: {
            data: {
              commandId: "00000000-0000-4000-8000-000000000006",
              hash: "command-hash",
              acceptedSequence: 5,
              workspaceRevision: 5,
              requestId: "00000000-0000-4000-8000-000000000007",
              taskIds: [],
            },
          },
        });
      });
      await openCurriculumPageFlow(page, course.id);
      await openCourseAuthoringFlow(page);
      await page
        .getByTestId(COURSE_AUTHORING_HANDLES.BRIEF_INPUT)
        .fill("Create a tiny course about safe password management.");
      await page.getByTestId(COURSE_AUTHORING_HANDLES.BRIEF_SUBMIT_BUTTON).click();

      await expect.poll(() => commandBody?.action).toBe("request.create");
    },
    { root: true },
  );
});

test("an answered clarification stays visible after reload without another answer input", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      await mockLumaCourseGenerationConfig(page, true);
      const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
        factories,
        `ai-authoring-durable-question-${Date.now()}`,
      );
      cleanup.add(async () => {
        await courseFactory.delete(course.id);
        await categoryFactory.delete(category.id);
      });

      const sessionId = "00000000-0000-4000-8000-000000000001";
      const requestId = "00000000-0000-4000-8000-000000000011";
      const taskId = "00000000-0000-4000-8000-000000000012";
      const questionId = "00000000-0000-4000-8000-000000000013";
      const messageId = "00000000-0000-4000-8000-000000000014";
      const questionPart: {
        requestId: string;
        messageId: string;
        partId: string;
        partKind: string;
        taskId: string;
        status: string;
        firstSequence: number;
        updatedSequence: number;
        text: string | null;
        answer: string | null;
        tool: null;
        artifact: { artifactKind: string; artifactId: string };
      } = {
        requestId,
        messageId,
        partId: `question:${taskId}:1`,
        partKind: "question",
        taskId,
        status: "review",
        firstSequence: 2,
        updatedSequence: 2,
        text: null,
        answer: null,
        tool: null,
        artifact: { artifactKind: "question", artifactId: questionId },
      };
      const initialRecords: Array<{
        id: string;
        kind: string;
        payload: Record<string, unknown>;
      }> = [
        {
          id: "request-one",
          kind: "request",
          payload: {
            requestId,
            instruction: "Create a course for new teachers.",
            createdAt: "2026-09-25T09:00:00.000Z",
            attachedSourceVersionIds: [],
          },
        },
        {
          id: questionId,
          kind: "question",
          payload: {
            requestId,
            taskId,
            revision: 1,
            question: "Who is the intended audience?",
            choices: [],
            status: "waiting_author",
          },
        },
      ];
      const liveSession = {
        schemaVersion: 1,
        sessionId,
        courseId: course.id,
        language: "en",
        status: "active",
        snapshotSequence: 4,
        workspaceRevision: 4,
        records: initialRecords,
        tasks: [
          {
            taskId,
            requestId,
            kind: "lesson",
            status: "waiting_author",
            errorCode: null,
            outputId: null,
          },
        ],
        turns: [
          {
            requestId,
            messageId,
            status: "waiting_author",
            taskIds: [taskId],
            firstSequence: 1,
            updatedSequence: 2,
            parts: [questionPart],
          },
        ],
        usage: zeroUsage(),
      };
      await mockCourseAuthoringWorkspace(page, course.id);
      await page.route(
        `**/api/luma/authoring/courses/${course.id}/sessions/${sessionId}`,
        async (route) => {
          if (route.request().method() !== "GET") return route.continue();
          await route.fulfill({ contentType: "application/json", json: { data: liveSession } });
        },
      );
      const commandBodies: Array<Record<string, unknown>> = [];
      await page.route(
        `**/api/luma/authoring/courses/${course.id}/sessions/${sessionId}/commands`,
        async (route) => {
          const body = route.request().postDataJSON() as Record<string, unknown>;
          commandBodies.push(body);
          liveSession.snapshotSequence += 1;
          liveSession.workspaceRevision += 1;
          if (body.action === "question.answer") {
            liveSession.records.push({
              id: "answer-record",
              kind: "question_answer",
              payload: {
                taskId,
                requestId,
                revision: 1,
                answer: body.answer as string,
                commandId: body.commandId as string,
              },
            });
            liveSession.turns[0].status = "running";
            liveSession.turns[0].updatedSequence = liveSession.snapshotSequence;
            liveSession.turns[0].parts[0] = {
              ...questionPart,
              status: "completed",
              answer: body.answer as string,
              updatedSequence: liveSession.snapshotSequence,
            };
          }
          await route.fulfill({
            contentType: "application/json",
            json: {
              data: {
                commandId: body.commandId,
                hash: "command-hash",
                acceptedSequence: liveSession.snapshotSequence,
                workspaceRevision: liveSession.workspaceRevision,
                requestId,
                taskIds: [],
              },
            },
          });
        },
      );

      await openCurriculumPageFlow(page, course.id);
      await openCourseAuthoringFlow(page);
      const questionCard = page.getByTestId(`course-authoring-question-${questionId}`);
      await expect(questionCard).toBeVisible();
      const answerInput = questionCard.getByRole("textbox");
      await answerInput.fill("New teachers");
      await answerInput.press("Enter");
      await expect(questionCard.getByText("New teachers", { exact: true })).toBeVisible();
      await expect(questionCard.getByRole("textbox")).toHaveCount(0);

      await page.reload();
      await expect(page.getByTestId(COURSE_AUTHORING_HANDLES.ROOT)).toBeVisible();
      const restoredQuestion = page.getByTestId(`course-authoring-question-${questionId}`);
      await expect(restoredQuestion.getByText("New teachers", { exact: true })).toBeVisible();
      await expect(restoredQuestion.getByRole("textbox")).toHaveCount(0);
    },
    { root: true },
  );
});
