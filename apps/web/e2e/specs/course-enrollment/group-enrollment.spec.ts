import { COURSE_ENROLLMENT } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { COURSE_ENROLLED_HANDLES, COURSE_OVERVIEW_HANDLES } from "../../data/courses/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { enrollCourseGroupsFlow } from "../../flows/courses/enroll-course-groups.flow";
import { filterEnrolledUsersFlow } from "../../flows/courses/filter-enrolled-users.flow";
import { openCourseEnrolledTabFlow } from "../../flows/courses/open-course-enrolled-tab.flow";
import { unenrollCourseGroupsFlow } from "../../flows/courses/unenroll-course-groups.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { openLearnerPage } from "../../utils/learner-session";

import { arrangeEnrollmentCourse } from "./enrollment-test-helpers";

test("admin enrolls and unenrolls a group, and its members gain and lose course access", async ({
  cleanup,
  createWorkspaceContext,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const enrollmentFactory = factories.createEnrollmentFactory();
    const groupFactory = factories.createGroupFactory();
    const userFactory = factories.createUserFactory();
    const prefix = `group-enrollment-${Date.now()}`;
    const { course, lesson, learner, learnerPassword } = await arrangeEnrollmentCourse({
      cleanup,
      factories,
      prefix,
    });
    const otherMember = await userFactory.create({
      email: `${prefix}-member@example.com`,
      firstName: "Group Member",
      lastName: prefix,
    });
    cleanup.add(() => userFactory.delete(otherMember.id));
    const group = await groupFactory.create({ name: `${prefix}-group` });
    cleanup.add(() => groupFactory.delete(group.id));
    const members = [learner, otherMember];

    await Promise.all(members.map((user) => userFactory.update(user.id, { groups: [group.id] })));

    const learnerPage = await openLearnerPage({
      cleanup,
      createWorkspaceContext,
      email: learner.email,
      password: learnerPassword,
    });

    await openCourseEnrolledTabFlow(page, course.id);
    await enrollCourseGroupsFlow(page, [group.id]);
    await filterEnrolledUsersFlow(page, { keyword: prefix });

    for (const member of members) {
      await expect(
        page.getByTestId(
          COURSE_ENROLLED_HANDLES.statusBadge(member.id, COURSE_ENROLLMENT.GROUP_ENROLLED),
        ),
      ).toBeVisible();
    }
    await expect
      .poll(async () => (await enrollmentFactory.getGroups(course.id)).map(({ id }) => id))
      .toContain(group.id);

    await openCourseOverviewFlow(learnerPage, course.id);
    await learnerPage.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON).click();
    await expect(learnerPage.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(lesson.title);

    await unenrollCourseGroupsFlow(page, [group.id]);

    for (const member of members) {
      await expect(
        page.getByTestId(
          COURSE_ENROLLED_HANDLES.statusBadge(member.id, COURSE_ENROLLMENT.NOT_ENROLLED),
        ),
      ).toBeVisible();
    }
    await expect
      .poll(async () => {
        const enrolledUsers = await Promise.all(
          members.map((member) => enrollmentFactory.getUser(course.id, member.id)),
        );

        return enrolledUsers.every((user) => !user?.isEnrolledByGroup && user?.enrolledAt === null);
      })
      .toBe(true);

    await openCourseOverviewFlow(learnerPage, course.id);
    await expect(learnerPage.getByTestId(COURSE_OVERVIEW_HANDLES.ENROLL_BUTTON)).toBeVisible();
    await expect(
      learnerPage.getByTestId(COURSE_OVERVIEW_HANDLES.START_LEARNING_BUTTON),
    ).toBeHidden();
  });
});
