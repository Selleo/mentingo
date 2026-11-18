import { USER_ROLE } from "~/config/userRoles";

import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import { CURRICULUM_HANDLES, EMBED_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillEmbedLessonFormFlow } from "../../flows/curriculum/fill-embed-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openExistingLessonFlow } from "../../flows/curriculum/open-existing-lesson.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveEmbedLessonFormFlow } from "../../flows/curriculum/save-embed-lesson-form.flow";

import { arrangeCurriculumChapter } from "./curriculum-test-helpers";

// Keep both embeds in one chapter: React reuses the same editor between selections.
test("admin can switch between embed lessons and save only the selected lesson", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { course, chapter } = await arrangeCurriculumChapter({
      cleanup,
      factories,
      title: `curriculum-embed-switch-${Date.now()}`,
    });
    const curriculum = factories.createCurriculumFactory();
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
        page.getByTestId(EMBED_LESSON_FORM_HANDLES.resourceCard(resources.length - 1)),
      ).toBeVisible();
      await expect(
        page.getByTestId(EMBED_LESSON_FORM_HANDLES.resourceCard(resources.length)),
      ).toHaveCount(0);
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
    // Read back through the authoring endpoint used by this editor.
    const savedCourse = await curriculum.getCourse(course.id);
    const saved = savedCourse.chapters.find((item) => item.id === chapter.id);
    expect(saved).toBeDefined();
    expect(saved?.lessons?.find((lesson) => lesson.id === first.id)?.title).toBe(first.title);
    expect(saved?.lessons?.find((lesson) => lesson.id === second.id)?.title).toBe(
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

test("admin can create an embed lesson with YouTube and external resources", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const prefix = `curriculum-embed-${Date.now()}`;
    const { course, chapter } = await arrangeCurriculumChapter({
      cleanup,
      factories,
      title: prefix,
    });
    const curriculumFactory = factories.createCurriculumFactory();
    const lessonTitle = `${prefix}-lesson`;
    const resourceUrls = [CURRICULUM_TEST_DATA.youtubeVideoUrl, "https://example.com"];

    await openCurriculumPageFlow(page, course.id);
    await openNewLessonFormFlow(page, chapter.id, "embed");
    await fillEmbedLessonFormFlow(page, { title: lessonTitle, resources: resourceUrls });
    await saveEmbedLessonFormFlow(page);

    await expect
      .poll(
        async () => (await curriculumFactory.findCourseLessonByTitle(course.id, lessonTitle))?.type,
      )
      .toBe("embed");
    const lesson = await curriculumFactory.findCourseLessonByTitle(course.id, lessonTitle);

    await page.reload();
    await openExistingLessonFlow(page, chapter.id, lesson?.id ?? "");
    for (const [index, resourceUrl] of resourceUrls.entries()) {
      await expect(page.getByTestId(EMBED_LESSON_FORM_HANDLES.resourceUrlInput(index))).toHaveValue(
        resourceUrl,
      );
    }
  });
});
