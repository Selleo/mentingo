import { NavLink } from "@remix-run/react";
import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useUnreadAnnouncementsCount } from "~/api/queries/useUnreadAnnouncementsCount";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { NOTIFICATIONS_HANDLES } from "../handles";

import { NotificationsPopover } from "./NotificationsPopover";

type NotificationsNavigationItemProps = {
  className?: string;
  showLabel: boolean;
  showTooltip: boolean;
  isSidebarCollapsed: boolean;
  onMobileNavigate?: () => void;
};

export function NotificationsNavigationItem({
  className,
  showLabel,
  showTooltip,
  isSidebarCollapsed,
  onMobileNavigate,
}: NotificationsNavigationItemProps) {
  const { t } = useTranslation();

  const { data } = useUnreadAnnouncementsCount();

  const unreadCount = data?.unreadCount ?? 0;

  const baseTriggerClassName = cn(
    "relative flex w-full items-center gap-x-3 rounded-lg border border-transparent bg-white px-4 py-3.5 text-neutral-900 hover:border-primary-200 2xl:p-2 2xl:hover:bg-primary-50 body-sm-md",
    { "justify-center": !showLabel },
  );

  const renderTriggerContent = (isActive = false) => (
    <>
      <Bell className={cn("size-6", { "text-primary-700": isActive })} aria-hidden />
      <span
        className={cn("line-clamp-1 overflow-hidden truncate whitespace-nowrap capitalize", {
          "sr-only": !showLabel,
        })}
      >
        {t("navigationSideBar.notifications")}
      </span>
      {unreadCount > 0 && (
        <span
          className={cn(
            "absolute top-1/2 grid aspect-square min-w-5 -translate-y-1/2 place-items-center rounded-full bg-error-500 text-center text-[10px] font-semibold leading-4 text-white",
            isSidebarCollapsed ? "-right-px -translate-y-[90%]" : "right-2",
          )}
        >
          <span>{Math.min(unreadCount, 99)}</span>
        </span>
      )}
    </>
  );

  return (
    <li className={className} id="notifications">
      <NavLink
        to="/notifications"
        onClick={onMobileNavigate}
        className={({ isActive }) =>
          cn(baseTriggerClassName, "2xl:hidden", {
            "border-primary-200 text-primary-800": isActive,
          })
        }
        data-testid={NOTIFICATIONS_HANDLES.MOBILE_TRIGGER}
      >
        {({ isActive }) => renderTriggerContent(isActive)}
      </NavLink>

      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger
              className={cn(baseTriggerClassName, "hidden 2xl:flex")}
              data-testid={NOTIFICATIONS_HANDLES.TRIGGER}
            >
              {renderTriggerContent()}
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className={cn("bg-neutral-950 capitalize text-white", { hidden: !showTooltip })}
          >
            {t("navigationSideBar.notifications")}
          </TooltipContent>
        </Tooltip>
        <PopoverContent
          side="right"
          align="end"
          sideOffset={isSidebarCollapsed ? 12 : 24}
          className="w-[calc(100vw-2rem)] max-w-[560px] rounded-2xl border-neutral-200 bg-white p-5 shadow-xl"
        >
          <NotificationsPopover />
        </PopoverContent>
      </Popover>
    </li>
  );
}
