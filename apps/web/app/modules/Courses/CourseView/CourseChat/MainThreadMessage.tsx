import { formatDistanceToNow, isSameMinute } from "date-fns";
import { MessagesSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Button } from "~/components/ui/button";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { getDateLocale } from "~/utils/getDateLocale";

import { COURSE_DISCUSSION_HANDLES } from "../../../../../e2e/data/courses/handles";

import { ChatMessage } from "./ChatMessage";
import { CourseChatMessageForm } from "./CourseChatMessageForm";
import { MessagesSkeleton } from "./CourseChatStates";

import type {
  CourseChatMessage,
  CourseChatMessagePreview,
  CourseChatUser,
  CourseChatUserProfile,
} from "~/api/queries/course-chat/courseChatTypes";

type MainThreadMessageProps = {
  message: CourseChatMessage;
  isOpen: boolean;
  isLoadingReplies: boolean;
  replies: CourseChatMessage[];
  users: CourseChatUser[];
  usersById: Map<string, CourseChatUser>;
  mentionableUsers: CourseChatUser[];
  currentUserId: string;
  canDeleteAnyMessage: boolean;
  isSendingReply: boolean;
  hasMoreReplies: boolean;
  isFetchingMoreReplies: boolean;
  onToggle: () => void;
  onReplySubmit: (content: string, options: { onSuccess: () => void }) => void;
  onLoadMoreReplies: () => void;
};

export function MainThreadMessage({
  message,
  isOpen,
  isLoadingReplies,
  replies,
  users,
  usersById,
  mentionableUsers,
  currentUserId,
  canDeleteAnyMessage,
  isSendingReply,
  hasMoreReplies,
  isFetchingMoreReplies,
  onToggle,
  onReplySubmit,
  onLoadMoreReplies,
}: MainThreadMessageProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const replyCount = message.replyCount;
  const displayedReplyCountText = replyCount
    ? t("studentCourseView.courseChat.repliesCount", {
        count: Math.min(replyCount, 99),
        countLabel: getCappedReplyCountLabel(replyCount),
      })
    : null;
  const latestReplyDistance = message.latestReply
    ? formatDistanceToNow(new Date(message.latestReply.createdAt), {
        addSuffix: true,
        locale: getDateLocale(language),
      })
    : null;
  const repliesContent = match({ isLoadingReplies, hasReplies: replies.length > 0 })
    .with({ isLoadingReplies: true }, () => <MessagesSkeleton />)
    .with({ hasReplies: true }, () =>
      replies.map((message, index) => {
        const previousMessage = replies[index - 1];
        const isChained =
          previousMessage?.userId === message.userId &&
          isSameMinute(new Date(previousMessage.createdAt), new Date(message.createdAt));

        return (
          <ChatMessage
            key={message.id}
            message={message}
            users={users}
            usersById={usersById}
            currentUserId={currentUserId}
            canDeleteAnyMessage={canDeleteAnyMessage}
            showAvatar={!isChained}
            showMeta={!isChained}
          />
        );
      }),
    )
    .otherwise(() => null);

  return (
    <article
      className="rounded-2xl bg-transparent"
      data-testid={COURSE_DISCUSSION_HANDLES.thread(message.id)}
    >
      <ChatMessage
        message={message}
        users={users}
        usersById={usersById}
        currentUserId={currentUserId}
        canDeleteAnyMessage={canDeleteAnyMessage}
        onReply={message.deletedAt ? undefined : onToggle}
      />

      <div className="mt-1 flex items-center gap-2 pl-10">
        {message.latestReply && (
          <LatestReplyAvatars
            replies={replies.length ? replies : message.replyParticipants}
            usersById={usersById}
          />
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1.5 px-2 text-xs text-neutral-600"
          data-testid={COURSE_DISCUSSION_HANDLES.repliesToggle(message.id)}
          onClick={onToggle}
        >
          <MessagesSquare className="size-3.5" />
          {replyCount ? displayedReplyCountText : t("studentCourseView.courseChat.reply")}
        </Button>
        {latestReplyDistance && (
          <span className="text-[11px] leading-4 text-neutral-500">{latestReplyDistance}</span>
        )}
      </div>

      {isOpen && (
        <div
          className="mt-1.5 border-l border-primary-100 pl-3 md:ml-10"
          data-testid={COURSE_DISCUSSION_HANDLES.replies(message.id)}
        >
          <div className="flex flex-col gap-2.5 pr-2">
            {repliesContent}

            {hasMoreReplies && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 self-start px-2 text-xs text-neutral-600"
                disabled={isFetchingMoreReplies}
                onClick={onLoadMoreReplies}
              >
                {t("studentCourseView.courseChat.loadMoreReplies")}
              </Button>
            )}

            {!message.deletedAt && (
              <CourseChatMessageForm
                users={mentionableUsers}
                placeholder={t("studentCourseView.courseChat.replyPlaceholder")}
                isSubmitting={isSendingReply}
                onSubmit={onReplySubmit}
                formClassName="flex flex-col gap-2"
                wrapperClassName="flex flex-col gap-1.5 rounded-lg border border-neutral-200 bg-background p-1.5 shadow-sm transition focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-100"
                textareaClassName="min-h-6 resize-none overflow-hidden border-0 px-1 py-0.5 text-sm leading-5 shadow-none focus-visible:ring-0"
                testIds={{
                  form: COURSE_DISCUSSION_HANDLES.replyForm(message.id),
                  input: COURSE_DISCUSSION_HANDLES.replyInput(message.id),
                  sendButton: COURSE_DISCUSSION_HANDLES.replySendButton(message.id),
                }}
              />
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function LatestReplyAvatars({
  replies,
  usersById,
}: {
  replies: CourseChatMessagePreview[] | CourseChatUserProfile[];
  usersById: Map<string, CourseChatUser>;
}) {
  const orderedReplies = areMessagePreviews(replies)
    ? [...replies].sort(
        (firstReply, secondReply) =>
          new Date(secondReply.createdAt).getTime() - new Date(firstReply.createdAt).getTime(),
      )
    : replies;

  const participants = orderedReplies.reduce<CourseChatUserProfile[]>((acc, reply) => {
    const replyUser = "user" in reply ? reply.user : reply;

    if (acc.some((user) => user.id === replyUser.id)) return acc;

    const user = usersById.get(replyUser.id) ?? replyUser;
    acc.push(user);

    return acc;
  }, []);

  if (!participants.length) return null;

  return (
    <div className="flex -space-x-1">
      {participants.slice(0, 3).map((user) => {
        const userName = `${user.firstName} ${user.lastName}`;

        return (
          <UserAvatar
            key={user.id}
            className="size-4 bg-neutral-100 ring-1 ring-background"
            userName={userName}
            profilePictureUrl={user.avatarReference}
          />
        );
      })}
    </div>
  );
}

function getCappedReplyCountLabel(replyCount: number) {
  return replyCount > 99 ? "99+" : String(replyCount);
}

function areMessagePreviews(
  replies: CourseChatMessagePreview[] | CourseChatUserProfile[],
): replies is CourseChatMessagePreview[] {
  return replies.some((reply) => "user" in reply);
}
