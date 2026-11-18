import { COURSE_ENROLLMENT } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { COURSE_ENROLLED_HANDLES, COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { confirmEnrollSelectedUsersFlow } from "../../flows/courses/confirm-enroll-selected-users.flow";
import { confirmUnenrollSelectedUsersFlow } from "../../flows/courses/confirm-unenroll-selected-users.flow";
import { filterEnrolledUsersFlow } from "../../flows/courses/filter-enrolled-users.flow";
import { openCourseEnrolledTabFlow } from "../../flows/courses/open-course-enrolled-tab.flow";
import { selectEnrolledUsersFlow } from "../../flows/courses/select-enrolled-users.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { openLearnerPage } from "../../utils/learner-session";

import { arrangeEnrollmentCourse } from "./enrollment-test-helpers";

test("admin bulk enrolls and unenrolls selected users, and the learner gains and loses course access", async ({
  cleanup,
  createWorkspaceContext,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const enrollmentFactory = factories.createEnrollmentFactory();
    const userFactory = factories.createUserFactory();
    const prefix = `user-enrollment-${Date.now()}`;
    const { course, lesson, learner, learnerPassword } = await arrangeEnrollmentCourse({
      cleanup,
      factories,
      prefix,
    });
    const unselectedUser = await userFactory.create({
      email: `${prefix}-unselected@example.com`,
      firstName: "Unselected User",
      lastName: prefix,
    });
    cleanup.add(() => userFactory.delete(unselectedUser.id));

    const learnerPage = await openLearnerPage({
      cleanup,
      createWorkspaceContext,
      email: learner.email,
      password: learnerPassword,
    });

    await openCourseEnrolledTabFlow(page, course.id);
    await filterEnrolledUsersFlow(page, { keyword: prefix });
    await expect(
      page.getByTestId(
        COURSE_ENROLLED_HANDLES.statusBadge(learner.id, COURSE_ENROLLMENT.NOT_ENROLLED),
      ),
    ).toBeVisible();

    await selectEnrolledUsersFlow(page, [learner.id]);
    await confirmEnrollSelectedUsersFlow(page);

    await expect(
      page.getByTestId(COURSE_ENROLLED_HANDLES.statusBadge(learner.id, COURSE_ENROLLMENT.ENROLLED)),
    ).toBeVisible();
    await expect(
      page.getByTestId(
        COURSE_ENROLLED_HANDLES.statusBadge(unselectedUser.id, COURSE_ENROLLMENT.NOT_ENROLLED),
      ),
    ).toBeVisible();
    await expect
      .poll(async () =>
        Boolean((await enrollmentFactory.getUser(course.id, learner.id))?.enrolledAt),
      )
      .toBe(true);
    await expect
      .poll(async () => (await enrollmentFactory.getUser(course.id, unselectedUser.id))?.enrolledAt)
      .toBeNull();

    await openCourseOverviewFlow(learnerPage, course.id);
    await learnerPage.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON).click();
    await expect(learnerPage.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(lesson.title);

    await selectEnrolledUsersFlow(page, [learner.id]);
    await confirmUnenrollSelectedUsersFlow(page);

    await expect(
      page.getByTestId(
        COURSE_ENROLLED_HANDLES.statusBadge(learner.id, COURSE_ENROLLMENT.NOT_ENROLLED),
      ),
    ).toBeVisible();
    await expect
      .poll(async () => (await enrollmentFactory.getUser(course.id, learner.id))?.enrolledAt)
      .toBeNull();

    await openCourseOverviewFlow(learnerPage, course.id);
    await expect(learnerPage.getByTestId(COURSE_OVERVIEW_HANDLES.ENROLL_BUTTON)).toBeVisible();
    await expect(
      learnerPage.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON),
    ).toBeHidden();
  });
});
