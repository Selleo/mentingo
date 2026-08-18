import { DASHBOARD_WIDGET_SIZES, DASHBOARD_WIDGET_TYPES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { DASHBOARD_WIDGET_HANDLES } from "../../data/dashboard/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openDashboardFlow } from "../../flows/dashboard/open-dashboard.flow";
import { setDashboardWidgets } from "../../utils/dashboard-settings";

import type { CreateIsolatedWorkspace } from "../../fixtures/test.fixture";

const createStudentDashboardScenario = async (createIsolatedWorkspace: CreateIsolatedWorkspace) => {
  const workspace = await createIsolatedWorkspace();
  const student = await workspace.createTenantUserWithPasswordAndRole({
    role: USER_ROLE.student,
    firstName: "Dashboard",
    lastName: "Student",
  });
  const categoryFactory = workspace.factories.createCategoryFactory();
  const courseFactory = workspace.factories.createCourseFactory();
  const curriculumFactory = workspace.factories.createCurriculumFactory();
  const groupFactory = workspace.factories.createGroupFactory();
  const enrollmentFactory = workspace.factories.createEnrollmentFactory();
  const category = await categoryFactory.create(`Dashboard category ${Date.now()}`);
  const course = await courseFactory.create({
    title: `Dashboard course ${Date.now()}`,
    categoryId: category.id,
    hasCertificate: true,
  });
  const chapter = await curriculumFactory.createChapter({
    courseId: course.id,
    title: "Dashboard chapter",
  });
  const firstLesson = await curriculumFactory.createContentLesson(course.id, {
    chapterId: chapter.id,
    title: "First dashboard lesson",
  });
  const nextLesson = await curriculumFactory.createContentLesson(course.id, {
    chapterId: chapter.id,
    title: "Next dashboard lesson",
  });
  await courseFactory.update(course.id, { status: "published", language: "en" });
  const group = await groupFactory.create({ name: `Dashboard group ${Date.now()}` });
  await workspace.factories.createUserFactory().update(student.user.id, {
    groups: [group.id],
  });
  await enrollmentFactory.enrollGroups(course.id, [
    {
      id: group.id,
      isMandatory: true,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);
  await student.apiClient.api.studentLessonProgressControllerMarkLessonAsCompleted({
    id: firstLesson.id,
    language: "en",
  });

  return { course, nextLesson, student };
};

test.describe("student dashboard widgets", () => {
  test("shows continue learning and the next lesson from real enrollment progress", async ({
    createIsolatedWorkspace,
  }) => {
    const { course, nextLesson, student } =
      await createStudentDashboardScenario(createIsolatedWorkspace);
    await setDashboardWidgets(student.apiClient, [
      {
        type: DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING,
        size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
      },
    ]);

    await openDashboardFlow(student.page, student.origin);

    const widget = student.page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CONTINUE_LEARNING);
    await expect(widget).toBeVisible();
    await expect(widget.getByRole("heading", { name: "Continue learning" })).toBeVisible();
    await expect(widget.getByRole("heading", { name: course.title })).toBeVisible();
    await expect(widget.getByText(`Next: ${nextLesson.title}`)).toBeVisible();
  });

  test("shows required-course urgency from a real mandatory group deadline", async ({
    createIsolatedWorkspace,
  }) => {
    const { course, student } = await createStudentDashboardScenario(createIsolatedWorkspace);
    await setDashboardWidgets(student.apiClient, [
      {
        type: DASHBOARD_WIDGET_TYPES.REQUIRED_COURSES,
        size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
      },
    ]);

    await openDashboardFlow(student.page, student.origin);

    const widget = student.page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_REQUIRED_COURSE);
    await expect(widget).toBeVisible();
    await expect(widget.getByRole("heading", { name: "Required courses" })).toBeVisible();
    await expect(widget.getByRole("heading", { name: course.title })).toBeVisible();
    await expect(widget.getByText("Due soon", { exact: true })).toBeVisible();
  });

  test("shows course-completion totals from the real student enrollment", async ({
    createIsolatedWorkspace,
  }) => {
    const { student } = await createStudentDashboardScenario(createIsolatedWorkspace);
    await setDashboardWidgets(student.apiClient, [
      {
        type: DASHBOARD_WIDGET_TYPES.COURSE_COMPLETION,
        size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
      },
    ]);

    await openDashboardFlow(student.page, student.origin);

    const widget = student.page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_COURSE_COMPLETION);
    await expect(widget).toBeVisible();
    await expect(widget.getByRole("heading", { name: "Course progress" })).toBeVisible();
    await expect(widget.getByRole("img", { name: "0 of 1 completed" })).toBeVisible();
  });
});
