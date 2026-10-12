import { formatDistanceToNow } from "date-fns";
import { Check, ChevronDown, History, Loader2, MessageSquarePlus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { getDateLocale } from "~/utils/getDateLocale";

import { COURSE_AUTHORING_HANDLES } from "../../../../e2e/data/curriculum/handles";

import type { AuthoringSessionSummary } from "../courseAuthoring.types";

export const SESSION_STATUS = {
  ACTIVE: "active",
  PAUSED: "paused",
  STOPPED: "stopped",
  DISCARDED: "discarded",
} as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: AuthoringSessionSummary[];
  selectedSessionId: string | null;
  selectedTitle?: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (session: AuthoringSessionSummary) => void;
  onNewChat: () => void;
  creating: boolean;
  loading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
};

export const AuthoringSessionMenu = ({
  open,
  onOpenChange,
  sessions,
  selectedSessionId,
  selectedTitle,
  search,
  onSearchChange,
  onSelect,
  onNewChat,
  creating,
  loading,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: Props) => {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const newChatLabel = t("courseAuthoring.conversation.newChat", { defaultValue: "New chat" });
  const relativeTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return formatDistanceToNow(date, { addSuffix: true, locale: getDateLocale(language) });
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid={COURSE_AUTHORING_HANDLES.SESSION_MENU_TRIGGER}
          data-vaul-no-drag
          onPointerDown={(event) => event.stopPropagation()}
          className="group h-8 max-w-full gap-1.5 rounded-lg px-2 text-xs font-medium text-neutral-700 hover:bg-primary-50 hover:text-primary-700 data-[state=open]:bg-primary-50 data-[state=open]:text-primary-700"
        >
          <History className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{selectedTitle ?? newChatLabel}</span>
          <ChevronDown
            className="size-3.5 shrink-0 opacity-60 transition-transform group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        portalled={false}
        align="start"
        side="bottom"
        sideOffset={6}
        data-vaul-no-drag
        className="z-[60] w-[min(22rem,calc(100vw-1rem))] rounded-xl border-neutral-200 p-0 shadow-lg"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Command shouldFilter={false} className="h-auto rounded-xl bg-white">
          <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
            <p className="text-sm font-semibold text-neutral-950">
              {t("courseAuthoring.conversation.chats")}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 rounded-lg px-2 text-xs aria-disabled:pointer-events-none aria-disabled:opacity-50"
              data-testid={COURSE_AUTHORING_HANDLES.NEW_CHAT_BUTTON}
              aria-disabled={creating}
              onClick={() => {
                if (!creating) onNewChat();
              }}
            >
              {creating ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <MessageSquarePlus className="size-3.5" aria-hidden="true" />
              )}
              {newChatLabel}
            </Button>
          </div>
          <div className="px-3 pb-2">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 transition-colors focus-within:border-primary-500 focus-within:bg-white [&>div]:gap-2 [&>div]:border-0 [&>div]:px-2.5 [&_svg]:me-0 [&_svg]:size-4 [&_svg]:text-neutral-400">
              <CommandInput
                value={search}
                onValueChange={onSearchChange}
                placeholder={t("courseAuthoring.conversation.searchSessions")}
                data-testid={COURSE_AUTHORING_HANDLES.SESSION_MENU_SEARCH}
                className="h-9 py-0 text-sm outline-none focus:outline-none focus-visible:outline-none"
              />
            </div>
          </div>
          <CommandList
            data-testid={COURSE_AUTHORING_HANDLES.SESSION_MENU_LIST}
            className="max-h-[min(50dvh,20rem)] border-t border-neutral-100 px-1.5 py-1.5"
          >
            {loading && sessions.length === 0 ? (
              <div className="space-y-2 p-2" aria-busy="true">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-4/5" />
              </div>
            ) : (
              <CommandEmpty className="px-3 py-6 text-center text-sm text-neutral-500">
                {t("courseAuthoring.conversation.noSessionsFound")}
              </CommandEmpty>
            )}
            <CommandGroup className="p-0">
              {sessions.map((session) => {
                const active = session.sessionId === selectedSessionId;
                const time = relativeTime(session.lastActivityAt || session.createdAt);
                const inactive =
                  session.status === SESSION_STATUS.PAUSED ||
                  session.status === SESSION_STATUS.STOPPED;
                return (
                  <CommandItem
                    key={session.sessionId}
                    value={session.sessionId}
                    data-testid={COURSE_AUTHORING_HANDLES.sessionMenuItem(session.sessionId)}
                    aria-current={active ? "true" : undefined}
                    onSelect={() => onSelect(session)}
                    className={cn(
                      "gap-2.5 rounded-lg px-2.5 py-2 data-[selected=true]:bg-neutral-100 data-[selected=true]:text-neutral-950",
                      active && "bg-primary-50 data-[selected=true]:bg-primary-50",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-sm text-neutral-900",
                          active && "font-semibold text-primary-800",
                        )}
                      >
                        {session.title}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                        {time}
                        {inactive && (
                          <>
                            <span aria-hidden="true">·</span>
                            {t(`courseAuthoring.conversation.sessionStatus.${session.status}`)}
                          </>
                        )}
                      </span>
                    </span>
                    {active && (
                      <Check
                        className="size-4 shrink-0 text-primary-700"
                        aria-label={t("courseAuthoring.conversation.active", {
                          defaultValue: "Active",
                        })}
                      />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {hasNextPage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 w-full gap-2 rounded-lg text-xs text-neutral-600 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                aria-disabled={isFetchingNextPage}
                onClick={() => {
                  if (!isFetchingNextPage) onLoadMore();
                }}
              >
                {isFetchingNextPage && <Loader2 className="size-3.5 animate-spin" />}
                {t("courseAuthoring.conversation.loadMoreSessions")}
              </Button>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
