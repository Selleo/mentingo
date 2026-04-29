import { format } from "date-fns";
import { MessagesSquare, Send } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { ChatMessage } from "./ChatMessage";
import { MessagesSkeleton } from "./CourseChatStates";
import { MentionTextarea } from "./MentionTextarea";

import type { FormEvent } from "react";
import type {
  CourseChatMessage as CourseChatMessageType,
  CourseChatThread,
  CourseChatUser,
} from "~/api/queries/course-chat/useCourseChat";

type MainThreadMessageProps = {
  thread: CourseChatThread;
  isOpen: boolean;
  isLoadingReplies: boolean;
  replies: CourseChatMessageType[];
  users: CourseChatUser[];
  mentionableUsers: CourseChatUser[];
  replyContent: string;
  isSendingReply: boolean;
  onToggle: () => void;
  onReplyChange: (value: string) => void;
  onReplySubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function MainThreadMessage({
  thread,
  isOpen,
  isLoadingReplies,
  replies,
  users,
  mentionableUsers,
  replyContent,
  isSendingReply,
  onToggle,
  onReplyChange,
  onReplySubmit,
}: MainThreadMessageProps) {
  const { t } = useTranslation();
  const replyCount = Math.max(thread.messageCount - 1, 0);

  return (
    <article className="rounded-xl border border-neutral-200 bg-background p-4 shadow-sm">
      <ChatMessage message={thread.rootMessage} users={users} />

      <div className="mt-3 flex flex-wrap items-center gap-3 pl-11">
        <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={onToggle}>
          <MessagesSquare className="size-4" />
          {replyCount
            ? t("studentCourseView.courseChat.repliesCount", { count: replyCount })
            : t("studentCourseView.courseChat.reply")}
        </Button>
        {thread.latestMessage && thread.latestMessage.id !== thread.rootMessage.id && (
          <span className="caption text-neutral-500">
            {format(new Date(thread.latestMessage.createdAt), "dd.MM.yyyy HH:mm")}
          </span>
        )}
      </div>

      {isOpen && (
        <div className="mt-4 border-l-2 border-primary-100 pl-4 md:ml-11">
          <div className="flex flex-col gap-4">
            {isLoadingReplies ? (
              <MessagesSkeleton />
            ) : replies.length ? (
              replies.map((message) => (
                <ChatMessage key={message.id} message={message} users={users} />
              ))
            ) : null}

            <form className="flex flex-col gap-3" onSubmit={onReplySubmit}>
              <MentionTextarea
                value={replyContent}
                onChange={onReplyChange}
                users={mentionableUsers}
                placeholder={t("studentCourseView.courseChat.replyPlaceholder")}
                maxLength={5000}
                className="min-h-[80px] resize-none"
              />
              <Button
                type="submit"
                className="self-end gap-2"
                disabled={!replyContent.trim() || isSendingReply}
              >
                <Send className="size-4" />
                {t("studentCourseView.courseChat.send")}
              </Button>
            </form>
          </div>
        </div>
      )}
    </article>
  );
}
