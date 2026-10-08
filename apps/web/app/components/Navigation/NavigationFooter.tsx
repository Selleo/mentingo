import { PERMISSIONS } from "@repo/shared";
import { ChevronDown } from "lucide-react";
import { type Dispatch, type SetStateAction, startTransition, useState } from "react";
import { useTranslation } from "react-i18next";

import { useLogoutUser } from "~/api/mutations";
import { useCurrentUser } from "~/api/queries";
import { Icon } from "~/components/Icon";
import { Separator } from "~/components/ui/separator";
import { usePermissions } from "~/hooks/usePermissions";
import { cn } from "~/lib/utils";
import { NotificationsNavigationItem } from "~/modules/Notifications/components";

import { NAVIGATION_HANDLES } from "../../../e2e/data/navigation/handles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { UserAvatar } from "../UserProfile/UserAvatar";

import { MobileNavigationFooterItems } from "./MobileNavigationFooterItems";
import { NavigationMenuItemLink } from "./NavigationMenuItemLink";

type NavigationFooterProps = {
  setIsMobileNavOpen: Dispatch<SetStateAction<boolean>>;
  hasConfigurationIssues?: boolean;
  showNavigationLabels: boolean;
  shouldShowTooltips: boolean;
  isSidebarCollapsed: boolean;
};

export function NavigationFooter({
  setIsMobileNavOpen,
  hasConfigurationIssues,
  showNavigationLabels,
  shouldShowTooltips,
  isSidebarCollapsed,
}: NavigationFooterProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { mutate: logout } = useLogoutUser();
  const { data: user } = useCurrentUser();
  const { hasAccess: canViewAnnouncements } = usePermissions({
    required: [PERMISSIONS.ANNOUNCEMENT_READ],
  });
  const { t } = useTranslation();

  const hideLabels = isSidebarCollapsed;

  return (
    <menu
      className={cn(
        "grid w-full grid-cols-4 gap-3 md:grid-cols-8 2xl:flex 2xl:flex-col 2xl:gap-2 2xl:self-end",
        "mono:px-4 mono:pb-3 mono:2xl:gap-0 mono:2xl:px-0 mono:2xl:pb-0",
      )}
    >
      {canViewAnnouncements && (
        <NotificationsNavigationItem
          className="col-span-4 md:col-span-8 2xl:block mono:-mx-4 mono:2xl:mx-0"
          showLabel={showNavigationLabels}
          showTooltip={shouldShowTooltips}
          isSidebarCollapsed={isSidebarCollapsed}
          onMobileNavigate={() => setIsMobileNavOpen(false)}
        />
      )}

      <li className="col-span-4 md:col-span-8 2xl:hidden mono:hidden">
        <Separator className="bg-primary-200 2xl:h-px 3xl:my-2" />
      </li>

      <MobileNavigationFooterItems
        setIsMobileNavOpen={setIsMobileNavOpen}
        userId={user?.id}
        isSupportMode={Boolean(user?.isSupportMode)}
        hasConfigurationIssues={hasConfigurationIssues}
      />

      <div className="col-span-1 hidden cursor-pointer select-none items-center justify-center md:col-span-2 2xl:flex">
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger
            data-testid={NAVIGATION_HANDLES.PROFILE_FOOTER}
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className={cn(
              "flex w-full items-center justify-between gap-2 p-2 relative",
              { "justify-center": hideLabels },
              "mono:h-14 mono:px-6 mono:hover:bg-neutral-50",
              hideLabels && "mono:px-0",
            )}
          >
            <UserAvatar
              userName={`${user?.firstName} ${user?.lastName}`}
              profilePictureUrl={user?.profilePictureUrl}
              className="size-8 mono:size-6"
            />
            <span
              className={cn(
                "block grow text-left body-sm-md",
                { hidden: hideLabels },
                "mono:truncate mono:font-normal",
              )}
            >{`${user?.firstName} ${user?.lastName}`}</span>
            <ChevronDown
              className={cn(
                "block size-6 shrink-0 rotate-180 text-neutral-500 group-data-[state=open]:rotate-180",
                {
                  hidden: hideLabels,
                },
                "mono:size-5",
              )}
            />
            {hasConfigurationIssues && (
              <span className="absolute top-2 left-2 size-2 rounded-full bg-error-500" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="right"
            sideOffset={isSidebarCollapsed ? 12 : 24}
            className="w-80 rounded-2xl border-neutral-200 bg-white p-1 shadow-xl"
          >
            <menu className="flex flex-col gap-2 p-1">
              <DropdownMenuItem onClick={() => setIsDropdownOpen(false)}>
                <NavigationMenuItemLink
                  item={{
                    iconName: "Info",
                    label: t("navigationSideBar.providerInformation"),
                    link: "/provider-information",
                    testId: NAVIGATION_HANDLES.PROVIDER_INFORMATION_LINK,
                  }}
                />
              </DropdownMenuItem>

              {!user?.isSupportMode && (
                <DropdownMenuItem onClick={() => setIsDropdownOpen(false)}>
                  <NavigationMenuItemLink
                    item={{
                      iconName: "User",
                      label: t("navigationSideBar.profile"),
                      link: `/profile/${user?.id}`,
                      testId: NAVIGATION_HANDLES.PROFILE_LINK,
                    }}
                  />
                </DropdownMenuItem>
              )}

              <DropdownMenuItem onClick={() => setIsDropdownOpen(false)} className="relative">
                <NavigationMenuItemLink
                  item={{
                    iconName: "Settings",
                    label: t("navigationSideBar.settings"),
                    link: `/settings`,
                    testId: NAVIGATION_HANDLES.SETTINGS_LINK,
                  }}
                />
                {hasConfigurationIssues && (
                  <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500" />
                )}
              </DropdownMenuItem>

              <Separator className="my-1 bg-neutral-200" />

              <DropdownMenuItem
                data-testid={NAVIGATION_HANDLES.LOGOUT}
                onClick={() => {
                  startTransition(() => {
                    logout();
                  });
                }}
              >
                <div
                  className={cn(
                    "flex cursor-pointer items-center gap-x-3 rounded-lg px-4 py-3.5 hover:outline hover:outline-1 hover:outline-primary-200 2xl:p-2 2xl:hover:bg-primary-50 body-sm-md",
                    "mono:rounded mono:px-3 mono:py-2.5 mono:font-normal mono:text-neutral-800 mono:hover:bg-neutral-50 mono:hover:outline-none mono:2xl:px-3 mono:2xl:py-2.5 mono:2xl:hover:bg-neutral-50",
                  )}
                >
                  <Icon name="Logout" className="size-6 mono:size-5" />
                  <span className="line-clamp-1 truncate whitespace-nowrap">
                    {t("navigationSideBar.logout")}
                  </span>
                </div>
              </DropdownMenuItem>
            </menu>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </menu>
  );
}
