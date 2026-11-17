import { USER_ROLE } from "~/config/userRoles";

import { CONTENT_LESSON_RESOURCE_CASES } from "../../data/curriculum/content-lesson-resources.data";
import { CURRICULUM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillContentLessonFormFlow } from "../../flows/curriculum/fill-content-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveContentLessonFormFlow } from "../../flows/curriculum/save-content-lesson-form.flow";

import { arrangeCurriculumChapter } from "./curriculum-test-helpers";

for (const resourceCase of CONTENT_LESSON_RESOURCE_CASES) {
  test(`admin can save content lesson with ${resourceCase.name}`, async ({
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const prefix = `curriculum-resource-${Date.now()}`;
      const { course, chapter } = await arrangeCurriculumChapter({
        cleanup,
        factories,
        title: prefix,
      });
      const curriculumFactory = factories.createCurriculumFactory();
      const lessonTitle = `${prefix}-lesson`;

      await openCurriculumPageFlow(page, course.id);
      await openNewLessonFormFlow(page, chapter.id, "content");
      await fillContentLessonFormFlow(page, {
        title: lessonTitle,
        description: `Resource lesson ${prefix}`,
      });
      await resourceCase.insert(page);
      await saveContentLessonFormFlow(page);

      await expect
        .poll(async () => {
          const lesson = await curriculumFactory.findCourseLessonByTitle(course.id, lessonTitle);

          return [...(lesson?.description ?? "").matchAll(/data-node-type="([^"]+)"/g)]
            .map(([, nodeType]) => nodeType)
            .sort();
        })
        .toEqual([...resourceCase.nodeTypes].sort());

      const lesson = await curriculumFactory.findCourseLessonByTitle(course.id, lessonTitle);
      await expect(page.getByTestId(CURRICULUM_HANDLES.lessonTitle(lesson?.id ?? ""))).toHaveText(
        lessonTitle,
      );
    });
  });
}
