import { PERMISSIONS } from "@repo/shared";
import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useMarkAllAnnouncementsAsRead } from "~/api/mutations/useMarkAllAnnouncementsAsRead";
import { useAllAnnouncements } from "~/api/queries/admin/useAllAnnouncements";
import { useAnnouncementsForUser } from "~/api/queries/useAnnouncementsForUser";
import { useUnreadAnnouncementsCount } from "~/api/queries/useUnreadAnnouncementsCount";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { usePermissions } from "~/hooks/usePermissions";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { NOTIFICATIONS_HANDLES } from "../handles";

import { CreateAnnouncementDialog } from "./CreateAnnouncementDialog";
import { NotificationAnnouncementItem } from "./NotificationAnnouncementItem";

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

  const { data: userAnnouncements = [], refetch: refetchUserAnnouncements } =
    useAnnouncementsForUser({ language });
  const { data: adminAnnouncements = [], refetch: refetchAdminAnnouncements } = useAllAnnouncements(
    { language },
    { enabled: canManageAnnouncements },
  );
  const { data: unreadAnnouncementsCount, refetch: refetchUnreadAnnouncementsCount } =
    useUnreadAnnouncementsCount();

  const allAnnouncements = canManageAnnouncements ? adminAnnouncements : userAnnouncements;
  const unreadCount = unreadAnnouncementsCount?.unreadCount ?? 0;

  const adminTabCount = canManageAnnouncements
    ? adminAnnouncements.length
    : userAnnouncements.length;

  const handleRefresh = () => {
    refetchUserAnnouncements();
    refetchUnreadAnnouncementsCount();
    if (canManageAnnouncements) refetchAdminAnnouncements();
  };

  const renderAnnouncements = (announcements: typeof allAnnouncements) => {
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

      <Tabs defaultValue={TAB_VALUE.ALL} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-lg bg-neutral-100 p-1">
          <TabsTrigger className="gap-2 rounded-md py-2" value={TAB_VALUE.ALL}>
            {t("notifications.tabs.all")}
            <span className="rounded-full bg-neutral-200 px-1.5 text-xs text-neutral-700">
              {allAnnouncements.length}
            </span>
          </TabsTrigger>
          <TabsTrigger className="gap-2 rounded-md py-2" value={TAB_VALUE.ADMIN}>
            {t("notifications.tabs.adminAnnouncements")}
            <span className="rounded-full bg-neutral-200 px-1.5 text-xs text-neutral-700">
              {adminTabCount}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={TAB_VALUE.ALL}>{renderAnnouncements(allAnnouncements)}</TabsContent>
        <TabsContent value={TAB_VALUE.ADMIN}>
          {renderAnnouncements(canManageAnnouncements ? adminAnnouncements : userAnnouncements)}
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
