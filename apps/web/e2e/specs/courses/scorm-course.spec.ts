import { COURSE_TYPE } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import {
  COURSE_SETTINGS_HANDLES,
  COURSE_TAB_VALUES,
  COURSE_TYPE_SELECTOR_HANDLES,
  COURSES_PAGE_HANDLES,
  CREATE_SCORM_COURSE_PAGE_HANDLES,
  EDIT_COURSE_PAGE_HANDLES,
} from "../../data/courses/handles";
import { SCORM_TEST_DATA } from "../../data/scorm/scorm.data";
import { expect, test } from "../../fixtures/test.fixture";
import { fillCreateScormCourseFormFlow } from "../../flows/courses/fill-create-scorm-course-form.flow";
import { openCoursesPageFlow } from "../../flows/courses/open-courses-page.flow";
import { openCreateCourseTypeSelectorFlow } from "../../flows/courses/open-create-course-type-selector.flow";
import { openCreateScormCoursePageFlow } from "../../flows/courses/open-create-scorm-course-page.flow";
import { openEditCoursePageFlow } from "../../flows/courses/open-edit-course-page.flow";
import { submitCreateScormCourseFormFlow } from "../../flows/courses/submit-create-scorm-course-form.flow";

const createScormCourseFromUi = async (
  page: Parameters<typeof fillCreateScormCourseFormFlow>[0],
  input: {
    categoryTitle: string;
    packagePath: string;
    title: string;
  },
) => {
  await openCreateScormCoursePageFlow(page);
  await fillCreateScormCourseFormFlow(page, {
    title: input.title,
    categoryTitle: input.categoryTitle,
    language: "en",
    description: `Description for ${input.title}`,
    packagePath: input.packagePath,
  });
  await expect(page.getByTestId(CREATE_SCORM_COURSE_PAGE_HANDLES.SUBMIT_BUTTON)).toBeEnabled();
  await submitCreateScormCourseFormFlow(page);
};

test("admin can choose between standard and SCORM course creation", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    await openCreateCourseTypeSelectorFlow(page);

    await expect(page.getByTestId(COURSE_TYPE_SELECTOR_HANDLES.STANDARD_CARD)).toBeVisible();
    await expect(page.getByTestId(COURSE_TYPE_SELECTOR_HANDLES.SCORM_CARD)).toBeVisible();

    await page.getByTestId(COURSE_TYPE_SELECTOR_HANDLES.SCORM_CARD).click();
    await expect(page.getByTestId(CREATE_SCORM_COURSE_PAGE_HANDLES.PAGE)).toBeVisible();
  });
});

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

    await createScormCourseFromUi(page, {
      title,
      categoryTitle: category.title,
      packagePath: SCORM_TEST_DATA.files.multiScoPackage,
    });

    const courseId = await expect
      .poll(async () => (await courseFactory.findByTitle(title))?.id ?? null, { timeout: 30_000 })
      .not.toBeNull()
      .then(async () => (await courseFactory.findByTitle(title))!.id);

    const createdCourse = await courseFactory.getById(courseId);

    expect(createdCourse.courseType).toBe(COURSE_TYPE.SCORM);
    expect(createdCourse.chapters).toHaveLength(2);
    expect(createdCourse.chapters.every((chapter) => chapter.lessons?.[0]?.type === "scorm")).toBe(
      true,
    );

    await expect(page).toHaveURL(new RegExp(`/admin/beta-courses/${courseId}`));
    await expect(page.getByTestId(EDIT_COURSE_PAGE_HANDLES.COURSE_TYPE_BADGE)).toHaveText("SCORM");
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

    await createScormCourseFromUi(page, {
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
    const title = `scorm-restrictions-${Date.now()}`;

    cleanup.add(async () => {
      const createdCourse = await courseFactory.findByTitle(title);
      if (createdCourse) {
        await courseFactory.delete(createdCourse.id);
      }
      await categoryFactory.delete(category.id);
    });

    await createScormCourseFromUi(page, {
      title,
      categoryTitle: category.title,
      packagePath: SCORM_TEST_DATA.files.singleScoPackage,
    });

    const course = await expect
      .poll(async () => courseFactory.findByTitle(title), { timeout: 30_000 })
      .not.toBeNull()
      .then(async () => (await courseFactory.findByTitle(title))!);

    await openCoursesPageFlow(page);
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.rowTypeBadge(course.id))).toHaveText(
      "SCORM",
    );

    await openEditCoursePageFlow(page, course.id, COURSE_TAB_VALUES.CURRICULUM);
    await expect(
      page.getByTestId(EDIT_COURSE_PAGE_HANDLES.tab(COURSE_TAB_VALUES.CURRICULUM)),
    ).toHaveCount(0);
    await expect(page.getByTestId(COURSE_SETTINGS_HANDLES.LESSON_SEQUENCE_SWITCH)).toHaveCount(0);
    await expect(page.getByTestId(COURSE_SETTINGS_HANDLES.QUIZ_FEEDBACK_SWITCH)).toHaveCount(0);
  });
});
