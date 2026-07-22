import { Link } from "@remix-run/react";
import { ANNOUNCEMENT_FEEDS, PERMISSIONS, type AnnouncementFeed } from "@repo/shared";
import { CheckCheck, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useMarkAllAnnouncementsAsRead } from "~/api/mutations/useMarkAllAnnouncementsAsRead";
import { useInfiniteAllAnnouncements } from "~/api/queries/admin/useInfiniteAllAnnouncements";
import { useUnreadAnnouncementsCount } from "~/api/queries/useUnreadAnnouncementsCount";
import { Button, buttonVariants } from "~/components/ui/button";
import { PopoverClose } from "~/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { TooltipProvider } from "~/components/ui/tooltip";
import { usePermissions } from "~/hooks/usePermissions";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { NOTIFICATIONS_HANDLES } from "../handles";

import { CreateAnnouncementDialog } from "./CreateAnnouncementDialog";
import { NotificationAnnouncementItem } from "./NotificationAnnouncementItem";

import type { NotificationsFeed } from "../notifications.types";

export const NOTIFICATIONS_POPOVER_VARIANT = {
  POPOVER: "popover",
  PAGE: "page",
} as const;

type NotificationsPopoverVariant =
  (typeof NOTIFICATIONS_POPOVER_VARIANT)[keyof typeof NOTIFICATIONS_POPOVER_VARIANT];

type NotificationsPopoverProps = {
  className?: string;
  variant?: NotificationsPopoverVariant;
};

export function NotificationsPopover({
  className,
  variant = NOTIFICATIONS_POPOVER_VARIANT.POPOVER,
}: NotificationsPopoverProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const isPageVariant = variant === NOTIFICATIONS_POPOVER_VARIANT.PAGE;

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeFeed, setActiveFeed] = useState<AnnouncementFeed>(ANNOUNCEMENT_FEEDS.ALL);

  const { hasAccess: canCreateAnnouncements } = usePermissions({
    required: PERMISSIONS.ANNOUNCEMENT_CREATE,
  });
  const { hasAccess: canDeleteAnnouncements } = usePermissions({
    required: PERMISSIONS.ANNOUNCEMENT_DELETE,
  });

  const { mutate: markAllAsRead, isPending: isMarkingAllRead } = useMarkAllAnnouncementsAsRead();

  const {
    data: allAnnouncementsData,
    fetchNextPage: fetchNextAllAnnouncementsPage,
    hasNextPage: hasNextAllAnnouncementsPage,
    isFetchingNextPage: isFetchingNextAllAnnouncementsPage,
    refetch: refetchAllAnnouncements,
  } = useInfiniteAllAnnouncements({ feed: ANNOUNCEMENT_FEEDS.ALL, language });

  const {
    data: adminAnnouncementsData,
    fetchNextPage: fetchNextAdminAnnouncementsPage,
    hasNextPage: hasNextAdminAnnouncementsPage,
    isFetchingNextPage: isFetchingNextAdminAnnouncementsPage,
    refetch: refetchAdminAnnouncements,
  } = useInfiniteAllAnnouncements({
    feed: ANNOUNCEMENT_FEEDS.ADMIN_ANNOUNCEMENTS,
    language,
  });

  const {
    data: systemAnnouncementsData,
    fetchNextPage: fetchNextSystemAnnouncementsPage,
    hasNextPage: hasNextSystemAnnouncementsPage,
    isFetchingNextPage: isFetchingNextSystemAnnouncementsPage,
    refetch: refetchSystemAnnouncements,
  } = useInfiniteAllAnnouncements({ feed: ANNOUNCEMENT_FEEDS.SYSTEM, language });

  const { data: unreadAnnouncementsCount, refetch: refetchUnreadAnnouncementsCount } =
    useUnreadAnnouncementsCount();

  const unreadCount = unreadAnnouncementsCount?.unreadCount ?? 0;

  const allFeed = {
    announcements: allAnnouncementsData?.pages.flatMap((page) => page.data) ?? [],
    count: allAnnouncementsData?.pages[0]?.pagination.totalItems ?? 0,
    hasMore: hasNextAllAnnouncementsPage,
    isFetchingMore: isFetchingNextAllAnnouncementsPage,
    onLoadMore: fetchNextAllAnnouncementsPage,
    refetch: refetchAllAnnouncements,
  };

  const adminFeed = {
    announcements: adminAnnouncementsData?.pages.flatMap((page) => page.data) ?? [],
    count: adminAnnouncementsData?.pages[0]?.pagination.totalItems ?? 0,
    hasMore: hasNextAdminAnnouncementsPage,
    isFetchingMore: isFetchingNextAdminAnnouncementsPage,
    onLoadMore: fetchNextAdminAnnouncementsPage,
    refetch: refetchAdminAnnouncements,
  };

  const systemFeed = {
    announcements: systemAnnouncementsData?.pages.flatMap((page) => page.data) ?? [],
    count: systemAnnouncementsData?.pages[0]?.pagination.totalItems ?? 0,
    hasMore: hasNextSystemAnnouncementsPage,
    isFetchingMore: isFetchingNextSystemAnnouncementsPage,
    onLoadMore: fetchNextSystemAnnouncementsPage,
    refetch: refetchSystemAnnouncements,
  };

  const feeds = {
    [ANNOUNCEMENT_FEEDS.ALL]: allFeed,
    [ANNOUNCEMENT_FEEDS.ADMIN_ANNOUNCEMENTS]: adminFeed,
    [ANNOUNCEMENT_FEEDS.SYSTEM]: systemFeed,
  };

  const notificationsFeed = feeds[activeFeed];

  const handleRefresh = () => {
    refetchUnreadAnnouncementsCount();
    notificationsFeed.refetch();
  };

  const renderAnnouncements = ({
    announcements,
    hasMore,
    isFetchingMore,
    onLoadMore,
  }: NotificationsFeed) => {
    if (!announcements.length) {
      return (
        <div
          className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-600"
          data-testid={NOTIFICATIONS_HANDLES.EMPTY_STATE}
        >
          {t("notifications.empty")}
        </div>
      );
    }

    return (
      <div
        className={cn(
          "grid gap-2 pr-1",
          isPageVariant ? "overflow-visible" : "max-h-[430px] overflow-y-auto",
        )}
      >
        {announcements.map((announcement) => (
          <NotificationAnnouncementItem
            key={announcement.id}
            announcement={announcement}
            canDelete={canDeleteAnnouncements}
            highlightUnread={!isPageVariant}
          />
        ))}
        {hasMore && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 h-9 justify-center"
            disabled={isFetchingMore}
            onClick={() => onLoadMore()}
            data-testid={NOTIFICATIONS_HANDLES.LOAD_MORE_BUTTON}
          >
            {isFetchingMore
              ? t("notifications.actions.loadingMore")
              : t("notifications.actions.loadMore")}
          </Button>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <section className={cn("space-y-4", className)} data-testid={NOTIFICATIONS_HANDLES.POPOVER}>
        <div className="flex items-center justify-between gap-3">
          <h2 className={cn("font-semibold text-neutral-950", isPageVariant ? "h4" : "text-xl")}>
            {t("notifications.title")}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 text-neutral-600"
              onClick={handleRefresh}
              data-testid={NOTIFICATIONS_HANDLES.REFRESH_BUTTON}
            >
              <RefreshCw className="size-5" aria-hidden />
              <span className="sr-only">{t("notifications.actions.refresh")}</span>
            </Button>
            {isPageVariant && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 flex items-center gap-2"
                disabled={!unreadCount || isMarkingAllRead}
                onClick={() => markAllAsRead()}
                data-testid={NOTIFICATIONS_HANDLES.MARK_ALL_READ_BUTTON}
              >
                <CheckCheck className="size-4" aria-hidden />
                {t("notifications.actions.markAllRead")}
              </Button>
            )}
            {canCreateAnnouncements && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 text-neutral-600"
                onClick={() => setIsCreateDialogOpen(true)}
                data-testid={NOTIFICATIONS_HANDLES.CREATE_BUTTON}
              >
                <Plus className="size-5" aria-hidden />
                <span className="sr-only">{t("notifications.actions.create")}</span>
              </Button>
            )}
          </div>
        </div>

        <Tabs
          value={activeFeed}
          onValueChange={(value) => setActiveFeed(value as AnnouncementFeed)}
          className="space-y-4"
        >
          <TabsList className="flex h-auto w-full rounded-lg bg-neutral-100 p-1">
            <TabsTrigger
              className="w-fit shrink-0 gap-1 whitespace-nowrap rounded-md px-8 py-2 text-xs leading-tight"
              value={ANNOUNCEMENT_FEEDS.ALL}
              data-testid={NOTIFICATIONS_HANDLES.TAB_ALL}
            >
              <span className="min-w-0 break-words text-center">{t("notifications.tabs.all")}</span>
              <span className="shrink-0 rounded-full bg-neutral-200 px-1.5 text-xs text-neutral-700">
                {allFeed.count}
              </span>
            </TabsTrigger>
            <TabsTrigger
              className="min-w-0 flex-1 gap-1 overflow-hidden whitespace-normal rounded-md px-1.5 py-2 text-xs leading-tight"
              value={ANNOUNCEMENT_FEEDS.ADMIN_ANNOUNCEMENTS}
              data-testid={NOTIFICATIONS_HANDLES.TAB_ADMIN_ANNOUNCEMENTS}
            >
              <span className="min-w-0 break-words text-center">
                {t("notifications.tabs.adminAnnouncements")}
              </span>
              <span className="shrink-0 rounded-full bg-neutral-200 px-1.5 text-xs text-neutral-700">
                {adminFeed.count}
              </span>
            </TabsTrigger>
            <TabsTrigger
              className="w-fit shrink-0 gap-1 whitespace-nowrap rounded-md px-8 py-2 text-xs leading-tight"
              value={ANNOUNCEMENT_FEEDS.SYSTEM}
              data-testid={NOTIFICATIONS_HANDLES.TAB_SYSTEM}
            >
              <span className="min-w-0 break-words text-center">
                {t("notifications.tabs.system")}
              </span>
              <span className="shrink-0 rounded-full bg-neutral-200 px-1.5 text-xs text-neutral-700">
                {systemFeed.count}
              </span>
            </TabsTrigger>
          </TabsList>

          {renderAnnouncements({ ...notificationsFeed })}
        </Tabs>

        {!isPageVariant && (
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="link"
              className="h-auto gap-1.5 p-0 text-neutral-950"
              disabled={!unreadCount || isMarkingAllRead}
              onClick={() => markAllAsRead()}
              data-testid={NOTIFICATIONS_HANDLES.MARK_ALL_READ_BUTTON}
            >
              <CheckCheck className="size-4" aria-hidden />
              {t("notifications.actions.markAllRead")}
            </Button>
            <PopoverClose asChild>
              <Link
                to="/notifications"
                prefetch="render"
                className={buttonVariants({ variant: "outline", className: "h-10" })}
                data-testid={NOTIFICATIONS_HANDLES.CENTER_LINK}
              >
                {t("notifications.actions.goToNotificationCenter")}
              </Link>
            </PopoverClose>
          </div>
        )}

        <CreateAnnouncementDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
      </section>
    </TooltipProvider>
  );
}
