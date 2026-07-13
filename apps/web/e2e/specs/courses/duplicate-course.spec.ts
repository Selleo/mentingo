import { USER_ROLE } from "~/config/userRoles";

import { COURSES_PAGE_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCoursesPageFlow } from "../../flows/courses/open-courses-page.flow";

test("admin can duplicate a course and the new course keeps the source curriculum", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      const categoryFactory = factories.createCategoryFactory();
      const courseFactory = factories.createCourseFactory();
      const curriculumFactory = factories.createCurriculumFactory();

      const category = await categoryFactory.create(`duplicate-course-category-${Date.now()}`);
      const sourceCourse = await courseFactory.create({
        title: `duplicate-course-source-${Date.now()}`,
        categoryId: category.id,
      });
      const chapter = await curriculumFactory.createChapter({
        courseId: sourceCourse.id,
        title: `duplicate-course-chapter-${Date.now()}`,
      });
      await curriculumFactory.createContentLesson(sourceCourse.id, {
        chapterId: chapter.id,
        title: `duplicate-course-lesson-${Date.now()}`,
        displayOrder: 1,
      });

      let newCourseId = "";

      cleanup.add(async () => {
        if (newCourseId) await courseFactory.delete(newCourseId);
        await courseFactory.delete(sourceCourse.id);
        await categoryFactory.delete(category.id);
      });

      await openCoursesPageFlow(page);
      await page.getByTestId(COURSES_PAGE_HANDLES.rowDuplicateButton(sourceCourse.id)).click();

      await expect(page).toHaveURL(/\/admin\/beta-courses\/[^/?]+/);

      const duplicatedUrl = new URL(page.url());
      newCourseId = duplicatedUrl.pathname.split("/").pop() ?? "";
      const jobId = duplicatedUrl.searchParams.get("duplicationJobId");
      if (!newCourseId) {
        throw new Error("Expected duplication navigation to include the new course id");
      }

      if (jobId) {
        await expect
          .poll(
            async () => {
              const jobStatus = await courseFactory.getDuplicationJobStatus(jobId);
              return jobStatus.state;
            },
            { timeout: 30_000 },
          )
          .toBe("completed");
      }

      const sourceCourseDetails = await courseFactory.getById(sourceCourse.id);
      await expect
        .poll(
          async () => {
            const course = await courseFactory.getById(newCourseId);
            return course.chapters.length > 0 && Boolean(course.chapters[0]?.lessons?.length);
          },
          { timeout: 30_000 },
        )
        .toBe(true);
      const duplicatedCourseDetails = await courseFactory.getById(newCourseId);

      expect(
        duplicatedCourseDetails.chapters.map((duplicatedChapter) => duplicatedChapter.title),
      ).toEqual(sourceCourseDetails.chapters.map((sourceChapter) => sourceChapter.title));
      expect(duplicatedCourseDetails.chapters[0]?.lessons?.map((lesson) => lesson.title)).toEqual(
        sourceCourseDetails.chapters[0]?.lessons?.map((lesson) => lesson.title),
      );
    },
    { root: true },
  );
});
