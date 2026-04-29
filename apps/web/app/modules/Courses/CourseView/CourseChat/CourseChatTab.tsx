import { MessageSquare, PanelRightClose, PanelRightOpen, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useCourseChatThreadMessages,
  useCourseChatThreads,
  useCourseChatUsers,
  useCreateCourseChatMessage,
  useCreateCourseChatThread,
} from "~/api/queries/course-chat/useCourseChat";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useToast } from "~/components/ui/use-toast";

import { ChatUsersPanel } from "./ChatUsersPanel";
import { EmptyState, MainFeedSkeleton } from "./CourseChatStates";
import { getMentionedUserIds } from "./courseChatUtils";
import { MainThreadMessage } from "./MainThreadMessage";
import { MentionTextarea } from "./MentionTextarea";
import { useCourseChatSocket } from "./useCourseChatSocket";

import type { FormEvent, KeyboardEvent } from "react";

type CourseChatTabProps = {
  courseId: string;
  currentUserId: string;
};

export function CourseChatTab({ courseId, currentUserId }: CourseChatTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [openThreadId, setOpenThreadId] = useState<string | undefined>();
  const [isRosterOpen, setIsRosterOpen] = useState(true);
  const [newThreadContent, setNewThreadContent] = useState("");
  const [replyContent, setReplyContent] = useState("");

  const { data: threadsResponse, isLoading: isLoadingThreads } = useCourseChatThreads(courseId);
  const { data: chatUsers = [], isLoading: isLoadingUsers } = useCourseChatUsers(courseId);
  const mentionableUsers = useMemo(
    () => chatUsers.filter((user) => user.id !== currentUserId),
    [chatUsers, currentUserId],
  );
  const threads = useMemo(() => threadsResponse?.data ?? [], [threadsResponse?.data]);
  const openThread = threads.find((thread) => thread.id === openThreadId);

  const { data: messagesResponse, isLoading: isLoadingMessages } =
    useCourseChatThreadMessages(openThreadId);
  const replies =
    messagesResponse?.data.filter((message) => message.id !== openThread?.rootMessage.id) ?? [];

  const createThread = useCreateCourseChatThread(courseId);
  const createMessage = useCreateCourseChatMessage(openThreadId);

  const handleMentioned = useCallback(() => {
    toast({ description: t("studentCourseView.courseChat.mentionedToast") });
  }, [t, toast]);

  useCourseChatSocket({ courseId, enabled: Boolean(courseId), onMentioned: handleMentioned });

  useEffect(() => {
    if (openThreadId && !threads.some((thread) => thread.id === openThreadId)) {
      setOpenThreadId(undefined);
    }
  }, [openThreadId, threads]);

  const handleCreateThread = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = newThreadContent.trim();
    if (!content) return;

    const result = await createThread.mutateAsync({
      content,
      mentionedUserIds: getMentionedUserIds(content, mentionableUsers),
    });
    setNewThreadContent("");
    setOpenThreadId(result.thread.id);
  };

  const handleCreateMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = replyContent.trim();
    if (!content || !openThreadId) return;

    await createMessage.mutateAsync({
      content,
      mentionedUserIds: getMentionedUserIds(content, mentionableUsers),
    });
    setReplyContent("");
  };

  const handleNewThreadKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-neutral-200">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="h5 flex items-center gap-2">
            <MessageSquare className="size-5 text-primary-700" />
            {t("studentCourseView.courseChat.title")}
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setIsRosterOpen((current) => !current)}
          >
            {isRosterOpen ? (
              <PanelRightClose className="size-4" />
            ) : (
              <PanelRightOpen className="size-4" />
            )}
            {t("studentCourseView.courseChat.users")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid min-h-[640px] bg-neutral-50 p-0 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-6 md:px-6">
            {isLoadingThreads ? (
              <MainFeedSkeleton />
            ) : threads.length ? (
              threads.map((thread) => (
                <MainThreadMessage
                  key={thread.id}
                  thread={thread}
                  isOpen={thread.id === openThreadId}
                  isLoadingReplies={isLoadingMessages && thread.id === openThreadId}
                  replies={thread.id === openThreadId ? replies : []}
                  users={chatUsers}
                  mentionableUsers={mentionableUsers}
                  replyContent={thread.id === openThreadId ? replyContent : ""}
                  isSendingReply={createMessage.isPending && thread.id === openThreadId}
                  onToggle={() =>
                    setOpenThreadId((current) => (current === thread.id ? undefined : thread.id))
                  }
                  onReplyChange={setReplyContent}
                  onReplySubmit={handleCreateMessage}
                />
              ))
            ) : (
              <EmptyState text={t("studentCourseView.courseChat.emptyThreads")} />
            )}
          </div>

          <form
            className="border-t border-neutral-200 bg-background p-4 md:p-6"
            onSubmit={handleCreateThread}
          >
            <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-background p-3 shadow-sm">
              <MentionTextarea
                value={newThreadContent}
                onChange={setNewThreadContent}
                onKeyDown={handleNewThreadKeyDown}
                users={mentionableUsers}
                placeholder={t("studentCourseView.courseChat.newThreadPlaceholder")}
                maxLength={5000}
                className="min-h-[96px] resize-none border-0 px-0 shadow-none focus-visible:ring-0"
              />
              <Button
                type="submit"
                className="self-end gap-2"
                disabled={!newThreadContent.trim() || createThread.isPending}
              >
                <Send className="size-4" />
                {t("studentCourseView.courseChat.send")}
              </Button>
            </div>
          </form>
        </div>

        {isRosterOpen && <ChatUsersPanel users={chatUsers} isLoading={isLoadingUsers} />}
      </CardContent>
    </Card>
  );
}
