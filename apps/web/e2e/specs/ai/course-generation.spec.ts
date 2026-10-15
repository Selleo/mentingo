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

const mockCourseAuthoringWorkspace = async (page: Page, courseId: string) => {
  const session = {
    schemaVersion: 1,
    sessionId: "00000000-0000-4000-8000-000000000001",
    courseId,
    language: "en",
    status: "active",
    snapshotSequence: 4,
    workspaceRevision: 4,
    records: [],
    tasks: [],
    usage: zeroUsage(),
  };
  await page.route("**/api/luma/authoring/**", async (route) => {
    throw new Error(`Unexpected authoring request in drawer smoke test: ${route.request().url()}`);
  });
  await page.route(
    (url) => url.pathname === `/api/luma/authoring/courses/${courseId}/sessions`,
    async (route) => {
      if (route.request().method() === "GET") {
        const params = new URL(route.request().url()).searchParams;
        await route.fulfill({
          contentType: "application/json",
          json: {
            data: [
              {
                ...session,
                title: "Current authoring chat",
                createdAt: "2026-09-22T08:00:00Z",
                lastActivityAt: "2026-09-22T09:00:00Z",
              },
            ],
            pagination: {
              totalItems: 1,
              page: Number(params.get("page") ?? 1),
              perPage: Number(params.get("perPage") ?? 8),
            },
          },
        });
        return;
      }
      await route.fulfill({ contentType: "application/json", json: { data: session } });
    },
  );
  await page.route(
    `**/api/luma/authoring/courses/${courseId}/sessions/${session.sessionId}`,
    async (route) => {
      await route.fulfill({ contentType: "application/json", json: { data: session } });
    },
  );
  await page.route(`**/api/luma/authoring/courses/${courseId}/context*`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        data: {
          courseId,
          language: "en",
          title: "Deterministic authoring course",
          description: "A deterministic authoring fixture.",
          baselineHash: "baseline-hash",
          fieldHashes: {},
          chapters: [],
        },
      },
    });
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

      await expect(page.getByTestId(CURRICULUM_HANDLES.COURSE_GENERATION_BUTTON)).toBeVisible();
      await openCourseAuthoringFlow(page);
      await expect(page.getByTestId(COURSE_AUTHORING_HANDLES.ROOT)).toBeVisible();
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
