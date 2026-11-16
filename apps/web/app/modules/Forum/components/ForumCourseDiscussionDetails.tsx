import { Link, useSearchParams } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { ArrowLeft } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  COURSE_CHAT_MESSAGES_PER_PAGE,
  useCourseChatMessages,
} from "~/api/queries/course-chat/useCourseChatMessages";
import { useCourseChatUsers } from "~/api/queries/course-chat/useCourseChatUsers";
import { useCreateCourseChatMessage } from "~/api/queries/course-chat/useCreateCourseChatMessage";
import { useDeleteCourseChatMessage } from "~/api/queries/course-chat/useDeleteCourseChatMessage";
import { useToggleCourseChatMessageReaction } from "~/api/queries/course-chat/useToggleCourseChatMessageReaction";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { hasPermission } from "~/common/permissions/permission.utils";
import { useClampedPage } from "~/components/DataTable";
import { Pagination } from "~/components/Pagination/Pagination";
import { useToast } from "~/components/ui/use-toast";
import { getMentionedUserIds } from "~/modules/Courses/CourseView/CourseChat/courseChatUtils";
import { useCourseChatSocket } from "~/modules/Courses/CourseView/CourseChat/useCourseChatSocket";

import { FORUM_HANDLES } from "../../../../e2e/data/forum/handles";
import { canDeleteCourseDiscussionMessage, parsePageParam } from "../forum.utils";

import { ForumCourseMessage } from "./ForumCourseMessage";
import { ForumReplyForm } from "./ForumReplyForm";

import type { ForumCourseDiscussion } from "~/api/queries/forum/forumTypes";

type ForumCourseDiscussionDetailsProps = {
  courseDiscussion: ForumCourseDiscussion;
};

export function ForumCourseDiscussionDetails({
  courseDiscussion,
}: ForumCourseDiscussionDetailsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { courseId } = courseDiscussion;
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePageParam(searchParams.get("page"));
  const [replyFormMessageId, setReplyFormMessageId] = useState<string>();
  const { data: currentUser } = useCurrentUser();
  const permissions = currentUser?.permissions ?? [];
  const canPost = hasPermission(permissions, PERMISSIONS.COURSE_DISCUSSION_MESSAGE_CREATE);
  const canReact = hasPermission(permissions, PERMISSIONS.COURSE_DISCUSSION_MESSAGE_REACT);

  const { data: messagesResponse } = useCourseChatMessages(courseId, page);
  const totalMessages = messagesResponse?.pagination.totalItems;
  const messages = messagesResponse?.data ?? [];

  const { data: users = [] } = useCourseChatUsers(courseId);
  const mentionableUsers = useMemo(
    () => users.filter((user) => user.id !== currentUser?.id),
    [users, currentUser?.id],
  );

  const {
    mutate: createMessage,
    isPending: isSendingMessage,
    variables: sendingMessage,
  } = useCreateCourseChatMessage(courseId);
  const { mutate: deleteMessage, isPending: isDeletingMessage } = useDeleteCourseChatMessage();
  const { mutate: toggleReaction, isPending: isReacting } = useToggleCourseChatMessageReaction();

  const handleMentioned = useCallback(() => {
    toast({ description: t("studentCourseView.courseChat.mentionedToast") });
  }, [t, toast]);

  useCourseChatSocket({ courseId, enabled: true, onMentioned: handleMentioned });

  const goToPage = (nextPage: number) => {
    setReplyFormMessageId(undefined);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (nextPage > 1) next.set("page", String(nextPage));
        else next.delete("page");

        return next;
      },
      { replace: true },
    );
  };

  useClampedPage({
    page,
    perPage: COURSE_CHAT_MESSAGES_PER_PAGE,
    totalItems: totalMessages,
    setPage: goToPage,
  });

  const canDelete = (authorId: string) =>
    canDeleteCourseDiscussionMessage({ authorId, currentUserId: currentUser?.id, permissions });

  const handleSendMessage = (content: string, onSent: () => void) => {
    createMessage(
      { content, mentionedUserIds: getMentionedUserIds(content, mentionableUsers) },
      {
        onSuccess: () => {
          onSent();
          goToPage(1);
        },
      },
    );
  };

  const handleReply = (parentMessageId: string, content: string, onSent: () => void) => {
    createMessage(
      {
        content,
        parentMessageId,
        mentionedUserIds: getMentionedUserIds(content, mentionableUsers),
      },
      {
        onSuccess: () => {
          onSent();
          setReplyFormMessageId(undefined);
        },
      },
    );
  };

  const handleDelete = (messageId: string, onDeleted: () => void) =>
    deleteMessage(messageId, { onSuccess: onDeleted });

  const handleToggleReaction = (messageId: string, reaction: string) =>
    toggleReaction({ messageId, reaction });

  return (
    <section className="flex flex-col gap-6" data-testid={FORUM_HANDLES.COURSE_DISCUSSION_PAGE}>
      <div className="space-y-3">
        <Link
          to="/forum"
          className="body-sm-md inline-flex items-center gap-1 text-primary-700 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("forum.topic.backToForum")}
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1
            className="h4 break-words text-neutral-950"
            data-testid={FORUM_HANDLES.COURSE_DISCUSSION_TITLE}
          >
            {t("forum.courseDiscussions.heading", { course: courseDiscussion.courseTitle })}
          </h1>
          <span className="body-sm text-neutral-600">
            {t("forum.courseDiscussions.messages", { count: courseDiscussion.messageCount })}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {totalMessages === 0 && (
          <p
            className="body-sm text-neutral-600"
            data-testid={FORUM_HANDLES.COURSE_DISCUSSION_EMPTY}
          >
            {t("studentCourseView.courseChat.emptyThreads")}
          </p>
        )}
        {messages.map((message) => (
          <ForumCourseMessage
            key={message.id}
            message={message}
            users={users}
            mentionableUsers={mentionableUsers}
            canReply={canPost}
            canReact={canReact}
            canDelete={canDelete}
            isReplyFormOpen={replyFormMessageId === message.id}
            isSendingReply={isSendingMessage && sendingMessage?.parentMessageId === message.id}
            isDeleting={isDeletingMessage}
            isReacting={isReacting}
            onToggleReplyForm={() =>
              setReplyFormMessageId((current) => (current === message.id ? undefined : message.id))
            }
            onReply={(content, onSent) => handleReply(message.id, content, onSent)}
            onDelete={handleDelete}
            onToggleReaction={handleToggleReaction}
          />
        ))}
        {totalMessages !== undefined && totalMessages > COURSE_CHAT_MESSAGES_PER_PAGE && (
          <Pagination
            totalItems={totalMessages}
            itemsPerPage={COURSE_CHAT_MESSAGES_PER_PAGE}
            currentPage={page}
            canChangeItemsPerPage={false}
            onPageChange={goToPage}
          />
        )}
      </div>

      {canPost && (
        <ForumReplyForm
          users={mentionableUsers}
          isSubmitting={isSendingMessage && !sendingMessage?.parentMessageId}
          onSubmit={handleSendMessage}
          placeholder={t("studentCourseView.courseChat.newThreadPlaceholder")}
          submitLabel={t("studentCourseView.courseChat.send")}
          testIds={{
            input: FORUM_HANDLES.MESSAGE_INPUT,
            submitButton: FORUM_HANDLES.MESSAGE_SUBMIT_BUTTON,
          }}
        />
      )}
    </section>
  );
}
