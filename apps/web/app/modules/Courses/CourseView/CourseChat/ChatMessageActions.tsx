import { Reply, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  COURSE_CHAT_REACTIONS,
  useToggleCourseChatMessageReaction,
} from "~/api/queries/course-chat/useCourseChat";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

import { ReactionButton } from "./ReactionButton";

import type { CourseChatMessageReaction } from "~/api/queries/course-chat/courseChatTypes";

type ChatMessageActionsProps = {
  messageId: string;
  reactions: CourseChatMessageReaction[];
  canReply: boolean;
  canDelete: boolean;
  isDeleting: boolean;
  onReply?: () => void;
  onDelete: () => void;
};

export function ChatMessageActions({
  messageId,
  reactions,
  canReply,
  canDelete,
  isDeleting,
  onReply,
  onDelete,
}: ChatMessageActionsProps) {
  const { t } = useTranslation();
  const toggleReaction = useToggleCourseChatMessageReaction();
  const reactWithLabel = (reaction: string) =>
    t("studentCourseView.courseChat.reactWith", { reaction });

  return (
    <div className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-neutral-200 bg-background px-1 py-1 opacity-0 shadow-md transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
      {COURSE_CHAT_REACTIONS.map((reaction) => (
        <ReactionButton
          key={reaction}
          reaction={reaction}
          reactedByCurrentUser={reactions.some(
            (item) => item.reaction === reaction && item.reactedByCurrentUser,
          )}
          disabled={toggleReaction.isPending}
          tooltip={reactWithLabel(reaction)}
          compact
          onClick={() => toggleReaction.mutate({ messageId, reaction })}
        />
      ))}
      {canReply ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                aria-label={t("studentCourseView.courseChat.reply")}
                className="size-6 rounded-full p-0 text-neutral-600 hover:bg-primary-50 hover:text-primary-700"
                onClick={onReply}
              >
                <Reply className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("studentCourseView.courseChat.reply")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
      {canDelete ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                aria-label={t("studentCourseView.courseChat.deleteMessage")}
                className="size-6 rounded-full p-0 text-neutral-600 hover:bg-red-50 hover:text-red-700"
                disabled={isDeleting}
                onClick={onDelete}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("studentCourseView.courseChat.deleteMessage")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}
