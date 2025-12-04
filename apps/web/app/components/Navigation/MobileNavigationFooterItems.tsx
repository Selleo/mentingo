import { startTransition } from "react";
import { useTranslation } from "react-i18next";

import { useLogoutUser } from "~/api/mutations";
import { cn } from "~/lib/utils";

import { Icon } from "../Icon";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

import { NavigationMenuItem } from "./NavigationMenuItem";

interface MobileNavigationFooterItemsProps {
  userId?: string;
  setIsMobileNavOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showLabelsOn2xl?: boolean;
  hasConfigurationIssues?: boolean;
}

export const MobileNavigationFooterItems = ({
  setIsMobileNavOpen,
  showLabelsOn2xl,
  userId,
  hasConfigurationIssues,
}: MobileNavigationFooterItemsProps) => {
  const { t } = useTranslation();

  const { mutate: logout } = useLogoutUser();

  return (
    <>
      <NavigationMenuItem
        className="col-span-1 md:col-span-2 2xl:hidden"
        item={{
          iconName: "Info",
          label: t("navigationSideBar.providerInformation"),
          link: "/provider-information",
        }}
        setIsMobileNavOpen={setIsMobileNavOpen}
        isFooter
      />

      <NavigationMenuItem
        className="col-span-1 md:col-span-2 2xl:hidden"
        item={{
          label: t("navigationSideBar.profile"),
          link: `/profile/${userId}`,
          iconName: "User",
        }}
        setIsMobileNavOpen={setIsMobileNavOpen}
        isFooter
      />

      <NavigationMenuItem
        className="col-span-1 md:col-span-2 2xl:hidden"
        item={{
          iconName: "Settings",
          label: t("navigationSideBar.settings"),
          link: "/settings",
        }}
        setIsMobileNavOpen={setIsMobileNavOpen}
        showBadge={hasConfigurationIssues}
        isFooter
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
              className="flex flex-col sm:flex-row gap-y-1 sm:gap-y-0 w-full items-center gap-x-3 rounded-lg bg-white px-4 py-3.5 text-neutral-900 2xl:p-2 body-sm-md"
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
    </>
  );
};
