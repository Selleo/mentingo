import { format } from "date-fns";
import { MessageSquare, MessagesSquare, PanelRightClose, PanelRightOpen, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type CourseChatMessage,
  type CourseChatThread,
  type CourseChatUser,
  useCourseChatThreadMessages,
  useCourseChatThreads,
  useCourseChatUsers,
  useCreateCourseChatMessage,
  useCreateCourseChatThread,
} from "~/api/queries/course-chat/useCourseChat";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Textarea } from "~/components/ui/textarea";
import { useToast } from "~/components/ui/use-toast";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { cn } from "~/lib/utils";

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

function ChatUsersPanel({ users, isLoading }: { users: CourseChatUser[]; isLoading: boolean }) {
  const { t } = useTranslation();
  const onlineCount = users.filter((user) => user.isOnline).length;

  return (
    <aside className="border-t border-neutral-200 bg-background p-4 lg:w-72 lg:border-l lg:border-t-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="body-base-md text-neutral-950">
            {t("studentCourseView.courseChat.users")}
          </h3>
          <p className="caption text-neutral-500">
            {t("studentCourseView.courseChat.onlineCount", {
              online: onlineCount,
              total: users.length,
            })}
          </p>
        </div>
      </div>

      <div className="flex max-h-[560px] flex-col gap-2 overflow-y-auto">
        {isLoading ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : users.length ? (
          users.map((user) => {
            const userName = `${user.firstName} ${user.lastName}`;

            return (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-lg p-2 hover:bg-neutral-50"
              >
                <div className="relative">
                  <UserAvatar
                    className="size-9"
                    userName={userName}
                    profilePictureUrl={user.avatarReference}
                  />
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 size-3 rounded-full border-2 border-background",
                      user.isOnline ? "bg-green-500" : "bg-neutral-300",
                    )}
                  />
                </div>
                <div className="min-w-0">
                  <p className="body-sm-md truncate text-neutral-950">{userName}</p>
                  <p className="caption text-neutral-500">
                    {user.isOnline
                      ? t("studentCourseView.courseChat.online")
                      : t("studentCourseView.courseChat.offline")}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState text={t("studentCourseView.courseChat.emptyUsers")} />
        )}
      </div>
    </aside>
  );
}

function MainThreadMessage({
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
}: {
  thread: CourseChatThread;
  isOpen: boolean;
  isLoadingReplies: boolean;
  replies: CourseChatMessage[];
  users: CourseChatUser[];
  mentionableUsers: CourseChatUser[];
  replyContent: string;
  isSendingReply: boolean;
  onToggle: () => void;
  onReplyChange: (value: string) => void;
  onReplySubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
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
            ) : (
              <EmptyState text={t("studentCourseView.courseChat.emptyMessages")} />
            )}

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

function MentionTextarea({
  value,
  onChange,
  users,
  placeholder,
  maxLength,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  users: CourseChatUser[];
  placeholder: string;
  maxLength: number;
  className?: string;
}) {
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isPickerDismissed, setIsPickerDismissed] = useState(false);
  const mentionQuery = getActiveMentionQuery(value);
  const matchingUsers = useMemo(() => {
    if (mentionQuery === null || isPickerDismissed) return [];

    const normalizedQuery = mentionQuery.toLowerCase();

    return users
      .filter((user) => getUserDisplayName(user).toLowerCase().includes(normalizedQuery))
      .slice(0, 6);
  }, [isPickerDismissed, mentionQuery, users]);

  useEffect(() => {
    setHighlightedIndex(0);
    setIsPickerDismissed(false);
  }, [mentionQuery]);

  const insertMention = (user: CourseChatUser) => {
    const mention = `@${getUserDisplayName(user)} `;
    const nextValue = value.replace(/(^|\s)@([^\s@]*)$/, `$1${mention}`);
    onChange(nextValue);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!matchingUsers.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % matchingUsers.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => (current - 1 + matchingUsers.length) % matchingUsers.length);
      return;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      insertMention(matchingUsers[highlightedIndex]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsPickerDismissed(true);
    }
  };

  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        className={className}
      />
      {matchingUsers.length > 0 && (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-72 rounded-xl border border-neutral-200 bg-background p-2 shadow-lg">
          {matchingUsers.map((user, index) => {
            const userName = getUserDisplayName(user);

            return (
              <button
                key={user.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-neutral-50",
                  index === highlightedIndex && "bg-neutral-50",
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertMention(user);
                }}
              >
                <UserAvatar
                  className="size-8"
                  userName={userName}
                  profilePictureUrl={user.avatarReference}
                />
                <span className="body-sm-md truncate text-neutral-950">{userName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChatMessage({ message, users }: { message: CourseChatMessage; users: CourseChatUser[] }) {
  const authorName = `${message.user.firstName} ${message.user.lastName}`;

  return (
    <div className="flex gap-3">
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
      </div>
    </div>
  );
}

function getUserDisplayName(user: CourseChatUser) {
  return `${user.firstName} ${user.lastName}`;
}

function getActiveMentionQuery(value: string) {
  const match = value.match(/(^|\s)@([^\s@]*)$/);

  return match?.[2] ?? null;
}

function getMentionedUserIds(content: string, users: CourseChatUser[]) {
  return users
    .filter((user) => content.includes(`@${getUserDisplayName(user)}`))
    .map((user) => user.id);
}

function renderMessageContent(content: string, users: CourseChatUser[]) {
  const mentionLabels = users
    .map((user) => `@${getUserDisplayName(user)}`)
    .sort((a, b) => b.length - a.length);

  if (!mentionLabels.length) return content;

  const mentionRegex = new RegExp(`(${mentionLabels.map(escapeRegExp).join("|")})`, "g");

  return content.split(mentionRegex).map((part, index) =>
    mentionLabels.includes(part) ? (
      <span key={`${part}-${index}`} className="font-medium text-primary-700">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-background p-6 text-center">
      <p className="body-sm text-neutral-600">{text}</p>
    </div>
  );
}

function MainFeedSkeleton() {
  return (
    <>
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </>
  );
}

function MessagesSkeleton() {
  return (
    <>
      <Skeleton className="h-16 w-3/4" />
      <Skeleton className="ml-auto h-16 w-2/3" />
    </>
  );
}
