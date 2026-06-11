import { randomUUID } from "node:crypto";

import { USER_ROLE } from "~/config/userRoles";

import { COURSE_DISCUSSION_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { deleteCourseDiscussionMessageFlow } from "../../flows/courses/delete-course-discussion-message.flow";
import { openCourseDiscussionRepliesFlow } from "../../flows/courses/open-course-discussion-replies.flow";
import { openCourseDiscussionFlow } from "../../flows/courses/open-course-discussion.flow";
import { reactToCourseDiscussionMessageFlow } from "../../flows/courses/react-to-course-discussion-message.flow";
import { selectCourseDiscussionMentionFlow } from "../../flows/courses/select-course-discussion-mention.flow";
import { submitCourseDiscussionReplyFlow } from "../../flows/courses/submit-course-discussion-reply.flow";
import { submitCourseDiscussionThreadFlow } from "../../flows/courses/submit-course-discussion-thread.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";

import type { IsolatedWorkspaceHandle, TenantUserHandle } from "../../fixtures/test.fixture";
import type { FixtureApiClient } from "../../utils/api-client";
import type {
  GetMessagesResponse,
  GetPublicGlobalSettingsResponse,
  GetRepliesResponse,
} from "~/api/generated-api";

type GlobalSettings = GetPublicGlobalSettingsResponse["data"];
type CourseDiscussionThread = GetMessagesResponse["data"][number];
type CourseDiscussionReply = GetRepliesResponse["data"][number];

type DiscussionCourseSetup = {
  courseId: string;
  studentSession: TenantUserHandle;
};

const DISCUSSION_REACTION = "👍";

const uniqueLabel = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;

const getGlobalSettings = async (apiClient: FixtureApiClient): Promise<GlobalSettings> => {
  const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();

  return response.data.data;
};

const setCourseDiscussionsEnabled = async (apiClient: FixtureApiClient, enabled: boolean) => {
  const settings = await getGlobalSettings(apiClient);

  if (settings.courseDiscussionsEnabled !== enabled) {
    await apiClient.api.settingsControllerUpdateCourseDiscussionsEnabled();
  }
};

const createDiscussionCourseSetup = async (
  workspace: IsolatedWorkspaceHandle,
  enabled: boolean,
): Promise<DiscussionCourseSetup> => {
  await setCourseDiscussionsEnabled(workspace.apiClient, enabled);

  const categoryFactory = workspace.factories.createCategoryFactory();
  const courseFactory = workspace.factories.createCourseFactory();
  const enrollmentFactory = workspace.factories.createEnrollmentFactory();
  const category = await categoryFactory.create(uniqueLabel("Discussion Category"));
  const course = await courseFactory.create({
    title: uniqueLabel("discussion-course"),
    categoryId: category.id,
    status: "published",
  });
  const studentSession = await workspace.createTenantUserWithPasswordAndRole({
    firstName: "Discussion",
    lastName: "Student",
    role: USER_ROLE.student,
  });

  await enrollmentFactory.enrollUsers(course.id, [studentSession.user.id]);

  return {
    courseId: course.id,
    studentSession,
  };
};

const findThreadByContent = async (
  apiClient: FixtureApiClient,
  courseId: string,
  content: string,
) => {
  const response = await apiClient.api.courseChatControllerGetMessages(courseId, {
    page: 1,
    perPage: 10,
  });

  return response.data.data.find((message) => message.content === content) ?? null;
};

const findThreadById = async (apiClient: FixtureApiClient, courseId: string, messageId: string) => {
  const response = await apiClient.api.courseChatControllerGetMessages(courseId, {
    page: 1,
    perPage: 10,
  });

  return response.data.data.find((message) => message.id === messageId) ?? null;
};

const waitForThreadByContent = async (
  apiClient: FixtureApiClient,
  courseId: string,
  content: string,
): Promise<CourseDiscussionThread> => {
  let thread: CourseDiscussionThread | null = null;

  await expect
    .poll(async () => {
      thread = await findThreadByContent(apiClient, courseId, content);

      return thread?.id ?? null;
    })
    .not.toBeNull();

  return thread!;
};

const waitForReplyByContent = async (
  apiClient: FixtureApiClient,
  messageId: string,
  content: string,
): Promise<CourseDiscussionReply> => {
  let reply: CourseDiscussionReply | null = null;

  await expect
    .poll(async () => {
      const response = await apiClient.api.courseChatControllerGetReplies(messageId, {
        page: 1,
        perPage: 10,
      });
      reply = response.data.data.find((message) => message.content === content) ?? null;

      return reply?.id ?? null;
    })
    .not.toBeNull();

  return reply!;
};

test("enrolled student does not see Discussion tab when global discussions are disabled", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const { courseId, studentSession } = await createDiscussionCourseSetup(workspace, false);

  await openCourseOverviewFlow(studentSession.page, courseId);

  await expect(studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.TAB)).toHaveCount(0);
});

test("enrolled student sees empty discussion state when global discussions are enabled", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const { courseId, studentSession } = await createDiscussionCourseSetup(workspace, true);

  await openCourseDiscussionFlow(studentSession.page, courseId);

  await expect(studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.ROOT)).toBeVisible();
  await expect(
    studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.EMPTY_STATE),
  ).toBeVisible();
});

test("student can create a top-level discussion thread", async ({ createIsolatedWorkspace }) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const { courseId, studentSession } = await createDiscussionCourseSetup(workspace, true);
  const content = uniqueLabel("discussion-thread");

  await openCourseDiscussionFlow(studentSession.page, courseId);
  await submitCourseDiscussionThreadFlow(studentSession.page, content);

  const thread = await waitForThreadByContent(studentSession.apiClient, courseId, content);
  await expect(
    studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.messageContent(thread.id)),
  ).toContainText(content);
});

test("student can reply to a discussion thread", async ({ createIsolatedWorkspace }) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const { courseId, studentSession } = await createDiscussionCourseSetup(workspace, true);
  const threadContent = uniqueLabel("discussion-thread-for-reply");
  const replyContent = uniqueLabel("discussion-reply");
  const threadResponse = await studentSession.apiClient.api.courseChatControllerCreateMessage(
    courseId,
    { content: threadContent },
  );
  const thread = threadResponse.data.data;

  await openCourseDiscussionFlow(studentSession.page, courseId);
  await expect(
    studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.messageContent(thread.id)),
  ).toContainText(threadContent);

  await openCourseDiscussionRepliesFlow(studentSession.page, thread.id);
  await submitCourseDiscussionReplyFlow(studentSession.page, thread.id, replyContent);

  const reply = await waitForReplyByContent(studentSession.apiClient, thread.id, replyContent);
  await expect(
    studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.messageContent(reply.id)),
  ).toContainText(replyContent);
  await expect(
    studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.repliesToggle(thread.id)),
  ).toContainText("1");
});

test("student can react to a discussion message and toggle the reaction", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const { courseId, studentSession } = await createDiscussionCourseSetup(workspace, true);
  const threadContent = uniqueLabel("discussion-thread-for-reaction");
  const threadResponse = await studentSession.apiClient.api.courseChatControllerCreateMessage(
    courseId,
    { content: threadContent },
  );
  const thread = threadResponse.data.data;

  await openCourseDiscussionFlow(studentSession.page, courseId);
  await reactToCourseDiscussionMessageFlow(studentSession.page, thread.id, DISCUSSION_REACTION);

  await expect
    .poll(async () => {
      const message = await findThreadByContent(studentSession.apiClient, courseId, threadContent);

      return message?.reactions.find((reaction) => reaction.reaction === DISCUSSION_REACTION)
        ?.count;
    })
    .toBe(1);

  await expect(
    studentSession.page.getByTestId(
      COURSE_DISCUSSION_HANDLES.messageReactionSummary(thread.id, DISCUSSION_REACTION),
    ),
  ).toContainText("1");

  await studentSession.page
    .getByTestId(COURSE_DISCUSSION_HANDLES.messageReactionSummary(thread.id, DISCUSSION_REACTION))
    .click();

  await expect
    .poll(async () => {
      const message = await findThreadByContent(studentSession.apiClient, courseId, threadContent);

      return (
        message?.reactions.find((reaction) => reaction.reaction === DISCUSSION_REACTION)?.count ?? 0
      );
    })
    .toBe(0);
});

test("student can delete their own thread and sees the deleted placeholder", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const { courseId, studentSession } = await createDiscussionCourseSetup(workspace, true);
  const threadContent = uniqueLabel("discussion-thread-for-delete");
  const replyContent = uniqueLabel("discussion-reply-before-delete");
  const threadResponse = await studentSession.apiClient.api.courseChatControllerCreateMessage(
    courseId,
    { content: threadContent },
  );
  const thread = threadResponse.data.data;
  await studentSession.apiClient.api.courseChatControllerCreateMessage(courseId, {
    content: replyContent,
    parentMessageId: thread.id,
  });

  await openCourseDiscussionFlow(studentSession.page, courseId);
  await deleteCourseDiscussionMessageFlow(studentSession.page, thread.id);

  await expect
    .poll(async () => {
      const message = await findThreadById(studentSession.apiClient, courseId, thread.id);

      return message?.deletedAt ?? null;
    })
    .not.toBeNull();

  await expect(
    studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.messageContent(thread.id)),
  ).toContainText("This message was deleted");
});

test("student can select another enrolled user from the mention picker", async ({
  createIsolatedWorkspace,
}) => {
  const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
  const { courseId, studentSession } = await createDiscussionCourseSetup(workspace, true);
  const userFactory = workspace.factories.createUserFactory();
  const enrollmentFactory = workspace.factories.createEnrollmentFactory();
  const mentionTarget = await userFactory.create({
    firstName: "Mention",
    lastName: uniqueLabel("Target"),
  });
  const mentionLabel = `@${mentionTarget.firstName} ${mentionTarget.lastName}`;
  const content = `${mentionLabel} ${uniqueLabel("please-review")}`;

  await enrollmentFactory.enrollUsers(courseId, [mentionTarget.id]);

  await openCourseDiscussionFlow(studentSession.page, courseId);
  await selectCourseDiscussionMentionFlow(
    studentSession.page,
    mentionTarget.firstName,
    mentionTarget.id,
  );

  const input = studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.THREAD_INPUT);
  await expect(input).toHaveValue(`${mentionLabel} `);
  await input.fill(content);
  await studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.THREAD_SEND_BUTTON).click();

  const thread = await waitForThreadByContent(studentSession.apiClient, courseId, content);
  await expect(
    studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.messageContent(thread.id)),
  ).toContainText(mentionLabel);
});
