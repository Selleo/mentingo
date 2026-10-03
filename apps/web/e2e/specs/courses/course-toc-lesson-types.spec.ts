import { USER_ROLE } from "~/config/userRoles";

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

  const enrollmentFactory = factories.createEnrollmentFactory();

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);
      await openCourseOverviewFlow(page, courseId);
      await page.getByTestId(`${prefix}-chapter`).click();

      const lessonLink = page.getByRole("link", { name: new RegExp(lessons.firstLesson.title) });
      await expect(lessonLink).toHaveText(lessons.firstLesson.title);
      await expect(lessonLink.getByTestId("lesson-title")).toHaveText(lessons.firstLesson.title);

      await lessonLink.getByRole("img", { name: "Content" }).hover();
      await expect(page.getByRole("tooltip")).toHaveText("Content");

      await lessonLink.click();
      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${lessons.firstLesson.id}$`));
    },
    { root: true },
  );
});
