import { USER_ROLE } from "~/config/userRoles";

import { COURSE_TOC_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { createPublishedLearningCourse } from "../../utils/learning-courses";

test("course table of contents shows lesson types on icon hover, not below titles", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const prefix = `course-toc-type-${Date.now()}`;
  const { chapterId, courseId, lessons } = await createPublishedLearningCourse({
    cleanup,
    factories,
    prefix,
    withWorkerPage,
    buildLessons: async ({ courseId, chapterId, curriculumFactory, prefix }) => [
      await curriculumFactory.createContentLesson(courseId, {
        chapterId,
        title: `${prefix}-first-lesson`,
        displayOrder: 1,
      }),
      await curriculumFactory.createQuizLesson(courseId, {
        chapterId,
        title: `${prefix}-second-lesson`,
        displayOrder: 2,
        questions: [{ type: "brief_response", title: `${prefix}-question`, displayOrder: 1 }],
      }),
    ],
  });
  const enrollmentFactory = factories.createEnrollmentFactory();

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);
      await openCourseOverviewFlow(page, courseId);
      await page.getByTestId(COURSE_TOC_HANDLES.chapter(chapterId)).click();

      for (const lesson of lessons) {
        const lessonRow = page.getByTestId(COURSE_TOC_HANDLES.lesson(lesson.id));
        await expect(lessonRow.getByTestId(COURSE_TOC_HANDLES.LESSON_TITLE)).toContainText(
          lesson.title,
        );

        await page.getByTestId(COURSE_TOC_HANDLES.lessonTypeIcon(lesson.id)).hover();
        const tooltip = page.getByTestId(COURSE_TOC_HANDLES.lessonTypeTooltip(lesson.id));
        await expect(tooltip).toHaveAttribute("data-lesson-type", lesson.type);

        // The translated type label is shown only in the tooltip, never in the row under the title.
        const typeLabel = (await tooltip.getByRole("tooltip").textContent()) ?? "";
        expect(typeLabel).not.toBe("");
        await expect(lessonRow).not.toContainText(typeLabel);
      }

      const [firstLesson] = lessons;
      await page.getByTestId(COURSE_TOC_HANDLES.lesson(firstLesson.id)).click();
      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${firstLesson.id}$`));
    },
    { root: true },
  );
});
