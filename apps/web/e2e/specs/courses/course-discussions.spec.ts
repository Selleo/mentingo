import { randomUUID } from "node:crypto";

import { USER_ROLE } from "~/config/userRoles";

import { TOAST_HANDLES } from "../../data/common/handles";
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

test.describe.configure({ mode: "serial" });

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

test.describe("availability", () => {
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
});

test.describe("messaging", () => {
  test("student can create a top-level discussion thread", async ({ createIsolatedWorkspace }) => {
    const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
    const { courseId, studentSession } = await createDiscussionCourseSetup(workspace, true);
    const content = uniqueLabel("discussion-thread");

    await openCourseDiscussionFlow(studentSession.page, courseId);
    const sendButton = studentSession.page.getByTestId(
      COURSE_DISCUSSION_HANDLES.THREAD_SEND_BUTTON,
    );
    await expect(sendButton).toBeDisabled();
    await studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.THREAD_INPUT).fill("   ");
    await expect(sendButton).toBeDisabled();
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
});

test.describe("reactions", () => {
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
        const message = await findThreadByContent(
          studentSession.apiClient,
          courseId,
          threadContent,
        );

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
        const message = await findThreadByContent(
          studentSession.apiClient,
          courseId,
          threadContent,
        );

        return (
          message?.reactions.find((reaction) => reaction.reaction === DISCUSSION_REACTION)?.count ??
          0
        );
      })
      .toBe(0);
  });
});

test.describe("deletion", () => {
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

  test("student can cancel deletion and can remove a thread without replies", async ({
    createIsolatedWorkspace,
  }) => {
    const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
    const { courseId, studentSession } = await createDiscussionCourseSetup(workspace, true);
    const response = await studentSession.apiClient.api.courseChatControllerCreateMessage(
      courseId,
      { content: uniqueLabel("reply-free-thread") },
    );
    const thread = response.data.data;

    await openCourseDiscussionFlow(studentSession.page, courseId);
    await studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.message(thread.id)).hover();
    await studentSession.page
      .getByTestId(COURSE_DISCUSSION_HANDLES.messageDeleteAction(thread.id))
      .click();
    await expect(
      studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.DELETE_DIALOG),
    ).toBeVisible();
    await studentSession.page
      .getByTestId(COURSE_DISCUSSION_HANDLES.DELETE_DIALOG_CANCEL_BUTTON)
      .click();
    await expect(
      studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.message(thread.id)),
    ).toBeVisible();

    await deleteCourseDiscussionMessageFlow(studentSession.page, thread.id);
    await expect(
      studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.message(thread.id)),
    ).toHaveCount(0);
    await expect
      .poll(() => findThreadById(studentSession.apiClient, courseId, thread.id))
      .toBeNull();
  });
});

test.describe("mentions", () => {
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
    const outsider = await userFactory.create({
      firstName: "Unenrolled",
      lastName: uniqueLabel("Mention"),
    });

    await enrollmentFactory.enrollUsers(courseId, [mentionTarget.id]);

    await openCourseDiscussionFlow(studentSession.page, courseId);
    const input = studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.THREAD_INPUT);
    await input.fill("@");
    await expect(
      studentSession.page.getByTestId(
        COURSE_DISCUSSION_HANDLES.threadMentionOption(studentSession.user.id),
      ),
    ).toHaveCount(0);
    await expect(
      studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.threadMentionOption(outsider.id)),
    ).toHaveCount(0);
    await input.fill("");
    await selectCourseDiscussionMentionFlow(
      studentSession.page,
      mentionTarget.firstName,
      mentionTarget.id,
    );

    await expect(input).toHaveValue(`${mentionLabel} `);
    await input.fill(content);
    await studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.THREAD_SEND_BUTTON).click();

    const thread = await waitForThreadByContent(studentSession.apiClient, courseId, content);
    await expect(
      studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.messageContent(thread.id)),
    ).toContainText(mentionLabel);
  });
});

test.describe("realtime collaboration", () => {
  test("students receive new messages, replies, mentions, and presence updates in realtime", async ({
    createIsolatedWorkspace,
  }) => {
    const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
    const { courseId, studentSession: firstStudent } = await createDiscussionCourseSetup(
      workspace,
      true,
    );
    const secondStudent = await workspace.createTenantUserWithPasswordAndRole({
      firstName: "Realtime",
      lastName: uniqueLabel("Student"),
      role: USER_ROLE.student,
    });
    const enrollmentFactory = workspace.factories.createEnrollmentFactory();
    await enrollmentFactory.enrollUsers(courseId, [secondStudent.user.id]);

    await openCourseDiscussionFlow(firstStudent.page, courseId);
    await openCourseDiscussionFlow(secondStudent.page, courseId);

    const mentionLabel = `@${firstStudent.user.firstName} ${firstStudent.user.lastName}`;
    const threadContent = `${mentionLabel} ${uniqueLabel("realtime-thread")}`;
    await selectCourseDiscussionMentionFlow(
      secondStudent.page,
      firstStudent.user.firstName,
      firstStudent.user.id,
    );
    await secondStudent.page
      .getByTestId(COURSE_DISCUSSION_HANDLES.THREAD_INPUT)
      .fill(threadContent);
    await secondStudent.page.getByTestId(COURSE_DISCUSSION_HANDLES.THREAD_SEND_BUTTON).click();

    const thread = await waitForThreadByContent(secondStudent.apiClient, courseId, threadContent);
    await expect(
      firstStudent.page.getByTestId(COURSE_DISCUSSION_HANDLES.messageContent(thread.id)),
    ).toContainText(threadContent);
    await expect(firstStudent.page.getByTestId(TOAST_HANDLES.DESCRIPTION)).toHaveText(
      "Someone mentioned you in the course discussion.",
    );
    await expect(
      firstStudent.page.getByTestId(COURSE_DISCUSSION_HANDLES.messageAuthorPresence(thread.id)),
    ).toHaveAttribute("data-online", "true");

    await openCourseDiscussionRepliesFlow(firstStudent.page, thread.id);
    await openCourseDiscussionRepliesFlow(secondStudent.page, thread.id);
    const replyContent = uniqueLabel("realtime-reply");
    await submitCourseDiscussionReplyFlow(firstStudent.page, thread.id, replyContent);
    const reply = await waitForReplyByContent(firstStudent.apiClient, thread.id, replyContent);

    await expect(
      secondStudent.page.getByTestId(COURSE_DISCUSSION_HANDLES.messageContent(reply.id)),
    ).toContainText(replyContent);
    await expect(
      secondStudent.page.getByTestId(COURSE_DISCUSSION_HANDLES.repliesToggle(thread.id)),
    ).toContainText("1");

    await secondStudent.context.close();
    await expect(
      firstStudent.page.getByTestId(COURSE_DISCUSSION_HANDLES.messageAuthorPresence(thread.id)),
    ).toHaveAttribute("data-online", "false");
  });

  test("reactions and deletions propagate to another open discussion", async ({
    createIsolatedWorkspace,
  }) => {
    const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
    const { courseId, studentSession: author } = await createDiscussionCourseSetup(workspace, true);
    const observer = await workspace.createTenantUserWithPasswordAndRole({
      firstName: "Discussion",
      lastName: uniqueLabel("Observer"),
      role: USER_ROLE.student,
    });
    const enrollmentFactory = workspace.factories.createEnrollmentFactory();
    await enrollmentFactory.enrollUsers(courseId, [observer.user.id]);

    const threadContent = uniqueLabel("realtime-reaction-delete");
    const threadResponse = await author.apiClient.api.courseChatControllerCreateMessage(courseId, {
      content: threadContent,
    });
    const thread = threadResponse.data.data;
    await author.apiClient.api.courseChatControllerCreateMessage(courseId, {
      content: uniqueLabel("reply-preserving-thread"),
      parentMessageId: thread.id,
    });

    await openCourseDiscussionFlow(author.page, courseId);
    await openCourseDiscussionFlow(observer.page, courseId);
    await reactToCourseDiscussionMessageFlow(observer.page, thread.id, DISCUSSION_REACTION);

    await expect(
      author.page.getByTestId(
        COURSE_DISCUSSION_HANDLES.messageReactionSummary(thread.id, DISCUSSION_REACTION),
      ),
    ).toContainText("1");

    await deleteCourseDiscussionMessageFlow(author.page, thread.id);
    await expect(
      observer.page.getByTestId(COURSE_DISCUSSION_HANDLES.messageContent(thread.id)),
    ).toContainText("This message was deleted");
  });
});

test.describe("pagination", () => {
  test("student can navigate between pages of discussion threads", async ({
    createIsolatedWorkspace,
  }) => {
    const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
    const { courseId, studentSession } = await createDiscussionCourseSetup(workspace, true);
    const contents: string[] = [];

    for (let index = 0; index < 11; index++) {
      const content = uniqueLabel(`paginated-thread-${index}`);
      contents.push(content);
      await studentSession.apiClient.api.courseChatControllerCreateMessage(courseId, { content });
    }

    await openCourseDiscussionFlow(studentSession.page, courseId);
    await expect(
      studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.PAGINATION_PREVIOUS_BUTTON),
    ).toBeDisabled();
    await expect(
      studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.PAGINATION_NEXT_BUTTON),
    ).toBeEnabled();
    await expect(studentSession.page.getByText(contents[0], { exact: true })).toHaveCount(0);
    await expect(studentSession.page.getByText(contents[10], { exact: true })).toBeVisible();

    await studentSession.page
      .getByTestId(COURSE_DISCUSSION_HANDLES.paginationPageButton(2))
      .click();

    await expect(studentSession.page.getByText(contents[0], { exact: true })).toBeVisible();
    await expect(studentSession.page.getByText(contents[10], { exact: true })).toHaveCount(0);
    await expect(
      studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.PAGINATION_PREVIOUS_BUTTON),
    ).toBeEnabled();
    await expect(
      studentSession.page.getByTestId(COURSE_DISCUSSION_HANDLES.PAGINATION_NEXT_BUTTON),
    ).toBeDisabled();

    await studentSession.page
      .getByTestId(COURSE_DISCUSSION_HANDLES.PAGINATION_PREVIOUS_BUTTON)
      .click();
    await expect(studentSession.page.getByText(contents[10], { exact: true })).toBeVisible();
  });
});
