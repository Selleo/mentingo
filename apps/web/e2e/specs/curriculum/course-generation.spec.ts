import { USER_ROLE } from "~/config/userRoles";

import { COURSE_GENERATION_HANDLES, CURRICULUM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseGenerationFlow } from "../../flows/curriculum/open-course-generation.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { sendCourseGenerationPromptFlow } from "../../flows/curriculum/send-course-generation-prompt.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

test("admin can open course generation drawer when generation is available", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-generation-available-${Date.now()}`,
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
  });
});

const aiGenerationTest = process.env.E2E_ENABLE_AI_COURSE_GENERATION === "true" ? test : test.skip;

aiGenerationTest(
  "admin can start course generation from a prompt",
  async ({ cleanup, factories, withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
        factories,
        `curriculum-generation-${Date.now()}`,
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

      await expect(page.getByTestId(COURSE_GENERATION_HANDLES.PROGRESS_STRIP)).toBeVisible({
        timeout: 60_000,
      });
    });
  },
);
