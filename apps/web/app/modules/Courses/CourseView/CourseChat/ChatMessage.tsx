import { format } from "date-fns";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import {
  useDeleteCourseChatMessage,
  useToggleCourseChatMessageReaction,
} from "~/api/queries/course-chat/useCourseChat";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { cn } from "~/lib/utils";

import { COURSE_DISCUSSION_HANDLES } from "../../../../../e2e/data/courses/handles";

import { ChatMessageActions } from "./ChatMessageActions";
import { renderMessageContent } from "./courseChatUtils";
import { DeleteCourseChatMessageDialog } from "./DeleteCourseChatMessageDialog";
import { ReactionButton } from "./ReactionButton";

import type { CourseChatMessage, CourseChatUser } from "~/api/queries/course-chat/courseChatTypes";

type ChatMessageProps = {
  message: CourseChatMessage;
  users: CourseChatUser[];
  usersById: Map<string, CourseChatUser>;
  currentUserId: string;
  canDeleteAnyMessage: boolean;
  showAvatar?: boolean;
  showMeta?: boolean;
  onReply?: () => void;
};

export function ChatMessage({
  message,
  users,
  usersById,
  currentUserId,
  canDeleteAnyMessage,
  showAvatar = true,
  showMeta = true,
  onReply,
}: ChatMessageProps) {
  const { t } = useTranslation();
  const authorPresence = usersById.get(message.userId);
  const authorName = authorPresence
    ? `${authorPresence.firstName} ${authorPresence.lastName}`
    : `${message.user.firstName} ${message.user.lastName}`;
  const avatarReference = authorPresence?.avatarReference || message.user.avatarReference;
  const isOwnMessage = message.userId === currentUserId;
  const isDeleted = Boolean(message.deletedAt);
  const canDeleteMessage = !isDeleted && (canDeleteAnyMessage || isOwnMessage);
  const toggleReaction = useToggleCourseChatMessageReaction();
  const deleteMessage = useDeleteCourseChatMessage();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const reactions = message.reactions ?? [];
  const messageBubbleClassName = match({ isDeleted, isOwnMessage })
    .with(
      { isDeleted: true },
      () => "border border-dashed border-neutral-200 bg-neutral-100 text-neutral-500 shadow-none",
    )
    .with({ isOwnMessage: true }, () => "border border-primary-100 bg-primary-50 text-neutral-950")
    .otherwise(() => "border border-neutral-100 bg-background text-neutral-950");
  const confirmDelete = () => {
    deleteMessage.mutate(message.id, {
      onSuccess: () => setDeleteDialogOpen(false),
    });
  };

  return (
    <div
      className="group flex w-full min-w-0 gap-2.5"
      data-testid={COURSE_DISCUSSION_HANDLES.message(message.id)}
    >
      {showAvatar && !isDeleted ? (
        <MessageAvatar
          userName={authorName}
          avatarReference={avatarReference}
          isOnline={Boolean(authorPresence?.isOnline)}
          hasMeta={showMeta}
        />
      ) : (
        <div className="size-8 shrink-0" />
      )}
      <div className="relative w-full min-w-0 max-w-[calc(100%-2.75rem)] md:max-w-[min(36rem,86%)]">
        {showMeta && !isDeleted && (
          <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="body-sm-md text-neutral-950">{authorName}</span>
            <span className="text-[11px] leading-4 text-neutral-500">
              {format(new Date(message.createdAt), "dd.MM.yyyy HH:mm")}
            </span>
          </div>
        )}
        <div className="relative w-full">
          {!isDeleted && (onReply || canDeleteMessage) && (
            <ChatMessageActions
              messageId={message.id}
              reactions={reactions}
              canReply={Boolean(onReply)}
              canDelete={canDeleteMessage}
              isDeleting={deleteMessage.isPending}
              onReply={onReply}
              onDelete={() => setDeleteDialogOpen(true)}
            />
          )}
          <div
            className={cn(
              "inline-block max-w-full rounded-xl px-3 py-2 text-[0.875rem] leading-5 shadow-sm",
              "rounded-tl-md",
              messageBubbleClassName,
            )}
            data-testid={COURSE_DISCUSSION_HANDLES.messageContent(message.id)}
          >
            <p className={cn("whitespace-pre-wrap break-words", { italic: isDeleted })}>
              {isDeleted
                ? t("studentCourseView.courseChat.deletedMessage")
                : renderMessageContent(message.content, users)}
            </p>
          </div>
        </div>
        {!isDeleted && reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {reactions.map((reactionSummary) => (
              <ReactionButton
                key={reactionSummary.reaction}
                reaction={reactionSummary.reaction}
                count={reactionSummary.count}
                reactedByCurrentUser={reactionSummary.reactedByCurrentUser}
                disabled={toggleReaction.isPending}
                tooltip={t("studentCourseView.courseChat.reactWith", {
                  reaction: reactionSummary.reaction,
                })}
                testId={COURSE_DISCUSSION_HANDLES.messageReactionSummary(
                  message.id,
                  reactionSummary.reaction,
                )}
                onClick={() =>
                  toggleReaction.mutate({
                    messageId: message.id,
                    reaction: reactionSummary.reaction,
                  })
                }
              />
            ))}
          </div>
        )}
      </div>
      <DeleteCourseChatMessageDialog
        open={deleteDialogOpen}
        isDeleting={deleteMessage.isPending}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title={t("studentCourseView.courseChat.deleteMessageConfirmationTitle")}
        description={t("studentCourseView.courseChat.deleteMessageConfirmationDescription")}
        cancelLabel={t("common.button.cancel")}
        deleteLabel={t("common.button.delete")}
      />
    </div>
  );
}

function MessageAvatar({
  avatarReference,
  hasMeta,
  isOnline,
  userName,
}: {
  avatarReference: string | null;
  hasMeta: boolean;
  isOnline: boolean;
  userName: string;
}) {
  return (
    <div className={cn("relative size-8 shrink-0 overflow-visible", { "mt-4": hasMeta })}>
      <UserAvatar
        className="size-8 bg-neutral-100 ring-1 ring-neutral-200"
        userName={userName}
        profilePictureUrl={avatarReference}
      />
      <span
        className={cn(
          "absolute bottom-0 right-0 z-10 size-2.5 rounded-full border-[1.5px] border-background",
          {
            "bg-emerald-500": isOnline,
            "bg-neutral-300": !isOnline,
          },
        )}
      />
    </div>
  );
}
