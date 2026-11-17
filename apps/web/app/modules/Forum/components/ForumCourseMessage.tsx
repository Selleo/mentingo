import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateCourseChatMessage } from "~/api/queries/course-chat/useCreateCourseChatMessage";
import { useInfiniteCourseChatReplies } from "~/api/queries/course-chat/useInfiniteCourseChatReplies";
import { Button } from "~/components/ui/button";
import { getMentionedUserIds } from "~/modules/Courses/CourseView/CourseChat/courseChatUtils";

import { FORUM_HANDLES } from "../../../../e2e/data/forum/handles";

import { ForumPostCard } from "./ForumPostCard";
import { ForumReplyForm } from "./ForumReplyForm";

import type { CourseChatMessage, CourseChatUser } from "~/api/queries/course-chat/courseChatTypes";

type ForumCourseMessageProps = {
  message: CourseChatMessage;
  users: CourseChatUser[];
  mentionableUsers: CourseChatUser[];
  canReply: boolean;
  canReact: boolean;
  canDelete: (authorId: string) => boolean;
  isDeleting: boolean;
  isReacting: boolean;
  onDelete: (messageId: string, onDeleted: () => void) => void;
  onToggleReaction: (messageId: string, reaction: string) => void;
};

export function ForumCourseMessage({
  message,
  users,
  mentionableUsers,
  canReply,
  canReact,
  canDelete,
  isDeleting,
  isReacting,
  onDelete,
  onToggleReaction,
}: ForumCourseMessageProps) {
  const { t } = useTranslation();
  const [isReplyFormOpen, setIsReplyFormOpen] = useState(false);
  const { mutate: createReply, isPending: isSendingReply } = useCreateCourseChatMessage(
    message.courseId,
  );
  const hasReplies = message.replyCount > 0;
  const {
    data: repliesResponse,
    fetchNextPage: fetchMoreReplies,
    hasNextPage: hasMoreReplies,
    isFetchingNextPage: isFetchingMoreReplies,
  } = useInfiniteCourseChatReplies(hasReplies ? message.id : undefined);
  const replies = hasReplies ? (repliesResponse?.pages.flatMap((page) => page.data) ?? []) : [];
  const canReplyToMessage = canReply && !message.deletedAt;
  const showReplyForm = isReplyFormOpen && canReplyToMessage;

  const handleReply = (content: string, onSent: () => void) => {
    createReply(
      {
        content,
        parentMessageId: message.id,
        mentionedUserIds: getMentionedUserIds(content, mentionableUsers),
      },
      {
        onSuccess: () => {
          onSent();
          setIsReplyFormOpen(false);
        },
      },
    );
  };

  return (
    <ForumPostCard
      post={message}
      mentionableUsers={users}
      canDelete={!message.deletedAt && canDelete(message.userId)}
      isDeleting={isDeleting}
      onDelete={onDelete}
      canReact={canReact}
      isReacting={isReacting}
      onToggleReaction={onToggleReaction}
      onReply={canReplyToMessage ? () => setIsReplyFormOpen((isOpen) => !isOpen) : undefined}
    >
      {(replies.length > 0 || showReplyForm) && (
        <div
          className="space-y-3 border-l-2 border-neutral-200 pl-4"
          data-testid={FORUM_HANDLES.postReplies(message.id)}
        >
          {replies.map((reply) => (
            <ForumPostCard
              key={reply.id}
              post={reply}
              mentionableUsers={users}
              canDelete={!reply.deletedAt && canDelete(reply.userId)}
              isDeleting={isDeleting}
              onDelete={onDelete}
              canReact={canReact}
              isReacting={isReacting}
              onToggleReaction={onToggleReaction}
            />
          ))}
          {hasMoreReplies && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isFetchingMoreReplies}
              onClick={() => fetchMoreReplies()}
              data-testid={FORUM_HANDLES.postLoadMoreReplies(message.id)}
            >
              {t("studentCourseView.courseChat.loadMoreReplies")}
            </Button>
          )}
          {showReplyForm && (
            <ForumReplyForm
              users={mentionableUsers}
              isSubmitting={isSendingReply}
              onSubmit={handleReply}
              placeholder={t("studentCourseView.courseChat.replyPlaceholder")}
              testIds={{
                input: FORUM_HANDLES.postReplyInput(message.id),
                submitButton: FORUM_HANDLES.postReplySubmitButton(message.id),
              }}
            />
          )}
        </div>
      )}
    </ForumPostCard>
  );
}
