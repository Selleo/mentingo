import { format } from "date-fns";

import {
  COURSE_CHAT_REACTIONS,
  type CourseChatMessage as CourseChatMessageType,
  type CourseChatUser,
  useToggleCourseChatMessageReaction,
} from "~/api/queries/course-chat/useCourseChat";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";

import { renderMessageContent } from "./courseChatUtils";
import { ReactionButton } from "./ReactionButton";

type ChatMessageProps = {
  message: CourseChatMessageType;
  users: CourseChatUser[];
};

export function ChatMessage({ message, users }: ChatMessageProps) {
  const authorName = `${message.user.firstName} ${message.user.lastName}`;
  const toggleReaction = useToggleCourseChatMessageReaction();
  const reactions = message.reactions ?? [];

  return (
    <div className="group flex gap-3">
      <UserAvatar
        className="size-9"
        userName={authorName}
        profilePictureUrl={message.user.avatarReference}
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="body-sm-md text-neutral-950">{authorName}</span>
          <span className="caption text-neutral-500">
            {format(new Date(message.createdAt), "dd.MM.yyyy HH:mm")}
          </span>
        </div>
        <div className="rounded-xl bg-neutral-100 px-4 py-3 text-neutral-950">
          <p className="body-sm whitespace-pre-wrap break-words">
            {renderMessageContent(message.content, users)}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {reactions.map((reactionSummary) => (
            <ReactionButton
              key={reactionSummary.reaction}
              reaction={reactionSummary.reaction}
              count={reactionSummary.count}
              reactedByCurrentUser={reactionSummary.reactedByCurrentUser}
              disabled={toggleReaction.isPending}
              onClick={() =>
                toggleReaction.mutate({
                  messageId: message.id,
                  reaction: reactionSummary.reaction,
                })
              }
            />
          ))}
          <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
            {COURSE_CHAT_REACTIONS.filter(
              (reaction) => !reactions.some((item) => item.reaction === reaction),
            ).map((reaction) => (
              <ReactionButton
                key={reaction}
                reaction={reaction}
                disabled={toggleReaction.isPending}
                onClick={() => toggleReaction.mutate({ messageId: message.id, reaction })}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
