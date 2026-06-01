import { ANNOUNCEMENT_STATUSES } from "@repo/shared";
import { formatDistanceToNow } from "date-fns";
import { CheckCheck, Megaphone, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useDeleteAnnouncement } from "~/api/mutations/admin/useDeleteAnnouncement";
import { useMarkAnnouncementAsRead } from "~/api/mutations/useMarkAnnouncementAsRead";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { getDateLocale } from "~/utils/getDateLocale";

import { NOTIFICATIONS_HANDLES } from "../handles";

import { SafeAnnouncementContent } from "./SafeAnnouncementContent";

import type { NotificationAnnouncement } from "../notifications.types";

type NotificationAnnouncementItemProps = {
  announcement: NotificationAnnouncement;
  canDelete: boolean;
  highlightUnread?: boolean;
};

export function NotificationAnnouncementItem({
  announcement,
  canDelete,
  highlightUnread = true,
}: NotificationAnnouncementItemProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);

  const { mutate: markAsRead, isPending: isMarkingRead } = useMarkAnnouncementAsRead();
  const { mutate: deleteAnnouncement, isPending: isDeleting } = useDeleteAnnouncement();

  const isUnread = announcement.isRead === false;

  const distance = formatDistanceToNow(new Date(announcement.createdAt), {
    addSuffix: true,
    locale: getDateLocale(language),
  });

  const handleMarkAsRead = () => markAsRead({ id: announcement.id });

  return (
    <article
      className={cn(
        "group grid grid-cols-[40px_1fr_auto] gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/40",
        isUnread && highlightUnread && "border-primary-300 bg-primary-50/60",
      )}
      data-testid={NOTIFICATIONS_HANDLES.card(announcement.id)}
    >
      <div className="grid size-10 place-items-center rounded-lg bg-primary-100 text-primary-800">
        <Megaphone className="size-5" aria-hidden />
      </div>

      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold leading-5 text-neutral-950">{announcement.title}</p>
        <SafeAnnouncementContent html={announcement.content} />
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-neutral-600">
          {isUnread && (
            <span className="rounded-full bg-primary-100 px-2 py-0.5 font-medium text-primary-800">
              {t("notifications.status.unread")}
            </span>
          )}
          {announcement.status === ANNOUNCEMENT_STATUSES.SCHEDULED && (
            <span className="rounded-full bg-warning-100 px-2 py-0.5 font-medium text-warning-800">
              {t("notifications.status.scheduled")}
            </span>
          )}
          <span>{distance}</span>
        </div>
      </div>

      <div className="flex items-start gap-1">
        {isUnread && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={isMarkingRead}
                onClick={handleMarkAsRead}
                data-testid={NOTIFICATIONS_HANDLES.markReadButton(announcement.id)}
              >
                <CheckCheck className="size-4 text-primary-800" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">{t("notifications.actions.markRead")}</TooltipContent>
          </Tooltip>
        )}

        {canDelete && (
          <Dialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-neutral-600 hover:text-error-700"
                    data-testid={NOTIFICATIONS_HANDLES.deleteButton(announcement.id)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent side="left">{t("notifications.actions.delete")}</TooltipContent>
            </Tooltip>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("notifications.deleteDialog.title")}</DialogTitle>
                <DialogDescription>{t("notifications.deleteDialog.description")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">{t("common.button.cancel")}</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button
                    disabled={isDeleting}
                    onClick={() => deleteAnnouncement({ id: announcement.id })}
                    className="bg-error-600 text-white hover:bg-error-700"
                    data-testid={NOTIFICATIONS_HANDLES.DELETE_CONFIRM_BUTTON}
                  >
                    {t("common.button.delete")}
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </article>
  );
}
