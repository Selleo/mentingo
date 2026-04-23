import { USER_ROLE } from "~/config/userRoles";

import { CURRICULUM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { createChapterFlow } from "../../flows/curriculum/create-chapter.flow";
import { deleteChapterFlow } from "../../flows/curriculum/delete-chapter.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { updateChapterFlow } from "../../flows/curriculum/update-chapter.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

test("admin can create, update, and delete a chapter", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-structure-${Date.now()}`,
    );
    const chapterTitle = `chapter-${Date.now()}`;
    const updatedChapterTitle = `updated-chapter-${Date.now()}`;

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCurriculumPageFlow(page, course.id);
    await createChapterFlow(page, chapterTitle);

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.chapters.find((chapter) => chapter.title === chapterTitle)?.id ?? null;
      })
      .not.toBeNull();

    const createdCourse = await courseFactory.getById(course.id);
    const chapterId = createdCourse.chapters.find((chapter) => chapter.title === chapterTitle)!.id;

    await updateChapterFlow(page, chapterId, updatedChapterTitle);
    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.chapters.find((chapter) => chapter.id === chapterId)?.title;
      })
      .toBe(updatedChapterTitle);

    await deleteChapterFlow(page, chapterId);
    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.chapters.some((chapter) => chapter.id === chapterId);
      })
      .toBe(false);
  });
});

test("admin can reorder chapters", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-reorder-chapters-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const firstChapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `first-chapter-${Date.now()}`,
    });
    const secondChapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `second-chapter-${Date.now()}`,
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCurriculumPageFlow(page, course.id);
    await page
      .getByTestId(CURRICULUM_HANDLES.chapterDragHandle(secondChapter.id))
      .dragTo(page.getByTestId(CURRICULUM_HANDLES.chapterDragHandle(firstChapter.id)));

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.chapters.map((chapter) => chapter.id);
      })
      .toEqual([secondChapter.id, firstChapter.id]);
  });
});
