import { COURSE_TYPE } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import {
  COURSE_SETTINGS_HANDLES,
  COURSE_TAB_VALUES,
  COURSES_PAGE_HANDLES,
  CREATE_SCORM_COURSE_PAGE_HANDLES,
  EDIT_COURSE_PAGE_HANDLES,
} from "../../data/courses/handles";
import { SCORM_TEST_DATA } from "../../data/scorm/scorm.data";
import { expect, test } from "../../fixtures/test.fixture";
import { createScormCourseFlow } from "../../flows/courses/create-scorm-course.flow";
import { filterCoursesFlow } from "../../flows/courses/filter-courses.flow";
import { openCoursesPageFlow } from "../../flows/courses/open-courses-page.flow";
import { openEditCoursePageFlow } from "../../flows/courses/open-edit-course-page.flow";

test("admin can import a SCORM course and gets generated chapters and lessons", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`SCORM Course Category ${Date.now()}`);
    const title = `scorm-course-${Date.now()}`;

    cleanup.add(async () => {
      const createdCourse = await courseFactory.findByTitle(title);
      if (createdCourse) {
        await courseFactory.delete(createdCourse.id);
      }
      await categoryFactory.delete(category.id);
    });

    await createScormCourseFlow(page, {
      title,
      categoryTitle: category.title,
      packagePath: SCORM_TEST_DATA.files.multiScoPackage,
    });

    await expect
      .poll(async () => (await courseFactory.findByTitle(title))?.id ?? null, { timeout: 30_000 })
      .not.toBeNull();
    const listedCourse = await courseFactory.findByTitle(title);
    const createdCourse = await courseFactory.getById(listedCourse?.id ?? "");

    expect(createdCourse.courseType).toBe(COURSE_TYPE.SCORM);
    expect(createdCourse.chapters).toHaveLength(2);
    expect(createdCourse.chapters.every((chapter) => chapter.lessons?.[0]?.type === "scorm")).toBe(
      true,
    );

    await openEditCoursePageFlow(page, createdCourse.id);
    await expect(page.getByTestId(EDIT_COURSE_PAGE_HANDLES.COURSE_TYPE_BADGE)).toBeVisible();
  });
});

test("admin cannot submit an invalid SCORM course package", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Invalid SCORM Category ${Date.now()}`);
    const title = `invalid-scorm-course-${Date.now()}`;

    cleanup.add(async () => {
      const createdCourse = await courseFactory.findByTitle(title);
      if (createdCourse) {
        await courseFactory.delete(createdCourse.id);
      }
      await categoryFactory.delete(category.id);
    });

    await createScormCourseFlow(page, {
      title,
      categoryTitle: category.title,
      packagePath: SCORM_TEST_DATA.files.invalidPackage,
    });

    await expect(page.getByTestId(CREATE_SCORM_COURSE_PAGE_HANDLES.PAGE)).toBeVisible();
    await expect.poll(async () => courseFactory.findByTitle(title), { timeout: 10_000 }).toBeNull();
  });
});

test("SCORM courses hide unsupported admin course features", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`SCORM Restrictions Category ${Date.now()}`);
    const course = await courseFactory.create({
      title: `scorm-restrictions-${Date.now()}`,
      categoryId: category.id,
      isScorm: true,
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCoursesPageFlow(page);
    await filterCoursesFlow(page, { title: course.title });
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.rowTypeBadge(course.id))).toHaveAttribute(
      "data-course-type",
      COURSE_TYPE.SCORM,
    );

    await openEditCoursePageFlow(page, course.id);
    await expect(
      page.getByTestId(EDIT_COURSE_PAGE_HANDLES.tab(COURSE_TAB_VALUES.CURRICULUM)),
    ).toHaveCount(0);
    await expect(page.getByTestId(COURSE_SETTINGS_HANDLES.LESSON_SEQUENCE_SWITCH)).toHaveCount(0);
    await expect(page.getByTestId(COURSE_SETTINGS_HANDLES.QUIZ_FEEDBACK_SWITCH)).toHaveCount(0);
    await expect(
      page.getByTestId(COURSE_SETTINGS_HANDLES.VIDEO_COMPLETION_TRACKING_SWITCH),
    ).toHaveCount(0);
  });
});
