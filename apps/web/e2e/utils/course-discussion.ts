import { randomUUID } from "node:crypto";

import { USER_ROLE } from "~/config/userRoles";

import { CourseDiscussionFactory } from "../factories/course-discussion.factory";

import type { IsolatedWorkspaceHandle } from "../fixtures/test.fixture";

export const uniqueDiscussionLabel = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;

/** Creates an enrolled student with its own browser session and discussion API client. */
export const createDiscussionParticipant = async (
  workspace: IsolatedWorkspaceHandle,
  courseId: string,
  name: { firstName: string; lastName: string },
) => {
  const session = await workspace.createTenantUserWithPasswordAndRole({
    ...name,
    role: USER_ROLE.student,
  });

  await workspace.factories.createEnrollmentFactory().enrollUsers(courseId, [session.user.id]);

  return { session, discussions: new CourseDiscussionFactory(session.apiClient) };
};

/** Sets the tenant-wide discussions switch and creates a published course with one enrolled student. */
export const arrangeDiscussionCourse = async (
  workspace: IsolatedWorkspaceHandle,
  { enabled }: { enabled: boolean },
) => {
  await workspace.factories.createCourseDiscussionFactory().setEnabled(enabled);

  const category = await workspace.factories
    .createCategoryFactory()
    .create(uniqueDiscussionLabel("Discussion Category"));
  const course = await workspace.factories.createCourseFactory().create({
    title: uniqueDiscussionLabel("discussion-course"),
    categoryId: category.id,
    status: "published",
  });
  const student = await createDiscussionParticipant(workspace, course.id, {
    firstName: "Discussion",
    lastName: "Student",
  });

  return { courseId: course.id, student };
};
