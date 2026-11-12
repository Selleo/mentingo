import { randomUUID } from "node:crypto";

import { USER_ROLE } from "~/config/userRoles";

import { FORUM_HANDLES } from "../../data/forum/handles";
import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { createForumTopicFlow } from "../../flows/forum/create-forum-topic.flow";
import { openForumFlow } from "../../flows/forum/open-forum.flow";
import { replyToForumTopicFlow } from "../../flows/forum/reply-to-forum-topic.flow";
import { prepareNavigationPageFlow } from "../../flows/navigation/prepare-navigation-page.flow";
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

  await prepareNavigationPageFlow(student.page);
  await expect(student.page.getByTestId(NAVIGATION_HANDLES.FORUM_LINK)).toHaveCount(0);

  await openForumFlow(student.page);
  await expect(student.page.getByTestId(FORUM_HANDLES.UNAVAILABLE)).toBeVisible();
});

test("student creates a forum topic and replies to it", async ({ createIsolatedWorkspace }) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  await setForumFeatureState(workspace.apiClient, { forumEnabled: true });
  const student = await createStudent(workspace, "Author");
  const title = uniqueLabel("forum-topic");
  const reply = uniqueLabel("forum-reply");

  await prepareNavigationPageFlow(student.page);
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

  await openForumFlow(student.page);
  await expect(student.page.getByTestId(FORUM_HANDLES.topicItemReplies(topicId))).toContainText(
    "1",
  );
});

test("course discussion threads appear in the forum only for enrolled users", async ({
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
  await enrolledStudent.apiClient.api.courseChatControllerCreateMessage(course.id, {
    content: threadContent,
  });
  const topicId = await waitForTopicId(enrolledStudent.apiClient, threadContent);

  await openForumFlow(enrolledStudent.page);
  await expect(enrolledStudent.page.getByTestId(FORUM_HANDLES.topicItemTitle(topicId))).toHaveText(
    threadContent,
  );
  await expect(enrolledStudent.page.getByTestId(FORUM_HANDLES.topicItemCourse(topicId))).toHaveText(
    courseTitle,
  );

  await openForumFlow(outsider.page);
  await expect(outsider.page.getByTestId(FORUM_HANDLES.EMPTY_STATE)).toBeVisible();
  await expect(outsider.page.getByTestId(FORUM_HANDLES.topicItem(topicId))).toHaveCount(0);
});
