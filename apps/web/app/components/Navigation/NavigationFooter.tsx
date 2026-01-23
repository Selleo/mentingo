import { ChevronDown } from "lucide-react";
import { type Dispatch, type SetStateAction, startTransition, useState } from "react";
import { useTranslation } from "react-i18next";

import { useLogoutUser } from "~/api/mutations";
import { useCurrentUser } from "~/api/queries";
import { Icon } from "~/components/Icon";
import { Separator } from "~/components/ui/separator";
import { USER_ROLE } from "~/config/userRoles";
import { cn } from "~/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { UserAvatar } from "../UserProfile/UserAvatar";

import { MobileNavigationFooterItems } from "./MobileNavigationFooterItems";
import { NavigationMenuItem } from "./NavigationMenuItem";
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
  const { t } = useTranslation();

  const hideLabels = isSidebarCollapsed;

  return (
    <menu className="grid w-full grid-cols-4 gap-3 md:grid-cols-8 2xl:flex 2xl:flex-col 2xl:gap-2 2xl:self-end">
      {user?.role !== USER_ROLE.admin && (
        <NavigationMenuItem
          className="col-span-4 md:col-span-8 2xl:block"
          item={{
            iconName: "Bell",
            label: t("navigationSideBar.announcements"),
            link: "/announcements",
          }}
          setIsMobileNavOpen={setIsMobileNavOpen}
          showLabel={showNavigationLabels}
          showTooltip={shouldShowTooltips}
        />
      )}

      <li className="col-span-4 md:col-span-8 2xl:hidden">
        <Separator className="bg-primary-200 2xl:h-px 3xl:my-2" />
      </li>

      <MobileNavigationFooterItems
        setIsMobileNavOpen={setIsMobileNavOpen}
        userId={user?.id}
        hasConfigurationIssues={hasConfigurationIssues}
      />

      <div className="col-span-1 hidden cursor-pointer select-none items-center justify-center md:col-span-2 2xl:flex">
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className={cn("flex w-full items-center justify-between gap-2 p-2 relative", {
              "justify-center": hideLabels,
            })}
          >
            <UserAvatar
              userName={`${user?.firstName} ${user?.lastName}`}
              profilePictureUrl={user?.profilePictureUrl}
              className="size-8"
            />
            <span
              className={cn("block grow text-left body-sm-md", {
                hidden: hideLabels,
              })}
            >{`${user?.firstName} ${user?.lastName}`}</span>
            <ChevronDown
              className={cn(
                "block size-6 shrink-0 rotate-180 text-neutral-500 group-data-[state=open]:rotate-180",
                {
                  hidden: hideLabels,
                },
              )}
            />
            {hasConfigurationIssues && (
              <span className="absolute top-2 left-2 size-2 rounded-full bg-error-500" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className={cn("w-80 p-1", {
              "absolute bottom-0 left-16": isSidebarCollapsed,
            })}
          >
            <menu className="flex flex-col gap-2 p-1">
              <DropdownMenuItem onClick={() => setIsDropdownOpen(false)}>
                <NavigationMenuItemLink
                  item={{
                    iconName: "Info",
                    label: t("navigationSideBar.providerInformation"),
                    link: "/provider-information",
                  }}
                />
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setIsDropdownOpen(false)}>
                <NavigationMenuItemLink
                  item={{
                    iconName: "User",
                    label: t("navigationSideBar.profile"),
                    link: `/profile/${user?.id}`,
                  }}
                />
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setIsDropdownOpen(false)} className="relative">
                <NavigationMenuItemLink
                  item={{
                    iconName: "Settings",
                    label: t("navigationSideBar.settings"),
                    link: `/settings`,
                  }}
                />
                {hasConfigurationIssues && (
                  <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500" />
                )}
              </DropdownMenuItem>

              <Separator className="my-1 bg-neutral-200" />

              <DropdownMenuItem
                onClick={() => {
                  startTransition(() => {
                    logout();
                  });
                }}
              >
                <div className="flex cursor-pointer items-center gap-x-3 rounded-lg px-4 py-3.5 hover:outline hover:outline-1 hover:outline-primary-200 2xl:p-2 2xl:hover:bg-primary-50 body-sm-md">
                  <Icon name="Logout" className="size-6" />
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
