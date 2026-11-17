import { USER_ROLE } from "~/config/userRoles";

import { COURSE_AUTHORING_HANDLES, CURRICULUM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import {
  mockCourseAuthoringWorkspaceFlow,
  mockLumaConfigFlow,
} from "../../flows/ai/mock-luma.flow";
import { openCourseAuthoringFlow } from "../../flows/curriculum/open-course-authoring.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { createCurriculumCourse } from "../curriculum/curriculum-test-helpers";

test("admin can open the course authoring workspace for a course with chapters when generation is available", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const prefix = `ai-generation-available-${Date.now()}`;
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      prefix,
    );
    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });
    // An existing chapter must not hide the workspace.
    await factories.createCurriculumFactory().createChapter({
      courseId: course.id,
      title: `${prefix}-chapter`,
    });

    await mockLumaConfigFlow(page, { courseGenerationEnabled: true });
    await mockCourseAuthoringWorkspaceFlow(page, course.id);
    await openCurriculumPageFlow(page, course.id);

    await expect(page.getByTestId(CURRICULUM_HANDLES.COURSE_GENERATION_BUTTON)).toBeVisible();
    await openCourseAuthoringFlow(page);
    await expect(page.getByTestId(COURSE_AUTHORING_HANDLES.ROOT)).toBeVisible();
  });
});

test("course generation button is hidden when Luma course generation is unavailable", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `ai-generation-unavailable-${Date.now()}`,
    );
    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await mockLumaConfigFlow(page, { courseGenerationEnabled: false });
    await openCurriculumPageFlow(page, course.id);

    await expect(page.getByTestId(CURRICULUM_HANDLES.COURSE_GENERATION_BUTTON)).toHaveCount(0);
  });
});
