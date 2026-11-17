import { randomUUID } from "node:crypto";

import { USER_ROLE } from "~/config/userRoles";

import { FORUM_HANDLES } from "../../data/forum/handles";
import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openDashboardFlow } from "../../flows/dashboard/open-dashboard.flow";
import { createForumTopicFlow } from "../../flows/forum/create-forum-topic.flow";
import { openForumFlow } from "../../flows/forum/open-forum.flow";
import { replyToForumTopicFlow } from "../../flows/forum/reply-to-forum-topic.flow";
import { openPathAtOriginFlow } from "../../flows/navigation/open-path-at-origin.flow";
import { setForumFeatureState } from "../../utils/forum-features";

import type { IsolatedWorkspaceHandle } from "../../fixtures/test.fixture";
import type { FixtureApiClient } from "../../utils/api-client";

const uniqueLabel = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;

const createStudent = (workspace: IsolatedWorkspaceHandle, lastName: string) =>
  workspace.createTenantUserWithPasswordAndRole({
    firstName: "Forum",
    lastName,
    role: USER_ROLE.student,
  });

const waitForTopicId = async (apiClient: FixtureApiClient, search: string) => {
  const findTopicId = async () => {
    const response = await apiClient.api.forumControllerGetTopics({ search });

    return response.data.data[0]?.id ?? null;
  };

  await expect.poll(findTopicId).not.toBeNull();
  const topicId = await findTopicId();

  if (!topicId) throw new Error(`Forum topic matching "${search}" was not found`);

  return topicId;
};

const waitForPostId = async (apiClient: FixtureApiClient, topicId: string, content: string) => {
  const findPostId = async () => {
    const response = await apiClient.api.forumControllerGetTopicPosts(topicId, { perPage: 20 });

    return response.data.data.find((post) => post.content === content)?.id ?? null;
  };

  await expect.poll(findPostId).not.toBeNull();
  const postId = await findPostId();

  if (!postId) throw new Error(`Forum post "${content}" was not found`);

  return postId;
};

test("forum stays hidden while it is disabled", async ({ createIsolatedWorkspace }) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  await setForumFeatureState(workspace.apiClient, { forumEnabled: false });
  const student = await createStudent(workspace, "Disabled");

  await openDashboardFlow(student.page, student.origin);
  await expect(student.page.getByTestId(NAVIGATION_HANDLES.FORUM_LINK)).toHaveCount(0);

  await openPathAtOriginFlow(student.page, student.origin, "/forum");
  await expect(student.page).not.toHaveURL(/\/forum/);
  await expect(student.page.getByTestId(FORUM_HANDLES.PAGE)).toHaveCount(0);
});

test("student creates a forum topic and replies to it", async ({ createIsolatedWorkspace }) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  await setForumFeatureState(workspace.apiClient, { forumEnabled: true });
  const student = await createStudent(workspace, "Author");
  const title = uniqueLabel("forum-topic");
  const reply = uniqueLabel("forum-reply");

  await openDashboardFlow(student.page, student.origin);
  await student.page.getByTestId(NAVIGATION_HANDLES.FORUM_LINK).click();
  await expect(student.page.getByTestId(FORUM_HANDLES.PAGE)).toBeVisible();

  await createForumTopicFlow(student.page, { title, content: uniqueLabel("forum-first-post") });
  await expect(student.page.getByTestId(FORUM_HANDLES.TOPIC_TITLE)).toHaveText(title);
  await expect(student.page.getByTestId(FORUM_HANDLES.NO_REPLIES)).toBeVisible();

  await replyToForumTopicFlow(student.page, reply);

  const topicId = await waitForTopicId(student.apiClient, title);
  const replyId = await waitForPostId(student.apiClient, topicId, reply);
  await expect(student.page.getByTestId(FORUM_HANDLES.postContent(replyId))).toHaveText(reply);
  await expect(student.page.getByTestId(FORUM_HANDLES.REPLY_INPUT)).toHaveValue("");

  await openForumFlow(student.page, student.origin);
  await expect(student.page.getByTestId(FORUM_HANDLES.topicItemReplies(topicId))).toContainText(
    "1",
  );
});

test("enrolled users read their course discussion in the forum", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  await setForumFeatureState(workspace.apiClient, {
    forumEnabled: true,
    courseDiscussionsEnabled: true,
  });
  const courseTitle = uniqueLabel("forum-course");
  const category = await workspace.factories
    .createCategoryFactory()
    .create(uniqueLabel("Forum Category"));
  const course = await workspace.factories.createCourseFactory().create({
    title: courseTitle,
    categoryId: category.id,
    status: "published",
  });
  const enrolledStudent = await createStudent(workspace, "Enrolled");
  const outsider = await createStudent(workspace, "Outsider");
  await workspace.factories
    .createEnrollmentFactory()
    .enrollUsers(course.id, [enrolledStudent.user.id]);

  const threadContent = uniqueLabel("course-thread");
  const message = await enrolledStudent.apiClient.api.courseChatControllerCreateMessage(course.id, {
    content: threadContent,
  });

  await openForumFlow(enrolledStudent.page, enrolledStudent.origin);
  await expect(enrolledStudent.page.getByTestId(FORUM_HANDLES.EMPTY_STATE)).toBeVisible();

  const courseDiscussion = enrolledStudent.page.getByTestId(
    FORUM_HANDLES.courseDiscussion(course.id),
  );
  await expect(courseDiscussion).toContainText(courseTitle);
  await courseDiscussion.click();
  await expect(enrolledStudent.page).toHaveURL(new RegExp(`/forum/courses/${course.id}$`));
  await expect(
    enrolledStudent.page.getByTestId(FORUM_HANDLES.COURSE_DISCUSSION_TITLE),
  ).toContainText(courseTitle);
  await expect(
    enrolledStudent.page.getByTestId(FORUM_HANDLES.postContent(message.data.data.id)),
  ).toHaveText(threadContent);

  await openForumFlow(outsider.page, outsider.origin);
  await expect(outsider.page.getByTestId(FORUM_HANDLES.EMPTY_STATE)).toBeVisible();
  await expect(outsider.page.getByTestId(FORUM_HANDLES.COURSE_DISCUSSIONS)).toHaveCount(0);
});
