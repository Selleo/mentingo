import { Link, useNavigate, useParams, useSearchParams } from "@remix-run/react";
import { AI_THREAD_STATUSES, AI_THREAD_TYPES } from "@repo/shared";
import { parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, MessageSquareText, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAdminAiThreads } from "~/api/queries/admin/useAdminAiThreads";
import { PageWrapper } from "~/components/PageWrapper";
import { ITEMS_PER_PAGE_OPTIONS } from "~/components/Pagination/Pagination";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { SearchFilter } from "~/modules/common/SearchFilter/SearchFilter";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AI_CONVERSATIONS_HANDLES } from "../../../../e2e/data/ai-conversations/handles";

import {
  AI_CONVERSATIONS_PATH,
  removeLegacyConversationFilters,
  readConversationFilters,
  updateConversationFilters,
} from "./aiConversations.utils";
import { ConversationReader } from "./ConversationReader";
import { ConversationStatus } from "./ConversationStatus";

import type { FilterConfig, FilterValue } from "~/modules/common/SearchFilter/SearchFilter";

export default function AiConversationsPage() {
  const { t, i18n } = useTranslation();
  const { threadId } = useParams();
  const [rawSearchParams] = useSearchParams();
  const searchParams = removeLegacyConversationFilters(rawSearchParams);
  const rawSearch = rawSearchParams.toString();
  const navigate = useNavigate();
  const [searchResetKey, setSearchResetKey] = useState(0);
  const clearFilters = () => {
    setSearchResetKey((key) => key + 1);
    navigate(AI_CONVERSATIONS_PATH);
  };
  useEffect(() => {
    const raw = new URLSearchParams(rawSearch);
    if (raw.has("userId") || raw.has("ownerName")) {
      const path = threadId ? `${AI_CONVERSATIONS_PATH}/${threadId}` : AI_CONVERSATIONS_PATH;
      navigate(`${path}?${removeLegacyConversationFilters(raw).toString()}`, { replace: true });
    }
  }, [rawSearch, threadId, navigate]);
  const language = useLanguageStore((state) => state.language);
  const filters = readConversationFilters(searchParams, language);
  const { data, isPending, isError, refetch } = useAdminAiThreads(filters);
  const update = (name: string, value: FilterValue) =>
    navigate(
      updateConversationFilters(searchParams, name, typeof value === "string" ? value : ""),
      { replace: name === "search" },
    );
  const filterConfig: FilterConfig[] = [
    {
      name: "type",
      type: "select",
      placeholder: t("aiConversations.allTypes"),
      options: [AI_THREAD_TYPES.PRACTICE, AI_THREAD_TYPES.AI_MENTOR].map((value) => ({
        value,
        label: t(`aiConversations.types.${value}`),
      })),
    },
    {
      name: "status",
      type: "select",
      placeholder: t("aiConversations.allStatuses"),
      options: [
        AI_THREAD_STATUSES.ACTIVE,
        AI_THREAD_STATUSES.COMPLETED,
        AI_THREAD_STATUSES.ARCHIVED,
      ].map((value) => ({
        value,
        label: t(`aiConversations.statuses.${value}`),
      })),
    },
    {
      name: "from",
      type: "date",
      placeholder: t("aiConversations.from"),
      maxDate: filters.to ? parseISO(searchParams.get("to")!) : undefined,
    },
    {
      name: "to",
      type: "date",
      placeholder: t("aiConversations.to"),
      minDate: filters.from ? parseISO(searchParams.get("from")!) : undefined,
    },
  ];
  const activeFilterCount = filterConfig.filter((filter) => searchParams.has(filter.name)).length;
  const hasFilters = !!filters.search || activeFilterCount > 0;
  const emptyMessage = hasFilters ? t("aiConversations.noMatches") : t("aiConversations.empty");
  const selectionMessage =
    data?.data.length === 0 ? emptyMessage : t("aiConversations.selectConversation");
  const search = `?${searchParams.toString()}`;
  const totalItems = data?.pagination.totalItems ?? 0;
  const totalPages = Math.ceil(totalItems / filters.perPage);

  return (
    <PageWrapper>
      <header className="mb-6">
        <h1 className="h4">{t("aiConversations.title")}</h1>
      </header>
      <div
        data-testid={AI_CONVERSATIONS_HANDLES.PAGE}
        className="flex h-[calc(100dvh-11rem)] min-h-[28rem] overflow-hidden rounded-lg border border-neutral-200 bg-white 2xl:h-[calc(100dvh-7rem)]"
      >
        <aside
          className={cn(
            "flex min-h-0 w-full shrink-0 flex-col border-neutral-200 lg:w-[320px] lg:border-r xl:w-[352px]",
            { "hidden lg:flex": !!threadId },
          )}
        >
          <div className="flex items-center gap-2 border-b border-neutral-200 p-4">
            <div className="shrink-0">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 min-w-10 gap-1 px-2"
                    aria-label={t("aiConversations.filters")}
                  >
                    <SlidersHorizontal className="size-4" aria-hidden="true" />
                    {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  collisionPadding={16}
                  className="w-[min(92vw,420px)] p-4"
                >
                  <h2 className="text-sm font-semibold">{t("aiConversations.filters")}</h2>
                  <SearchFilter
                    className="py-3"
                    filters={filterConfig}
                    values={{
                      type: filters.type,
                      status: filters.status,
                      from: searchParams.get("from") || undefined,
                      to: searchParams.get("to") || undefined,
                    }}
                    onChange={update}
                    onClearAll={clearFilters}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <SearchFilter
              key={searchResetKey}
              className="order-first min-w-0 flex-1 py-0"
              filters={[
                {
                  name: "search",
                  type: "text",
                  placeholder: t("aiConversations.search"),
                  testId: AI_CONVERSATIONS_HANDLES.SEARCH,
                },
              ]}
              values={{ search: filters.search }}
              onChange={update}
              onClearAll={() => update("search", "")}
              showClearAll={false}
            />
          </div>
          <div
            data-testid={AI_CONVERSATIONS_HANDLES.LIST}
            className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2"
          >
            {isPending && (
              <p role="status" className="p-5 text-sm">
                {t("aiConversations.loading")}
              </p>
            )}
            {isError && (
              <div role="alert" className="p-5 text-sm">
                <p>{t("aiConversations.listError")}</p>
                <Button variant="outline" className="mt-3" onClick={() => refetch()}>
                  {t("aiConversations.retry")}
                </Button>
              </div>
            )}
            {data?.data.length === 0 && (
              <p className="p-5 text-sm text-neutral-500">{emptyMessage}</p>
            )}
            {data?.data.map((thread) => (
              <Link
                key={thread.id}
                to={`${AI_CONVERSATIONS_PATH}/${thread.id}${search}`}
                data-testid={AI_CONVERSATIONS_HANDLES.row(thread.id)}
                aria-current={threadId === thread.id ? "page" : undefined}
                className={cn(
                  "grid gap-1 rounded-lg border border-transparent px-3 py-3 transition-colors hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500",
                  {
                    "border-primary-200 bg-primary-50 hover:bg-primary-50": threadId === thread.id,
                  },
                )}
              >
                <h2 className="truncate text-sm font-medium leading-5 text-neutral-900">
                  {thread.title || t("aiConversations.untitled")}
                </h2>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs leading-5 text-neutral-700">
                    {thread.owner.firstName} {thread.owner.lastName}
                  </span>
                  <ConversationStatus status={thread.status} compact />
                  <time
                    dateTime={thread.lastActivityAt}
                    className="shrink-0 text-xs text-neutral-500"
                  >
                    {new Date(thread.lastActivityAt).toLocaleDateString(i18n.language, {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
              </Link>
            ))}
          </div>
          {totalItems > 0 && (
            <div className="flex items-center gap-2 border-t border-neutral-200 px-4 py-3">
              <span className="min-w-0 flex-1 text-xs text-neutral-500">
                {t("pagination.showing", {
                  startItem: (filters.page - 1) * filters.perPage + 1,
                  endItem: Math.min(filters.page * filters.perPage, totalItems),
                  totalItems,
                })}
              </span>
              <Select
                value={String(filters.perPage)}
                onValueChange={(value) => update("perPage", value)}
              >
                <SelectTrigger
                  aria-label={t("aiConversations.pageSize")}
                  className="h-8 w-[68px] shrink-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEMS_PER_PAGE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label={t("pagination.previous")}
                disabled={filters.page <= 1}
                onClick={() => update("page", String(filters.page - 1))}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label={t("pagination.next")}
                disabled={filters.page >= totalPages}
                onClick={() => update("page", String(filters.page + 1))}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </aside>
        {threadId ? (
          <ConversationReader
            key={threadId}
            threadId={threadId}
            language={language}
            search={search}
          />
        ) : (
          <div className="hidden min-w-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-neutral-500 lg:flex">
            <MessageSquareText className="size-8 text-neutral-400" aria-hidden="true" />
            <p className="text-sm">{selectionMessage}</p>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
