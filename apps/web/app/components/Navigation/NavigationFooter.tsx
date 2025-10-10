import { ChevronDown } from "lucide-react";
import { type Dispatch, type SetStateAction, startTransition } from "react";
import { useTranslation } from "react-i18next";

import { useLogoutUser } from "~/api/mutations";
import { useCurrentUser } from "~/api/queries";
import { Icon } from "~/components/Icon";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { UserAvatar } from "../UserProfile/UserAvatar";

import { useIsWidthBetween } from "./hooks/useIsWidthBetween";
import { NavigationMenuItem } from "./NavigationMenuItem";
import { NavigationMenuItemLink } from "./NavigationMenuItemLink";

type NavigationFooterProps = {
  setIsMobileNavOpen: Dispatch<SetStateAction<boolean>>;
  showLabelsOn2xl?: boolean;
};

export function NavigationFooter({ setIsMobileNavOpen, showLabelsOn2xl }: NavigationFooterProps) {
  const { mutate: logout } = useLogoutUser();
  const { data: user } = useCurrentUser();
  const { t } = useTranslation();

  const isBetween1440And1680 = useIsWidthBetween(1440, 1680, false);

  return (
    <menu className="grid w-full grid-cols-3 gap-3 md:grid-cols-6 2xl:flex 2xl:flex-col 2xl:gap-2 2xl:self-end">
      <NavigationMenuItem
        className="col-span-3 md:col-span-6"
        item={{
          iconName: "Info",
          label: t("navigationSideBar.providerInformation"),
          link: "/provider-information",
        }}
        setIsMobileNavOpen={setIsMobileNavOpen}
        showLabelOn2xl={showLabelsOn2xl}
      />
      <li className="col-span-3 md:col-span-6 2xl:hidden">
        <Separator className="bg-primary-200 2xl:h-px 3xl:my-2" />
      </li>

      <NavigationMenuItem
        className="col-span-1 md:col-span-2 2xl:hidden"
        item={{
          label: t("navigationSideBar.profile"),
          link: `profile/${user?.id}`,
          iconName: "User",
        }}
        setIsMobileNavOpen={setIsMobileNavOpen}
        showLabelOn2xl={showLabelsOn2xl}
      />

      <NavigationMenuItem
        className="col-span-1 md:col-span-2 2xl:hidden"
        item={{
          iconName: "Settings",
          label: t("navigationSideBar.settings"),
          link: "/settings",
        }}
        setIsMobileNavOpen={setIsMobileNavOpen}
        showLabelOn2xl={showLabelsOn2xl}
      />

      <li className="hidden 2xl:block">
        <Separator className="bg-neutral-200 2xl:h-px" />
      </li>
      <li className="col-span-1 md:col-span-2 2xl:hidden">
        <Tooltip>
          <TooltipTrigger className="w-full">
            <button
              onClick={() => {
                startTransition(() => {
                  logout();
                });
              }}
              className="flex w-full items-center gap-x-3 rounded-lg bg-white px-4 py-3.5 text-neutral-900 2xl:p-2"
            >
              <Icon name="Logout" className="size-6" />
              <span
                className={cn(
                  "line-clamp-1 truncate whitespace-nowrap 2xl:sr-only 3xl:not-sr-only",
                  {
                    "2xl:not-sr-only": showLabelsOn2xl,
                  },
                )}
              >
                {t("navigationSideBar.logout")}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="hidden 2xl:block 2xl:bg-neutral-950 2xl:capitalize 2xl:text-white 3xl:hidden"
          >
            {t("navigationSideBar.logout")}
          </TooltipContent>
        </Tooltip>
      </li>
      <div className="col-span-1 hidden cursor-pointer select-none items-center justify-center md:col-span-2 2xl:flex">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn("flex w-full items-center justify-between gap-2 p-2", {
              "justify-center": isBetween1440And1680,
            })}
          >
            <UserAvatar
              userName={`${user?.firstName} ${user?.lastName}`}
              profilePictureUrl={user?.profilePictureUrl}
              className="size-8"
            />
            <span
              className={cn("block grow text-left", {
                hidden: isBetween1440And1680,
              })}
            >{`${user?.firstName} ${user?.lastName}`}</span>
            <ChevronDown
              className={cn(
                "block size-6 shrink-0 rotate-180 text-neutral-500 group-data-[state=open]:rotate-180",
                {
                  hidden: isBetween1440And1680,
                },
              )}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className={cn("w-80 p-1", {
              "absolute bottom-0 left-16": isBetween1440And1680,
            })}
          >
            <menu className="flex flex-col gap-2 p-1">
              <DropdownMenuItem>
                <NavigationMenuItemLink
                  item={{
                    iconName: "User",
                    label: t("navigationSideBar.profile"),
                    link: `profile/${user?.id}`,
                  }}
                />
              </DropdownMenuItem>

              <DropdownMenuItem>
                <NavigationMenuItemLink
                  item={{
                    iconName: "Settings",
                    label: t("navigationSideBar.settings"),
                    link: `/settings`,
                  }}
                />
              </DropdownMenuItem>

              <Separator className="my-1 bg-neutral-200" />

              <DropdownMenuItem
                onClick={() => {
                  startTransition(() => {
                    logout();
                  });
                }}
              >
                <div className="flex cursor-pointer items-center gap-x-3 rounded-lg px-4 py-3.5 hover:outline hover:outline-1 hover:outline-primary-200 2xl:p-2 2xl:hover:bg-primary-50">
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
