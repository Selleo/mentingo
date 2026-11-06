import { USER_ROLE } from "~/config/userRoles";

import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import { CURRICULUM_HANDLES, EMBED_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillEmbedLessonFormFlow } from "../../flows/curriculum/fill-embed-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

// Keep both embeds in one chapter: React reuses the same editor between selections.
test("admin can switch between embed lessons and save only the selected lesson", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-embed-switch-${Date.now()}`,
    );
    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });
    const curriculum = factories.createCurriculumFactory();
    const chapter = await curriculum.createChapter({ courseId: course.id });
    const firstResources = [{ fileUrl: "https://example.com/first", allowFullscreen: false }];
    const secondResources = [
      { fileUrl: "https://example.com/second", allowFullscreen: true },
      { fileUrl: "https://example.com/extra", allowFullscreen: false },
    ];
    const first = await curriculum.createEmbedLesson(course.id, {
      chapterId: chapter.id,
      title: "First embed",
      type: "embed",
      resources: firstResources,
    });
    const second = await curriculum.createEmbedLesson(course.id, {
      chapterId: chapter.id,
      title: "Second embed",
      type: "embed",
      resources: secondResources,
    });
    await openCurriculumPageFlow(page, course.id);
    await page.getByTestId(CURRICULUM_HANDLES.chapterAccordion(chapter.id)).click();
    await expect(page.getByTestId(CURRICULUM_HANDLES.chapterAccordion(chapter.id))).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const title = page.getByTestId(EMBED_LESSON_FORM_HANDLES.TITLE_INPUT);
    for (const lesson of [first, second, first, second]) {
      await page.getByTestId(CURRICULUM_HANDLES.lessonCard(lesson.id)).click();
      await expect(title).toHaveValue(lesson.title);
      const resources = lesson.id === first.id ? firstResources : secondResources;
      await expect(
        page
          .getByTestId(EMBED_LESSON_FORM_HANDLES.ROOT)
          .locator('[data-testid^="curriculum-embed-resource-card-"]'),
      ).toHaveCount(resources.length);
      for (const [index, resource] of resources.entries()) {
        await expect(
          page.getByTestId(EMBED_LESSON_FORM_HANDLES.resourceUrlInput(index)),
        ).toHaveValue(resource.fileUrl);
        await expect(
          page.getByTestId(EMBED_LESSON_FORM_HANDLES.resourceFullscreenCheckbox(index)),
        ).toHaveAttribute("aria-checked", String(resource.allowFullscreen));
      }
    }
    await title.fill("Second embed updated");
    await page.getByTestId(EMBED_LESSON_FORM_HANDLES.SAVE_BUTTON).click();
    await expect(page.getByTestId(EMBED_LESSON_FORM_HANDLES.ROOT)).toBeHidden();
    const saved = await curriculum.getChapter(chapter.id);
    expect(saved.lessons.find((lesson) => lesson.id === first.id)?.title).toBe(first.title);
    expect(saved.lessons.find((lesson) => lesson.id === second.id)?.title).toBe(
      "Second embed updated",
    );
    await page.reload();
    await page.getByTestId(CURRICULUM_HANDLES.chapterAccordion(chapter.id)).click();
    await expect(page.getByTestId(CURRICULUM_HANDLES.chapterAccordion(chapter.id))).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await page.getByTestId(CURRICULUM_HANDLES.lessonCard(second.id)).click();
    await expect(title).toHaveValue("Second embed updated");
    await expect(page.getByTestId(EMBED_LESSON_FORM_HANDLES.resourceUrlInput(0))).toHaveValue(
      secondResources[0].fileUrl,
    );
  });
});

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
