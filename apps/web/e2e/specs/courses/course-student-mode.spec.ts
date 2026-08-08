import { USER_ROLE } from "~/config/userRoles";

import { expect, test } from "../../fixtures/test.fixture";
import { toggleCourseStudentModeFlow } from "../../flows/courses/toggle-course-student-mode.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";

test("admin can toggle student mode from course preview", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const curriculumFactory = factories.createCurriculumFactory();
    const category = await categoryFactory.create(`Student Mode Course Category ${Date.now()}`);
    const course = await courseFactory.create({
      title: `student-mode-course-${Date.now()}`,
      categoryId: category.id,
      status: "private",
    });
    await courseFactory.updateSettings(course.id, { lessonSequenceEnabled: false });
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `student-mode-chapter-${Date.now()}`,
    });
    const firstLesson = await curriculumFactory.createContentLesson(course.id, {
      chapterId: chapter.id,
      title: `student-mode-first-lesson-${Date.now()}`,
    });
    const secondLesson = await curriculumFactory.createContentLesson(course.id, {
      chapterId: chapter.id,
      title: `student-mode-second-lesson-${Date.now()}`,
    });

    cleanup.add(async () => {
      await courseFactory.setStudentMode(course.id, false);
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCourseOverviewFlow(page, course.id);
    await expect(page).toHaveURL(/\/course\//);
    await expect(page).not.toHaveURL(/\/auth\/login/);

    await toggleCourseStudentModeFlow(page);

    await expect
      .poll(async () => {
        const studentModeCourseIds = await courseFactory.getCurrentUserStudentModeCourseIds();
        return studentModeCourseIds.includes(course.id);
      })
      .toBe(true);

    await page.getByRole("button", { name: new RegExp(chapter.title) }).click();
    await expect(page.getByRole("link", { name: new RegExp(firstLesson.title) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(secondLesson.title) })).toBeVisible();
    await expect(page.getByText("Blocked")).toHaveCount(0);
    await page.getByRole("link", { name: new RegExp(firstLesson.title) }).click();
    await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${firstLesson.id}$`));
  });
});
