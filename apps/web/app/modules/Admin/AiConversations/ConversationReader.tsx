import { Link } from "@remix-run/react";
import { AI_THREAD_TYPES } from "@repo/shared";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAdminAiThread } from "~/api/queries/admin/useAdminAiThread";
import { useAdminAiThreadMessages } from "~/api/queries/admin/useAdminAiThreadMessages";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { AiMentorEvaluationDialog } from "~/modules/Courses/Lesson/AiMentorLesson/components/AiMentorEvaluationDialog";
import ChatMessage from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatMessage";

import { AI_CONVERSATIONS_HANDLES } from "../../../../e2e/data/ai-conversations/handles";

import { AI_CONVERSATIONS_PATH } from "./aiConversations.utils";
import { ConversationDetails } from "./ConversationDetails";

import type { SupportedLanguages } from "@repo/shared";

export function ConversationReader({
  threadId,
  language,
  search,
}: {
  threadId: string;
  language: SupportedLanguages;
  search: string;
}) {
  const { t } = useTranslation();
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const { data: thread, isPending, isError, refetch } = useAdminAiThread(threadId, language);
  const messages = useAdminAiThreadMessages(threadId);
  const ownerName = thread ? `${thread.owner.firstName} ${thread.owner.lastName}`.trim() : "";
  const rows = messages.data?.pages.flatMap((page) => page.data) ?? [];
  const isInitialLoading =
    (!thread && isPending) || (messages.isPending && rows.length === 0 && !isError);
  const retry = () => {
    void refetch();
    void messages.refetch();
  };
  const showEvaluation = () => {
    setEvaluationOpen(true);
  };
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <section
        data-testid={AI_CONVERSATIONS_HANDLES.READER}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        {isInitialLoading && (
          <span role="status" className="sr-only">
            {t("aiConversations.loading")}
          </span>
        )}
        <header className="flex min-h-[88px] shrink-0 items-center justify-between gap-4 border-b border-neutral-200 px-5 py-5 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="shrink-0 lg:hidden">
              <Link
                to={`${AI_CONVERSATIONS_PATH}${search}`}
                aria-label={t("aiConversations.back")}
                data-testid={AI_CONVERSATIONS_HANDLES.BACK}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <div className="min-w-0">
              {!thread && isPending && (
                <div aria-hidden="true" className="grid w-40 max-w-full gap-2">
                  <Skeleton className="h-4 w-full motion-reduce:animate-none" />
                  <Skeleton className="h-3 w-24 motion-reduce:animate-none" />
                </div>
              )}
              {thread && (
                <h2 className="body-lg-md line-clamp-2 text-neutral-950">
                  {thread.title || t("aiConversations.untitled")}
                </h2>
              )}
              {thread && <p className="body-sm mt-1 truncate text-neutral-600">{ownerName}</p>}
            </div>
          </div>
        </header>
        {isError && (
          <div role="alert" className="p-6">
            <p>{t("aiConversations.unavailable")}</p>
            <Button variant="outline" className="mt-3" onClick={retry}>
              {t("aiConversations.retry")}
            </Button>
          </div>
        )}
        {(thread || isPending) && (
          <Tabs defaultValue="conversation" className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-neutral-200 px-5 py-3 sm:px-7">
              <TabsList aria-label={t("aiConversations.conversation")}>
                <TabsTrigger value="conversation">{t("aiConversations.conversation")}</TabsTrigger>
                <TabsTrigger value="details" disabled={!thread}>
                  {t("aiConversations.details")}
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent
              value="conversation"
              className="relative mt-0 min-h-0 flex-1 overflow-y-auto bg-neutral-50/50 px-5 py-7 sm:px-7 sm:py-8"
            >
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
                {isInitialLoading && (
                  <div aria-hidden="true" className="grid gap-8">
                    <div className="grid w-3/5 gap-2">
                      <Skeleton className="h-3 w-24 motion-reduce:animate-none" />
                      <Skeleton className="h-3 w-full motion-reduce:animate-none" />
                      <Skeleton className="h-3 w-4/5 motion-reduce:animate-none" />
                    </div>
                    <div className="ml-auto grid w-1/2 gap-2">
                      <Skeleton className="ml-auto h-3 w-20 motion-reduce:animate-none" />
                      <Skeleton className="h-3 w-full motion-reduce:animate-none" />
                    </div>
                  </div>
                )}
                {thread &&
                  rows.map((message) => (
                    <ChatMessage
                      key={message.id}
                      id={message.id}
                      role={message.role}
                      content={message.content}
                      userName={ownerName}
                      previewUser={{
                        displayName: ownerName,
                        profilePictureUrl: thread.owner.profilePictureUrl,
                      }}
                      messageMaxWidthClass="max-w-[92%] sm:max-w-[78%]"
                      testId={AI_CONVERSATIONS_HANDLES.MESSAGE}
                    />
                  ))}
                {thread && !messages.isPending && !messages.isError && rows.length === 0 && (
                  <p className="text-sm text-neutral-500">{t("aiConversations.emptyTranscript")}</p>
                )}
                {messages.isError && (
                  <div role="alert">
                    <p>{t("aiConversations.messagesError")}</p>
                    <Button variant="outline" onClick={() => messages.refetch()}>
                      {t("aiConversations.retry")}
                    </Button>
                  </div>
                )}
                {messages.hasNextPage && (
                  <Button
                    variant="outline"
                    data-testid={AI_CONVERSATIONS_HANDLES.LOAD_MORE}
                    disabled={messages.isFetchingNextPage}
                    onClick={() => messages.fetchNextPage()}
                  >
                    {t("aiConversations.loadMore")}
                  </Button>
                )}
              </div>
            </TabsContent>
            <TabsContent
              value="details"
              className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7"
            >
              {thread && <ConversationDetails thread={thread} onEvaluation={showEvaluation} />}
            </TabsContent>
          </Tabs>
        )}
      </section>
      {thread && (
        <>
          {thread.evaluation && (
            <AiMentorEvaluationDialog
              evaluation={thread.evaluation}
              open={evaluationOpen}
              onOpenChange={setEvaluationOpen}
              context={thread.type === AI_THREAD_TYPES.PRACTICE ? "practice" : "lesson"}
            />
          )}
        </>
      )}
    </div>
  );
}
