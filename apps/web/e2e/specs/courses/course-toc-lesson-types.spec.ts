import { USER_ROLE } from "~/config/userRoles";

import { COURSE_TOC_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { createTwoContentLessonsCourse } from "../learning/learning-test-helpers";

test("course table of contents shows lesson types on icon hover, not below titles", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const prefix = `course-toc-type-${Date.now()}`;
  const { courseId, lessons } = await createTwoContentLessonsCourse({
    cleanup,
    factories,
    prefix,
    withWorkerPage,
  });
  const [chapter] = (await factories.createCurriculumFactory().getCourse(courseId)).chapters;
  const enrollmentFactory = factories.createEnrollmentFactory();

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);
      await openCourseOverviewFlow(page, courseId);
      await page.getByTestId(COURSE_TOC_HANDLES.chapter(chapter.id)).click();

      const lesson = page.getByTestId(COURSE_TOC_HANDLES.lesson(lessons.firstLesson.id));
      await expect(lesson.getByTestId(COURSE_TOC_HANDLES.LESSON_TITLE)).toHaveText(
        lessons.firstLesson.title,
      );

      await page.getByTestId(COURSE_TOC_HANDLES.lessonTypeIcon(lessons.firstLesson.id)).hover();
      await expect(page.getByRole("tooltip")).toBeVisible();

      await lesson.click();
      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${lessons.firstLesson.id}$`));
    },
    { root: true },
  );
});
