import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  COURSE_CHAT_MESSAGES_PER_PAGE,
  useInfiniteCourseChatReplies,
  useCourseChatMessages,
  useCourseChatUsers,
  useCreateCourseChatMessage,
} from "~/api/queries/course-chat/useCourseChat";
import { Pagination } from "~/components/Pagination/Pagination";
import { Card, CardContent } from "~/components/ui/card";
import { useToast } from "~/components/ui/use-toast";

import { CourseChatMessageForm } from "./CourseChatMessageForm";
import { EmptyState, MainFeedSkeleton } from "./CourseChatStates";
import { getMentionedUserIds } from "./courseChatUtils";
import { MainThreadMessage } from "./MainThreadMessage";
import { useCourseChatSocket } from "./useCourseChatSocket";
import { useCourseChatState } from "./useCourseChatState";

type CourseChatTabProps = {
  courseId: string;
  currentUserId: string;
  canDeleteAnyMessage: boolean;
};

export function CourseChatTab({
  courseId,
  currentUserId,
  canDeleteAnyMessage,
}: CourseChatTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { openMessageId, page, setOpenMessage, setPage, toggleOpenMessage } = useCourseChatState();

  const { data: messagesResponse, isLoading: isLoadingMessages } = useCourseChatMessages(
    courseId,
    page,
  );
  const { data: chatUsers = [] } = useCourseChatUsers(courseId);
  const chatUsersById = useMemo(
    () => new Map(chatUsers.map((user) => [user.id, user])),
    [chatUsers],
  );
  const mentionableUsers = useMemo(
    () => chatUsers.filter((user) => user.id !== currentUserId),
    [chatUsers, currentUserId],
  );
  const messages = useMemo(() => messagesResponse?.data ?? [], [messagesResponse?.data]);

  const {
    data: repliesResponse,
    fetchNextPage: fetchNextRepliesPage,
    hasNextPage: hasMoreReplies,
    isFetchingNextPage: isFetchingMoreReplies,
    isLoading: isLoadingReplies,
  } = useInfiniteCourseChatReplies(openMessageId);
  const replies = useMemo(
    () => repliesResponse?.pages.flatMap((page) => page.data) ?? [],
    [repliesResponse?.pages],
  );

  const { mutate: createCourseChatMessage, isPending: isCreatingMessage } =
    useCreateCourseChatMessage(courseId);

  const handleMentioned = useCallback(() => {
    toast({ description: t("studentCourseView.courseChat.mentionedToast") });
  }, [t, toast]);

  useCourseChatSocket({ courseId, enabled: Boolean(courseId), onMentioned: handleMentioned });

  useEffect(() => {
    if (openMessageId && !messages.some((message) => message.id === openMessageId)) {
      setOpenMessage();
    }
  }, [openMessageId, messages, setOpenMessage]);

  const handleCreateMessage = (content: string, options: { onSuccess: () => void }) => {
    createCourseChatMessage(
      {
        content,
        mentionedUserIds: getMentionedUserIds(content, mentionableUsers),
      },
      { onSuccess: options.onSuccess },
    );
  };

  const handleCreateReply = (content: string, options: { onSuccess: () => void }) => {
    if (!openMessageId) return;

    createCourseChatMessage(
      {
        content,
        parentMessageId: openMessageId,
        mentionedUserIds: getMentionedUserIds(content, mentionableUsers),
      },
      { onSuccess: options.onSuccess },
    );
  };

  return (
    <Card className="overflow-hidden border-neutral-200 shadow-sm">
      <CardContent className="min-h-[560px] bg-neutral-50 p-0">
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4 md:px-5">
            {isLoadingMessages ? (
              <MainFeedSkeleton />
            ) : messages.length ? (
              messages.map((message) => (
                <MainThreadMessage
                  key={message.id}
                  message={message}
                  isOpen={message.id === openMessageId}
                  isLoadingReplies={isLoadingReplies && message.id === openMessageId}
                  hasMoreReplies={Boolean(hasMoreReplies)}
                  isFetchingMoreReplies={isFetchingMoreReplies}
                  replies={message.id === openMessageId ? replies : []}
                  users={chatUsers}
                  usersById={chatUsersById}
                  mentionableUsers={mentionableUsers}
                  currentUserId={currentUserId}
                  canDeleteAnyMessage={canDeleteAnyMessage}
                  isSendingReply={isCreatingMessage && message.id === openMessageId}
                  onToggle={() => toggleOpenMessage(message.id)}
                  onReplySubmit={handleCreateReply}
                  onLoadMoreReplies={() => fetchNextRepliesPage()}
                />
              ))
            ) : (
              <EmptyState text={t("studentCourseView.courseChat.emptyThreads")} />
            )}
          </div>

          {messagesResponse?.pagination && messagesResponse.pagination.totalItems > 0 && (
            <CourseChatPagination
              totalItems={messagesResponse.pagination.totalItems}
              currentPage={messagesResponse.pagination.page}
              onPageChange={setPage}
            />
          )}

          <CourseChatMessageForm
            users={mentionableUsers}
            placeholder={t("studentCourseView.courseChat.newThreadPlaceholder")}
            isSubmitting={isCreatingMessage}
            onSubmit={handleCreateMessage}
            formClassName="border-t border-neutral-200 bg-background p-3 md:px-5"
            wrapperClassName="flex flex-col gap-1.5 rounded-lg border border-neutral-200 bg-background p-1.5 shadow-sm transition focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-100"
            textareaClassName="min-h-6 resize-none overflow-hidden border-0 px-1 py-0.5 text-sm leading-5 shadow-none focus-visible:ring-0"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function CourseChatPagination({
  currentPage,
  onPageChange,
  totalItems,
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalItems: number;
}) {
  return (
    <Pagination
      totalItems={totalItems}
      itemsPerPage={COURSE_CHAT_MESSAGES_PER_PAGE}
      currentPage={currentPage}
      canChangeItemsPerPage={false}
      onPageChange={onPageChange}
      className="border-t border-neutral-200 bg-background px-3 py-2"
    />
  );
}
