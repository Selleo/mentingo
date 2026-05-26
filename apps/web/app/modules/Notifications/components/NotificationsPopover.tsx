import { PERMISSIONS } from "@repo/shared";
import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useMarkAllAnnouncementsAsRead } from "~/api/mutations/useMarkAllAnnouncementsAsRead";
import { useInfiniteAllAnnouncements } from "~/api/queries/admin/useInfiniteAllAnnouncements";
import { useInfiniteAnnouncementsForUser } from "~/api/queries/useInfiniteAnnouncementsForUser";
import { useUnreadAnnouncementsCount } from "~/api/queries/useUnreadAnnouncementsCount";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { usePermissions } from "~/hooks/usePermissions";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { NOTIFICATIONS_HANDLES } from "../handles";

import { CreateAnnouncementDialog } from "./CreateAnnouncementDialog";
import { NotificationAnnouncementItem } from "./NotificationAnnouncementItem";

import type { NotificationsFeed } from "../notifications.types";

type NotificationsPopoverProps = {
  className?: string;
};

const TAB_VALUE = {
  ALL: "all",
  ADMIN: "admin-announcements",
} as const;

export function NotificationsPopover({ className }: NotificationsPopoverProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { hasAccess: canCreateAnnouncements } = usePermissions({
    required: PERMISSIONS.ANNOUNCEMENT_CREATE,
  });
  const { hasAccess: canDeleteAnnouncements } = usePermissions({
    required: PERMISSIONS.ANNOUNCEMENT_DELETE,
  });

  const canManageAnnouncements = canCreateAnnouncements || canDeleteAnnouncements;

  const { mutate: markAllAsRead, isPending: isMarkingAllRead } = useMarkAllAnnouncementsAsRead();

  const {
    data: userAnnouncementsData,
    fetchNextPage: fetchNextUserAnnouncementsPage,
    hasNextPage: hasNextUserAnnouncementsPage,
    isFetchingNextPage: isFetchingNextUserAnnouncementsPage,
    refetch: refetchUserAnnouncements,
  } = useInfiniteAnnouncementsForUser({ language });

  const {
    data: adminAnnouncementsData,
    fetchNextPage: fetchNextAdminAnnouncementsPage,
    hasNextPage: hasNextAdminAnnouncementsPage,
    isFetchingNextPage: isFetchingNextAdminAnnouncementsPage,
    refetch: refetchAdminAnnouncements,
  } = useInfiniteAllAnnouncements({ language }, { enabled: canManageAnnouncements });

  const { data: unreadAnnouncementsCount, refetch: refetchUnreadAnnouncementsCount } =
    useUnreadAnnouncementsCount();

  const unreadCount = unreadAnnouncementsCount?.unreadCount ?? 0;

  const userFeed = {
    announcements: userAnnouncementsData?.pages.flatMap((page) => page.data) ?? [],
    count: userAnnouncementsData?.pages[0]?.pagination.totalItems ?? 0,
    hasMore: hasNextUserAnnouncementsPage,
    isFetchingMore: isFetchingNextUserAnnouncementsPage,
    onLoadMore: fetchNextUserAnnouncementsPage,
  };

  const adminFeed = {
    announcements: adminAnnouncementsData?.pages.flatMap((page) => page.data) ?? [],
    count: adminAnnouncementsData?.pages[0]?.pagination.totalItems ?? 0,
    hasMore: hasNextAdminAnnouncementsPage,
    isFetchingMore: isFetchingNextAdminAnnouncementsPage,
    onLoadMore: fetchNextAdminAnnouncementsPage,
  };

  const notificationsFeed = canManageAnnouncements ? adminFeed : userFeed;

  const handleRefresh = () => {
    refetchUserAnnouncements();
    refetchUnreadAnnouncementsCount();
    if (canManageAnnouncements) refetchAdminAnnouncements();
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
      <div className="grid max-h-[430px] gap-2 overflow-y-auto pr-1">
        {announcements.map((announcement) => (
          <NotificationAnnouncementItem
            key={announcement.id}
            announcement={announcement}
            canDelete={canDeleteAnnouncements}
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
    <section className={cn("space-y-4", className)} data-testid={NOTIFICATIONS_HANDLES.POPOVER}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-neutral-950">{t("notifications.title")}</h2>
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

      <Tabs defaultValue={TAB_VALUE.ADMIN} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-lg bg-neutral-100 p-1">
          <TabsTrigger className="gap-2 rounded-md py-2" value={TAB_VALUE.ALL}>
            {t("notifications.tabs.all")}
            <span className="rounded-full bg-neutral-200 px-1.5 text-xs text-neutral-700">
              {notificationsFeed.count}
            </span>
          </TabsTrigger>
          <TabsTrigger className="gap-2 rounded-md py-2" value={TAB_VALUE.ADMIN}>
            {t("notifications.tabs.adminAnnouncements")}
            <span className="rounded-full bg-neutral-200 px-1.5 text-xs text-neutral-700">
              {notificationsFeed.count}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={TAB_VALUE.ALL}>
          {renderAnnouncements({
            ...notificationsFeed,
          })}
        </TabsContent>
        <TabsContent value={TAB_VALUE.ADMIN}>
          {renderAnnouncements({
            ...notificationsFeed,
          })}
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-neutral-950"
          disabled={!unreadCount || isMarkingAllRead}
          onClick={() => markAllAsRead()}
          data-testid={NOTIFICATIONS_HANDLES.MARK_ALL_READ_BUTTON}
        >
          {t("notifications.actions.markAllRead")}
        </Button>
      </div>

      <CreateAnnouncementDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
    </section>
  );
}
