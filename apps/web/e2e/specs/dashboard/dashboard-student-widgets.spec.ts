import {
  DASHBOARD_WIDGET_SIZES,
  DASHBOARD_WIDGET_TYPES,
  STUDENT_COURSE_URGENCY,
} from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { DASHBOARD_STUDENT_HANDLES, DASHBOARD_WIDGET_HANDLES } from "../../data/dashboard/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openDashboardFlow } from "../../flows/dashboard/open-dashboard.flow";
import { setDashboardWidgets } from "../../utils/dashboard-settings";

const DAY_MS = 24 * 60 * 60 * 1000;

test("student dashboard widgets reflect real enrollment progress, deadlines and certificates", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace();
  const student = await workspace.createTenantUserWithPasswordAndRole({ role: USER_ROLE.student });
  const courseFactory = workspace.factories.createCourseFactory();
  const curriculumFactory = workspace.factories.createCurriculumFactory();
  const groupFactory = workspace.factories.createGroupFactory();
  const enrollmentFactory = workspace.factories.createEnrollmentFactory();
  const category = await workspace.factories
    .createCategoryFactory()
    .create(`Dashboard category ${Date.now()}`);
  const group = await groupFactory.create({ name: `Dashboard group ${Date.now()}` });
  await workspace.factories.createUserFactory().update(student.user.id, { groups: [group.id] });

  const requiredCourse = await courseFactory.create({
    title: `Dashboard required course ${Date.now()}`,
    categoryId: category.id,
  });
  const requiredChapter = await curriculumFactory.createChapter({
    courseId: requiredCourse.id,
    title: "Dashboard chapter",
  });
  const firstLesson = await curriculumFactory.createContentLesson(requiredCourse.id, {
    chapterId: requiredChapter.id,
    title: "First dashboard lesson",
  });
  const nextLesson = await curriculumFactory.createContentLesson(requiredCourse.id, {
    chapterId: requiredChapter.id,
    title: "Next dashboard lesson",
  });
  await courseFactory.update(requiredCourse.id, { status: "published", language: "en" });

  const certifiedCourse = await courseFactory.create({
    title: `Dashboard certified course ${Date.now()}`,
    categoryId: category.id,
  });
  await courseFactory.updateHasCertificate(certifiedCourse.id, true);
  const certifiedChapter = await curriculumFactory.createChapter({
    courseId: certifiedCourse.id,
    title: "Certified chapter",
  });
  const certifiedLesson = await curriculumFactory.createContentLesson(certifiedCourse.id, {
    chapterId: certifiedChapter.id,
    title: "Only certified lesson",
  });
  await courseFactory.update(certifiedCourse.id, { status: "published", language: "en" });

  await enrollmentFactory.enrollGroups(requiredCourse.id, [
    { id: group.id, isMandatory: true, dueDate: new Date(Date.now() + 2 * DAY_MS).toISOString() },
  ]);
  await enrollmentFactory.enrollGroups(certifiedCourse.id, [{ id: group.id, isMandatory: false }]);
  for (const lesson of [firstLesson, certifiedLesson]) {
    await student.apiClient.api.studentLessonProgressControllerMarkLessonAsCompleted({
      id: lesson.id,
      language: "en",
    });
  }
  await setDashboardWidgets(student.apiClient, [
    { type: DASHBOARD_WIDGET_TYPES.CONTINUE_LEARNING, size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO },
    { type: DASHBOARD_WIDGET_TYPES.REQUIRED_COURSES, size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO },
    { type: DASHBOARD_WIDGET_TYPES.COURSE_COMPLETION, size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO },
    { type: DASHBOARD_WIDGET_TYPES.CERTIFICATES, size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO },
  ]);

  await openDashboardFlow(student.page, student.origin);

  const continueCourse = student.page.getByTestId(
    DASHBOARD_STUDENT_HANDLES.continueCourse(requiredCourse.id),
  );
  await expect(continueCourse).toContainText(requiredCourse.title);
  await expect(
    continueCourse.getByTestId(DASHBOARD_STUDENT_HANDLES.CONTINUE_NEXT_LESSON),
  ).toContainText(nextLesson.title);

  const required = student.page.getByTestId(
    DASHBOARD_STUDENT_HANDLES.requiredCourse(requiredCourse.id),
  );
  await expect(required).toContainText(requiredCourse.title);
  await expect(
    required.getByTestId(
      DASHBOARD_STUDENT_HANDLES.requiredCourseUrgency(STUDENT_COURSE_URGENCY.DUE_SOON),
    ),
  ).toBeVisible();

  await expect(
    student.page
      .getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_COURSE_COMPLETION)
      .getByTestId(DASHBOARD_WIDGET_HANDLES.CHART),
  ).toContainText("1/2");

  await expect(
    student.page.getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_CERTIFICATES),
  ).toContainText(certifiedCourse.title);
});
