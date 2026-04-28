import { USER_ROLE } from "~/config/userRoles";

import { COURSE_GENERATION_HANDLES, CURRICULUM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseGenerationFlow } from "../../flows/curriculum/open-course-generation.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { sendCourseGenerationPromptFlow } from "../../flows/curriculum/send-course-generation-prompt.flow";
import { createCurriculumCourse } from "../curriculum/curriculum-test-helpers";

import type { Page } from "@playwright/test";

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

test("admin can open course generation drawer when generation is available", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
        factories,
        `ai-generation-available-${Date.now()}`,
      );

      cleanup.add(async () => {
        await courseFactory.delete(course.id);
        await categoryFactory.delete(category.id);
      });

      await openCurriculumPageFlow(page, course.id);

      test.skip(
        (await page.getByTestId(CURRICULUM_HANDLES.COURSE_GENERATION_BUTTON).count()) === 0,
        "Course generation is not available in this environment",
      );

      await openCourseGenerationFlow(page);
      await expect(page.getByTestId(COURSE_GENERATION_HANDLES.PROMPT_INPUT)).toBeVisible();
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

test("course generation button is hidden when course already has chapters", async ({
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

      await openCurriculumPageFlow(page, course.id);

      await expect(page.getByTestId(CURRICULUM_HANDLES.COURSE_GENERATION_BUTTON)).toHaveCount(0);
    },
    { root: true },
  );
});

test("admin can start course generation from a prompt", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      const lumaConfig = await apiClient.api.envControllerGetLumaConfigured();

      test.skip(
        !lumaConfig.data.data.courseGenerationEnabled,
        "Luma course generation is not configured for this environment",
      );

      const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
        factories,
        `ai-generation-${Date.now()}`,
      );

      cleanup.add(async () => {
        await courseFactory.delete(course.id);
        await categoryFactory.delete(category.id);
      });

      await openCurriculumPageFlow(page, course.id);
      await openCourseGenerationFlow(page);
      await sendCourseGenerationPromptFlow(
        page,
        "Generate a tiny two chapter course about safe password management.",
      );

      await expect
        .poll(
          async () =>
            (await page.getByTestId(COURSE_GENERATION_HANDLES.PROGRESS_STRIP).count()) +
            (await page.getByTestId(COURSE_GENERATION_HANDLES.COMPLETED_NOTICE).count()) +
            (await page.getByTestId(COURSE_GENERATION_HANDLES.messageRole("assistant")).count()),
          { timeout: 60_000 },
        )
        .toBeGreaterThan(0);
    },
    { root: true },
  );
});
