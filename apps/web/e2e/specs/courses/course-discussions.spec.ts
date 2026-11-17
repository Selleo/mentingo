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
import {
  arrangeDiscussionCourse,
  createDiscussionParticipant,
  uniqueDiscussionLabel,
} from "../../utils/course-discussion";

const DISCUSSION_REACTION = "👍";

test.describe("availability", () => {
  test("enrolled student does not see Discussion tab when global discussions are disabled", async ({
    createIsolatedWorkspace,
  }) => {
    const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
    const { courseId, student } = await arrangeDiscussionCourse(workspace, { enabled: false });

    await openCourseOverviewFlow(student.session.page, courseId);

    await expect(student.session.page.getByTestId(COURSE_DISCUSSION_HANDLES.TAB)).toHaveCount(0);
  });

  test("enrolled student sees empty discussion state when global discussions are enabled", async ({
    createIsolatedWorkspace,
  }) => {
    const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
    const { courseId, student } = await arrangeDiscussionCourse(workspace, { enabled: true });
    const { page } = student.session;

    await openCourseDiscussionFlow(page, courseId);

    await expect(page.getByTestId(COURSE_DISCUSSION_HANDLES.ROOT)).toBeVisible();
    await expect(page.getByTestId(COURSE_DISCUSSION_HANDLES.EMPTY_STATE)).toBeVisible();
  });
});

test.describe("messaging", () => {
  test("student can create a top-level discussion thread", async ({ createIsolatedWorkspace }) => {
    const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
    const { courseId, student } = await arrangeDiscussionCourse(workspace, { enabled: true });
    const { page } = student.session;
    const content = uniqueDiscussionLabel("discussion-thread");

    await openCourseDiscussionFlow(page, courseId);
    const sendButton = page.getByTestId(COURSE_DISCUSSION_HANDLES.THREAD_SEND_BUTTON);
    await expect(sendButton).toBeDisabled();
    await page.getByTestId(COURSE_DISCUSSION_HANDLES.THREAD_INPUT).fill("   ");
    await expect(sendButton).toBeDisabled();
    await submitCourseDiscussionThreadFlow(page, content);

    await expect.poll(() => student.discussions.findThread(courseId, { content })).not.toBeNull();
    const thread = await student.discussions.findThread(courseId, { content });
    await expect(
      page.getByTestId(COURSE_DISCUSSION_HANDLES.messageContent(thread?.id ?? "")),
    ).toContainText(content);
  });

  test("student can reply to a discussion thread", async ({ createIsolatedWorkspace }) => {
    const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
    const { courseId, student } = await arrangeDiscussionCourse(workspace, { enabled: true });
    const { page } = student.session;
    const threadContent = uniqueDiscussionLabel("discussion-thread-for-reply");
    const replyContent = uniqueDiscussionLabel("discussion-reply");
    const thread = await student.discussions.createMessage(courseId, { content: threadContent });

    await openCourseDiscussionFlow(page, courseId);
    await expect(
      page.getByTestId(COURSE_DISCUSSION_HANDLES.messageContent(thread.id)),
    ).toContainText(threadContent);

    await openCourseDiscussionRepliesFlow(page, thread.id);
    await submitCourseDiscussionReplyFlow(page, thread.id, replyContent);

    await expect.poll(() => student.discussions.findReply(thread.id, replyContent)).not.toBeNull();
    const reply = await student.discussions.findReply(thread.id, replyContent);
    await expect(
      page.getByTestId(COURSE_DISCUSSION_HANDLES.messageContent(reply?.id ?? "")),
    ).toContainText(replyContent);
    await expect(
      page.getByTestId(COURSE_DISCUSSION_HANDLES.repliesToggle(thread.id)),
    ).toContainText("1");
  });
});

test.describe("reactions", () => {
  test("student can react to a discussion message and toggle the reaction", async ({
    createIsolatedWorkspace,
  }) => {
    const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
    const { courseId, student } = await arrangeDiscussionCourse(workspace, { enabled: true });
    const { page } = student.session;
    const thread = await student.discussions.createMessage(courseId, {
      content: uniqueDiscussionLabel("discussion-thread-for-reaction"),
    });
    const reactionSummary = page.getByTestId(
      COURSE_DISCUSSION_HANDLES.messageReactionSummary(thread.id, DISCUSSION_REACTION),
    );

    await openCourseDiscussionFlow(page, courseId);
    await reactToCourseDiscussionMessageFlow(page, thread.id, DISCUSSION_REACTION);

    await expect(reactionSummary).toContainText("1");
    await expect
      .poll(() => student.discussions.getReactionCount(courseId, thread.id, DISCUSSION_REACTION))
      .toBe(1);

    await reactionSummary.click();

    await expect(reactionSummary).toBeHidden();
    await expect
      .poll(() => student.discussions.getReactionCount(courseId, thread.id, DISCUSSION_REACTION))
      .toBe(0);
  });
});

test.describe("deletion", () => {
  test("student can delete their own thread and sees the deleted placeholder", async ({
    createIsolatedWorkspace,
  }) => {
    const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
    const { courseId, student } = await arrangeDiscussionCourse(workspace, { enabled: true });
    const { page } = student.session;
    const threadContent = uniqueDiscussionLabel("discussion-thread-for-delete");
    const thread = await student.discussions.createMessage(courseId, { content: threadContent });
    await student.discussions.createMessage(courseId, {
      content: uniqueDiscussionLabel("discussion-reply-before-delete"),
      parentMessageId: thread.id,
    });

    await openCourseDiscussionFlow(page, courseId);
    await deleteCourseDiscussionMessageFlow(page, thread.id);

    // A thread with replies stays in the list as a deleted placeholder.
    const threadContentBubble = page.getByTestId(
      COURSE_DISCUSSION_HANDLES.messageContent(thread.id),
    );
    await expect(threadContentBubble).toHaveAttribute("data-deleted", "true");
    await expect(threadContentBubble).not.toContainText(threadContent);
    await expect
      .poll(
        async () =>
          (await student.discussions.findThread(courseId, { id: thread.id }))?.deletedAt ?? null,
      )
      .not.toBeNull();
  });

  test("student can cancel deletion and can remove a thread without replies", async ({
    createIsolatedWorkspace,
  }) => {
    const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
    const { courseId, student } = await arrangeDiscussionCourse(workspace, { enabled: true });
    const { page } = student.session;
    const thread = await student.discussions.createMessage(courseId, {
      content: uniqueDiscussionLabel("reply-free-thread"),
    });

    await openCourseDiscussionFlow(page, courseId);
    await page.getByTestId(COURSE_DISCUSSION_HANDLES.message(thread.id)).hover();
    await page.getByTestId(COURSE_DISCUSSION_HANDLES.messageDeleteAction(thread.id)).click();
    await expect(page.getByTestId(COURSE_DISCUSSION_HANDLES.DELETE_DIALOG)).toBeVisible();
    await page.getByTestId(COURSE_DISCUSSION_HANDLES.DELETE_DIALOG_CANCEL_BUTTON).click();
    await expect(page.getByTestId(COURSE_DISCUSSION_HANDLES.message(thread.id))).toBeVisible();

    await deleteCourseDiscussionMessageFlow(page, thread.id);
    await expect(page.getByTestId(COURSE_DISCUSSION_HANDLES.message(thread.id))).toHaveCount(0);
    await expect.poll(() => student.discussions.findThread(courseId, { id: thread.id })).toBeNull();
  });
});

test.describe("mentions", () => {
  test("student can select another enrolled user from the mention picker", async ({
    createIsolatedWorkspace,
  }) => {
    const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
    const { courseId, student } = await arrangeDiscussionCourse(workspace, { enabled: true });
    const { page } = student.session;
    const userFactory = workspace.factories.createUserFactory();
    const mentionTarget = await userFactory.create({
      firstName: "Mention",
      lastName: uniqueDiscussionLabel("Target"),
    });
    const mentionLabel = `@${mentionTarget.firstName} ${mentionTarget.lastName}`;
    const content = `${mentionLabel} ${uniqueDiscussionLabel("please-review")}`;
    const outsider = await userFactory.create({
      firstName: "Unenrolled",
      lastName: uniqueDiscussionLabel("Mention"),
    });

    await workspace.factories.createEnrollmentFactory().enrollUsers(courseId, [mentionTarget.id]);

    await openCourseDiscussionFlow(page, courseId);
    const input = page.getByTestId(COURSE_DISCUSSION_HANDLES.THREAD_INPUT);
    await input.fill("@");
    await expect(
      page.getByTestId(COURSE_DISCUSSION_HANDLES.threadMentionOption(student.session.user.id)),
    ).toHaveCount(0);
    await expect(
      page.getByTestId(COURSE_DISCUSSION_HANDLES.threadMentionOption(outsider.id)),
    ).toHaveCount(0);
    await input.fill("");
    await selectCourseDiscussionMentionFlow(page, mentionTarget.firstName, mentionTarget.id);

    await expect(input).toHaveValue(`${mentionLabel} `);
    await input.fill(content);
    await page.getByTestId(COURSE_DISCUSSION_HANDLES.THREAD_SEND_BUTTON).click();

    await expect.poll(() => student.discussions.findThread(courseId, { content })).not.toBeNull();
    const thread = await student.discussions.findThread(courseId, { content });
    await expect(
      page.getByTestId(COURSE_DISCUSSION_HANDLES.messageContent(thread?.id ?? "")),
    ).toContainText(mentionLabel);
  });
});

test.describe("realtime collaboration", () => {
  test("students receive new messages, replies, mentions, and presence updates in realtime", async ({
    createIsolatedWorkspace,
  }) => {
    const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
    const { courseId, student: firstStudent } = await arrangeDiscussionCourse(workspace, {
      enabled: true,
    });
    const secondStudent = await createDiscussionParticipant(workspace, courseId, {
      firstName: "Realtime",
      lastName: uniqueDiscussionLabel("Student"),
    });
    const firstPage = firstStudent.session.page;
    const secondPage = secondStudent.session.page;

    await openCourseDiscussionFlow(firstPage, courseId);
    await openCourseDiscussionFlow(secondPage, courseId);

    const { firstName, lastName, id: firstStudentId } = firstStudent.session.user;
    const mentionLabel = `@${firstName} ${lastName}`;
    const threadContent = `${mentionLabel} ${uniqueDiscussionLabel("realtime-thread")}`;
    await selectCourseDiscussionMentionFlow(secondPage, firstName, firstStudentId);
    await expect(secondPage.getByTestId(COURSE_DISCUSSION_HANDLES.THREAD_INPUT)).toHaveValue(
      `${mentionLabel} `,
    );
    await submitCourseDiscussionThreadFlow(secondPage, threadContent);

    await expect
      .poll(() => secondStudent.discussions.findThread(courseId, { content: threadContent }))
      .not.toBeNull();
    const thread = await secondStudent.discussions.findThread(courseId, { content: threadContent });
    const threadId = thread?.id ?? "";

    await expect(
      firstPage.getByTestId(COURSE_DISCUSSION_HANDLES.messageContent(threadId)),
    ).toContainText(threadContent);
    await expect(firstPage.getByTestId(COURSE_DISCUSSION_HANDLES.MENTION_TOAST)).toBeVisible();
    await expect(
      firstPage.getByTestId(COURSE_DISCUSSION_HANDLES.messageAuthorPresence(threadId)),
    ).toHaveAttribute("data-online", "true");

    await openCourseDiscussionRepliesFlow(secondPage, threadId);
    const replyContent = uniqueDiscussionLabel("realtime-reply");
    const reply = await firstStudent.discussions.createMessage(courseId, {
      content: replyContent,
      parentMessageId: threadId,
    });

    await expect(
      secondPage.getByTestId(COURSE_DISCUSSION_HANDLES.messageContent(reply.id)),
    ).toContainText(replyContent);
    await expect(
      secondPage.getByTestId(COURSE_DISCUSSION_HANDLES.repliesToggle(threadId)),
    ).toContainText("1");

    await secondStudent.session.context.close();
    await expect(
      firstPage.getByTestId(COURSE_DISCUSSION_HANDLES.messageAuthorPresence(threadId)),
    ).toHaveAttribute("data-online", "false");
  });

  test("reactions and deletions propagate to another open discussion", async ({
    createIsolatedWorkspace,
  }) => {
    const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
    const { courseId, student: author } = await arrangeDiscussionCourse(workspace, {
      enabled: true,
    });
    const observer = await createDiscussionParticipant(workspace, courseId, {
      firstName: "Discussion",
      lastName: uniqueDiscussionLabel("Observer"),
    });
    const threadContent = uniqueDiscussionLabel("realtime-reaction-delete");
    const thread = await author.discussions.createMessage(courseId, { content: threadContent });
    await author.discussions.createMessage(courseId, {
      content: uniqueDiscussionLabel("reply-preserving-thread"),
      parentMessageId: thread.id,
    });

    await openCourseDiscussionFlow(author.session.page, courseId);
    await openCourseDiscussionFlow(observer.session.page, courseId);
    await observer.discussions.toggleReaction(thread.id, DISCUSSION_REACTION);

    await expect(
      author.session.page.getByTestId(
        COURSE_DISCUSSION_HANDLES.messageReactionSummary(thread.id, DISCUSSION_REACTION),
      ),
    ).toContainText("1");

    await author.discussions.deleteMessage(thread.id);
    const observedThread = observer.session.page.getByTestId(
      COURSE_DISCUSSION_HANDLES.messageContent(thread.id),
    );
    await expect(observedThread).toHaveAttribute("data-deleted", "true");
    await expect(observedThread).not.toContainText(threadContent);
  });
});

test.describe("pagination", () => {
  test("student can navigate between pages of discussion threads", async ({
    createIsolatedWorkspace,
  }) => {
    const workspace = await createIsolatedWorkspace({ role: USER_ROLE.admin });
    const { courseId, student } = await arrangeDiscussionCourse(workspace, { enabled: true });
    const { page } = student.session;
    const threadIds: string[] = [];

    for (let index = 0; index < 11; index++) {
      const thread = await student.discussions.createMessage(courseId, {
        content: uniqueDiscussionLabel(`paginated-thread-${index}`),
      });
      threadIds.push(thread.id);
    }

    const oldestThread = page.getByTestId(COURSE_DISCUSSION_HANDLES.message(threadIds[0]));
    const newestThread = page.getByTestId(COURSE_DISCUSSION_HANDLES.message(threadIds[10]));
    const previousButton = page.getByTestId(COURSE_DISCUSSION_HANDLES.PAGINATION_PREVIOUS_BUTTON);
    const nextButton = page.getByTestId(COURSE_DISCUSSION_HANDLES.PAGINATION_NEXT_BUTTON);

    await openCourseDiscussionFlow(page, courseId);
    await expect(previousButton).toBeDisabled();
    await expect(nextButton).toBeEnabled();
    await expect(oldestThread).toHaveCount(0);
    await expect(newestThread).toBeVisible();

    await page.getByTestId(COURSE_DISCUSSION_HANDLES.paginationPageButton(2)).click();

    await expect(oldestThread).toBeVisible();
    await expect(newestThread).toHaveCount(0);
    await expect(previousButton).toBeEnabled();
    await expect(nextButton).toBeDisabled();

    await previousButton.click();
    await expect(newestThread).toBeVisible();
  });
});
