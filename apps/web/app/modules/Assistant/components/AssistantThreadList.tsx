import { Link } from "@remix-run/react";
import { MessageSquare, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";

import { ASSISTANT_HANDLES } from "../../../../e2e/data/assistant/handles";

import type { AssistantThread } from "../assistant.types";

type AssistantThreadListProps = {
  threads: AssistantThread[];
  selectedId?: string;
  search: string;
  onSearch: (value: string) => void;
  archived: boolean;
  onArchived: (value: boolean) => void;
  onNavigate: () => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
};

export function AssistantThreadList({
  threads,
  selectedId,
  search,
  onSearch,
  archived,
  onArchived,
  onNavigate,
  loading,
  error,
  onRetry,
  hasMore,
  loadingMore,
  onLoadMore,
}: AssistantThreadListProps) {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid={ASSISTANT_HANDLES.HISTORY}>
      <div className="space-y-4 px-5 pb-3 pt-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-neutral-400" />
          <Input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            aria-label={t("assistant.search")}
            placeholder={t("assistant.search")}
            className="h-10 border-border bg-transparent pl-9 text-sm"
          />
        </div>
        <Tabs
          value={archived ? "archived" : "active"}
          onValueChange={(value) => onArchived(value === "archived")}
        >
          <TabsList
            className="grid w-full grid-cols-2 dark:bg-neutral-950"
            aria-label={t("assistant.history")}
          >
            <TabsTrigger
              value="active"
              className="dark:text-neutral-300 dark:data-[state=active]:text-primary-100"
            >
              {t("assistant.active")}
            </TabsTrigger>
            <TabsTrigger
              value="archived"
              className="dark:text-neutral-300 dark:data-[state=active]:text-primary-100"
            >
              {t("assistant.archived")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <nav aria-label={t("assistant.history")} className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {loading && (
          <div role="status" className="space-y-3 px-2">
            <span className="sr-only">{t("assistant.loading")}</span>
            {[1, 2, 3].map((id) => (
              <Skeleton key={id} className="h-14 w-full motion-reduce:animate-none" />
            ))}
          </div>
        )}
        {error && (
          <div role="alert" className="p-3 text-sm">
            <p>{t("assistant.loadError")}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
              {t("assistant.retry")}
            </Button>
          </div>
        )}
        {!loading && !error && threads.length === 0 && (
          <p className="px-3 py-6 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
            {t(search ? "assistant.noMatches" : "assistant.noThreads")}
          </p>
        )}
        {threads.map((thread) => (
          <Link
            key={thread.id}
            to={`/assistant/${thread.id}`}
            onClick={onNavigate}
            data-testid={ASSISTANT_HANDLES.THREAD}
            aria-current={selectedId === thread.id ? "page" : undefined}
            className={cn(
              "mb-2 flex items-start gap-2.5 rounded-xl border border-transparent bg-neutral-50 dark:bg-neutral-950 px-4 py-4 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900",
              {
                "border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950 text-primary-900 dark:text-primary-100 hover:bg-primary-50 dark:hover:bg-primary-950":
                  selectedId === thread.id,
              },
            )}
          >
            <MessageSquare className="mt-0.5 size-4 shrink-0 text-neutral-400" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {thread.title || t("assistant.untitled")}
              </span>
              <time
                dateTime={thread.updatedAt}
                className="mt-1 block text-[11px] text-neutral-500 dark:text-neutral-400"
              >
                {new Intl.DateTimeFormat(i18n.language, { month: "short", day: "numeric" }).format(
                  new Date(thread.updatedAt),
                )}
              </time>
            </span>
          </Link>
        ))}
        {hasMore && (
          <Button
            variant="ghost"
            className="mt-2 w-full text-xs"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {t("assistant.loadMore")}
          </Button>
        )}
      </nav>
    </div>
  );
}
