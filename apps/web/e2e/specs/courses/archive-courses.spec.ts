import { USER_ROLE } from "~/config/userRoles";

import {
  COURSE_OVERVIEW_HANDLES,
  COURSE_SETTINGS_HANDLES,
  COURSE_TAB_VALUES,
  COURSES_PAGE_HANDLES,
} from "../../data/courses/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import {
  cancelCourseArchiveDialogFlow,
  confirmCourseArchiveDialogFlow,
} from "../../flows/courses/confirm-course-archive-dialog.flow";
import { filterCoursesFlow } from "../../flows/courses/filter-courses.flow";
import { openCourseArchiveDialogFlow } from "../../flows/courses/open-course-archive-dialog.flow";
import {
  openCourseOverviewSettingsFlow,
  selectCourseOverviewSettingsTabFlow,
} from "../../flows/courses/open-course-overview-settings.flow";
import { openCoursesPageFlow } from "../../flows/courses/open-courses-page.flow";
import { selectCoursesFlow } from "../../flows/courses/select-courses.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";

test("admin can archive and restore courses from bulk actions", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Archive Course Category ${Date.now()}`);
    const prefix = `archive-course-${Date.now()}`;
    const courses = await courseFactory.createMany(2, (index) => ({
      title: `${prefix}-${index}`,
      categoryId: category.id,
      status: "draft",
    }));
    const courseIds = courses.map((course) => course.id);
    const [firstCourse, secondCourse] = courses;

    cleanup.add(async () => {
      await courseFactory.deleteMany(courseIds);
      await categoryFactory.delete(category.id);
    });

    await openCoursesPageFlow(page);
    await filterCoursesFlow(page, { title: prefix });
    await selectCoursesFlow(page, courseIds);

    await openCourseArchiveDialogFlow(page, { action: "archive" });
    await cancelCourseArchiveDialogFlow(page);
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.ARCHIVE_DIALOG)).toBeHidden();
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(firstCourse.id))).toBeVisible();
    await expect.poll(() => courseFactory.isArchived(firstCourse.id)).toBe(false);

    await openCourseArchiveDialogFlow(page, { action: "archive" });
    await confirmCourseArchiveDialogFlow(page);

    for (const course of courses) {
      await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(course.id))).toBeHidden();
    }
    await expect
      .poll(() => Promise.all(courseIds.map((id) => courseFactory.isArchived(id))))
      .toEqual([true, true]);

    await filterCoursesFlow(page, { archivedStatus: "archived" });
    for (const course of courses) {
      await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(course.id))).toBeVisible();
    }

    await selectCoursesFlow(page, courseIds);
    await openCourseArchiveDialogFlow(page, { action: "restore" });
    await confirmCourseArchiveDialogFlow(page);

    for (const course of courses) {
      await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(course.id))).toBeHidden();
    }
    await filterCoursesFlow(page, { archivedStatus: "active" });
    for (const course of courses) {
      await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(course.id))).toBeVisible();
    }

    await openCourseArchiveDialogFlow(page, { action: "archive", rowCourseId: firstCourse.id });
    await confirmCourseArchiveDialogFlow(page);
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(firstCourse.id))).toBeHidden();

    await filterCoursesFlow(page, { archivedStatus: "archived" });
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(firstCourse.id))).toBeVisible();
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(secondCourse.id))).toBeHidden();

    await openCourseArchiveDialogFlow(page, { action: "restore", rowCourseId: firstCourse.id });
    await confirmCourseArchiveDialogFlow(page);
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.row(firstCourse.id))).toBeHidden();
  });
});

test("admin can archive and restore a course from its settings, and enrolled learners retain access", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const categoryFactory = factories.createCategoryFactory();
  const courseFactory = factories.createCourseFactory();
  const curriculumFactory = factories.createCurriculumFactory();
  const prefix = `archive-learner-course-${Date.now()}`;
  let courseId = "";
  let lessonTitle = "";

  await withWorkerPage(USER_ROLE.admin, async () => {
    const category = await categoryFactory.create(`Archive Learner Category ${Date.now()}`);
    const course = await courseFactory.create({
      title: prefix,
      categoryId: category.id,
      status: "draft",
    });
    courseId = course.id;

    cleanup.add(async () => {
      await withWorkerPage(USER_ROLE.admin, async () => {
        await courseFactory.delete(course.id);
        await categoryFactory.delete(category.id);
      });
    });

    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `${prefix}-chapter`,
    });
    const lesson = await curriculumFactory.createContentLesson(course.id, {
      chapterId: chapter.id,
      title: `${prefix}-lesson`,
    });
    lessonTitle = lesson.title;
    await courseFactory.update(course.id, { status: "published", language: "en" });
  });

  await withWorkerPage(USER_ROLE.student, async () => {
    await factories.createEnrollmentFactory().selfEnroll(courseId);
  });

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openCourseOverviewSettingsFlow(page, courseId);
    await selectCourseOverviewSettingsTabFlow(page, COURSE_TAB_VALUES.STATUS);

    const archiveButton = page.getByTestId(COURSE_SETTINGS_HANDLES.ARCHIVE_ACTION_BUTTON);
    await archiveButton.click();
    await expect(page.getByTestId(COURSE_SETTINGS_HANDLES.ARCHIVE_CONFIRM_DIALOG)).toBeVisible();
    await page.getByTestId(COURSE_SETTINGS_HANDLES.ARCHIVE_CANCEL_BUTTON).click();
    await expect(page.getByTestId(COURSE_SETTINGS_HANDLES.ARCHIVE_CONFIRM_DIALOG)).toBeHidden();
    await expect.poll(() => courseFactory.isArchived(courseId)).toBe(false);

    await archiveButton.click();
    await page.getByTestId(COURSE_SETTINGS_HANDLES.ARCHIVE_CONFIRM_BUTTON).click();
    await expect.poll(() => courseFactory.isArchived(courseId)).toBe(true);
  });

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await openCourseOverviewFlow(page, courseId);
    await page.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON).click();
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(lessonTitle);
  });

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openCourseOverviewSettingsFlow(page, courseId);
    await selectCourseOverviewSettingsTabFlow(page, COURSE_TAB_VALUES.STATUS);
    await page.getByTestId(COURSE_SETTINGS_HANDLES.ARCHIVE_ACTION_BUTTON).click();
    await expect.poll(() => courseFactory.isArchived(courseId)).toBe(false);
  });
});
