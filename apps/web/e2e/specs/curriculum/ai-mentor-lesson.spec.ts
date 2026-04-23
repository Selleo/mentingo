import { existsSync } from "node:fs";

import { USER_ROLE } from "~/config/userRoles";

import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import { AI_MENTOR_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillAiMentorLessonFormFlow } from "../../flows/curriculum/fill-ai-mentor-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openExistingLessonFlow } from "../../flows/curriculum/open-existing-lesson.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveAiMentorLessonFormFlow } from "../../flows/curriculum/save-ai-mentor-lesson-form.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

test("admin can create and preview an AI mentor lesson", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-ai-mentor-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `ai-mentor-chapter-${Date.now()}`,
    });
    const lessonTitle = `ai-mentor-lesson-${Date.now()}`;

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCurriculumPageFlow(page, course.id);
    await openNewLessonFormFlow(page, chapter.id, "ai_mentor");
    await fillAiMentorLessonFormFlow(page, {
      title: lessonTitle,
      name: "Ada",
      description: "Practice the topic with a mentor.",
      instructions: "Ask concise questions.",
      completionConditions: "Learner answers two questions.",
    });
    await saveAiMentorLessonFormFlow(page);

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.chapters[0]?.lessons?.find((lesson) => lesson.title === lessonTitle)
          ?.id;
      })
      .not.toBeUndefined();

    const updatedCourse = await courseFactory.getById(course.id);
    const lessonId = updatedCourse.chapters[0]!.lessons!.find(
      (lesson) => lesson.title === lessonTitle,
    )!.id;

    await openExistingLessonFlow(page, chapter.id, lessonId);
    await page.getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.PREVIEW_BUTTON).click();
    await expect(page.getByText("Ada").first()).toBeVisible();
  });
});

const aiResourceTest = existsSync(CURRICULUM_TEST_DATA.files.aiMentorResource) ? test : test.skip;

aiResourceTest(
  "admin can upload an AI mentor resource file",
  async ({ cleanup, factories, withWorkerPage }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
        factories,
        `curriculum-ai-resource-${Date.now()}`,
      );
      const curriculumFactory = factories.createCurriculumFactory();
      const chapter = await curriculumFactory.createChapter({
        courseId: course.id,
        title: `ai-resource-chapter-${Date.now()}`,
      });
      const lesson = await curriculumFactory.createAiMentorLesson(course.id, {
        chapterId: chapter.id,
        title: `ai-resource-lesson-${Date.now()}`,
      });

      cleanup.add(async () => {
        await courseFactory.delete(course.id);
        await categoryFactory.delete(category.id);
      });

      await openCurriculumPageFlow(page, course.id);
      await openExistingLessonFlow(page, chapter.id, lesson.id);
      await page
        .getByTestId(AI_MENTOR_LESSON_FORM_HANDLES.RESOURCE_FILE_INPUT)
        .setInputFiles(CURRICULUM_TEST_DATA.files.aiMentorResource);

      await expect(page.getByText("ai-mentor-resource.pdf").first()).toBeVisible();
    });
  },
);
