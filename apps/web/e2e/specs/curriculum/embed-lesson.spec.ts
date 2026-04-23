import { USER_ROLE } from "~/config/userRoles";

import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import { EMBED_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillEmbedLessonFormFlow } from "../../flows/curriculum/fill-embed-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

test("admin can fill an embed lesson with YouTube and external resources", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-embed-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `embed-chapter-${Date.now()}`,
    });
    const lessonTitle = `embed-lesson-${Date.now()}`;

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCurriculumPageFlow(page, course.id);
    await openNewLessonFormFlow(page, chapter.id, "embed");
    await fillEmbedLessonFormFlow(page, {
      title: lessonTitle,
      resources: [CURRICULUM_TEST_DATA.youtubeVideoUrl, "https://example.com"],
    });
    await expect(page.getByTestId(EMBED_LESSON_FORM_HANDLES.resourceUrlInput(0))).toHaveValue(
      CURRICULUM_TEST_DATA.youtubeVideoUrl,
    );
    await expect(page.getByTestId(EMBED_LESSON_FORM_HANDLES.resourceUrlInput(1))).toHaveValue(
      "https://example.com",
    );
  });
});
