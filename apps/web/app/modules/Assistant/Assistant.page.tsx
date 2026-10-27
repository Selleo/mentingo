import { Link, useParams } from "@remix-run/react";
import { LoaderCircle, History, SquarePen } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUserSuspense } from "~/api/queries";
import { useAssistantThreads } from "~/api/queries/assistant/useAssistantThreads";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "~/components/ui/sheet";
import { useDebounce } from "~/hooks/useDebounce";

import { ASSISTANT_HANDLES } from "../../../e2e/data/assistant/handles";

import { AssistantConversation } from "./components/AssistantConversation";
import { AssistantThreadList } from "./components/AssistantThreadList";
import { assistantSessionKey, useAssistantSession } from "./useAssistantSession";

export default function AssistantPage() {
  const { data: user } = useCurrentUserSuspense();
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const key = assistantSessionKey(user, origin);
  return <AssistantWorkspace key={key} sessionKey={key} />;
}

function AssistantWorkspace({ sessionKey }: { sessionKey: string }) {
  const { t } = useTranslation();
  const { threadId } = useParams();
  const session = useAssistantSession(sessionKey, threadId);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const query = useDebounce(search);
  const threads = useAssistantThreads(query, archived);
  const listProps = {
    threads: threads.data?.pages.flatMap((page) => page.items) ?? [],
    selectedId: threadId,
    search,
    onSearch: setSearch,
    archived,
    onArchived: setArchived,
    onNavigate: () => setHistoryOpen(false),
    loading: threads.isPending,
    error: threads.isError,
    onRetry: () => {
      void threads.refetch();
    },
    hasMore: threads.hasNextPage,
    loadingMore: threads.isFetchingNextPage,
    onLoadMore: () => {
      void threads.fetchNextPage();
    },
  };

  return (
    <PageWrapper
      className="flex min-h-0 flex-1 flex-col"
      wrapperClassName="h-full min-h-0 overflow-hidden bg-primary-50 dark:bg-neutral-950"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="mb-6 flex min-h-10 shrink-0 items-center justify-between gap-4">
          <h1 className="h4 text-foreground">{t("navigationSideBar.aiAssistant")}</h1>
        </header>
        <section
          data-testid={ASSISTANT_HANDLES.PAGE}
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background"
        >
          <div className="flex shrink-0 items-center justify-end gap-2 p-4 sm:p-6">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="size-10 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900"
              aria-label={t("assistant.newConversation")}
              title={t("assistant.newConversation")}
              data-testid={ASSISTANT_HANDLES.NEW_THREAD}
            >
              <Link to="/assistant" onClick={session.startNew}>
                <SquarePen className="size-[18px]" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900"
              aria-label={t("assistant.openHistory")}
              title={t("assistant.openHistory")}
              onClick={() => setHistoryOpen(true)}
            >
              <History className="size-[18px]" />
            </Button>
          </div>
          {session.isResuming && (
            <div
              role="status"
              className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
            >
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
              {t("assistant.loading")}
            </div>
          )}
          {session.resumeFailed && (
            <div role="alert" className="m-auto p-8 text-center text-sm text-muted-foreground">
              <p>{t("assistant.threadUnavailable")}</p>
              <Button variant="outline" className="mt-4" onClick={session.retryResume}>
                {t("assistant.retry")}
              </Button>
            </div>
          )}
          {!session.isResuming && !session.resumeFailed && (
            <AssistantConversation
              key={threadId ?? `new-${session.newConversationRevision}`}
              threadId={threadId ?? ""}
            />
          )}
        </section>
      </div>
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent
          side="right"
          className="flex w-[min(90vw,380px)] flex-col gap-0 border-border bg-background p-0 sm:max-w-[380px]"
          overlayClassName="bg-[rgba(0,0,0,0.28)]"
        >
          <div className="border-b border-border px-6 py-5">
            <SheetTitle className="text-base">{t("assistant.history")}</SheetTitle>
            <SheetDescription className="sr-only">{t("assistant.recent")}</SheetDescription>
          </div>
          <AssistantThreadList {...listProps} />
        </SheetContent>
      </Sheet>
    </PageWrapper>
  );
}
