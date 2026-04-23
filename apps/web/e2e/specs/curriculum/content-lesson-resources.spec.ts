import { existsSync } from "node:fs";

import { USER_ROLE } from "~/config/userRoles";

import { RICH_TEXT_HANDLES } from "../../data/common/handles";
import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import { expect, test } from "../../fixtures/test.fixture";
import { fillContentLessonFormFlow } from "../../flows/curriculum/fill-content-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveContentLessonFormFlow } from "../../flows/curriculum/save-content-lesson-form.flow";
import { uploadContentResourceFlow } from "../../flows/curriculum/upload-content-resource.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

type ResourceCase = {
  name: string;
  path: string;
  displayMode?: "preview" | "download";
};

const resourceCases: ResourceCase[] = [
  { name: "image upload", path: CURRICULUM_TEST_DATA.files.image },
  { name: "video upload through S3", path: CURRICULUM_TEST_DATA.files.video },
  {
    name: "generic file upload as download",
    path: CURRICULUM_TEST_DATA.files.fileDownload,
    displayMode: "download",
  },
  {
    name: "document upload as preview",
    path: CURRICULUM_TEST_DATA.files.documentPreview,
    displayMode: "preview",
  },
  {
    name: "presentation upload as preview",
    path: CURRICULUM_TEST_DATA.files.presentationPreview,
    displayMode: "preview",
  },
  {
    name: "presentation upload as download",
    path: CURRICULUM_TEST_DATA.files.presentationDownload,
    displayMode: "download",
  },
];

for (const resourceCase of resourceCases) {
  const resourceTest = existsSync(resourceCase.path) ? test : test.skip;

  resourceTest(
    `admin can save content lesson with ${resourceCase.name}`,
    async ({ cleanup, factories, withWorkerPage }) => {
      await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
        const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
          factories,
          `curriculum-resource-${Date.now()}`,
        );
        const curriculumFactory = factories.createCurriculumFactory();
        const chapter = await curriculumFactory.createChapter({
          courseId: course.id,
          title: `resource-chapter-${Date.now()}`,
        });
        const lessonTitle = `resource-lesson-${Date.now()}`;

        cleanup.add(async () => {
          await courseFactory.delete(course.id);
          await categoryFactory.delete(category.id);
        });

        await openCurriculumPageFlow(page, course.id);
        await openNewLessonFormFlow(page, chapter.id, "content");
        await fillContentLessonFormFlow(page, {
          title: lessonTitle,
          description: `Resource lesson ${Date.now()}`,
        });
        await uploadContentResourceFlow(page, {
          path: resourceCase.path,
          displayMode: resourceCase.displayMode,
        });
        await expect(page.getByTestId(RICH_TEXT_HANDLES.UPLOAD_QUEUE)).toBeVisible({
          timeout: 30_000,
        });
        await saveContentLessonFormFlow(page);

        await expect
          .poll(async () => {
            const updatedCourse = await courseFactory.getById(course.id);
            return updatedCourse.chapters[0]?.lessons?.some(
              (lesson) => lesson.title === lessonTitle,
            );
          })
          .toBe(true);
      });
    },
  );
}

test("admin can save content lesson with a YouTube video embed", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-youtube-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `youtube-chapter-${Date.now()}`,
    });
    const lessonTitle = `youtube-lesson-${Date.now()}`;

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCurriculumPageFlow(page, course.id);
    await openNewLessonFormFlow(page, chapter.id, "content");
    await fillContentLessonFormFlow(page, {
      title: lessonTitle,
      description: `YouTube lesson ${Date.now()}`,
    });
    await page
      .getByTestId(RICH_TEXT_HANDLES.CONTENT)
      .locator(".ProseMirror")
      .evaluate((element, url) => {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData("text/plain", url);
        const pasteEvent = new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer,
        });
        element.dispatchEvent(pasteEvent);
      }, CURRICULUM_TEST_DATA.youtubeVideoUrl);
    await saveContentLessonFormFlow(page);

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.chapters[0]?.lessons?.some((lesson) => lesson.title === lessonTitle);
      })
      .toBe(true);
  });
});
