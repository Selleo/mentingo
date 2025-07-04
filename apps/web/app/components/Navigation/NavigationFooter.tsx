import { NavLink } from "@remix-run/react";
import { type Dispatch, type SetStateAction, startTransition } from "react";
import { useTranslation } from "react-i18next";

import { useLogoutUser } from "~/api/mutations";
import { Icon } from "~/components/Icon";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

type NavigationFooterProps = {
  setIsMobileNavOpen: Dispatch<SetStateAction<boolean>>;
};

export function NavigationFooter({ setIsMobileNavOpen }: NavigationFooterProps) {
  const { mutate: logout } = useLogoutUser();
  const { t } = useTranslation();

  return (
    <menu className="grid w-full grid-cols-2 gap-2 md:grid-cols-6 md:gap-4 2xl:flex 2xl:flex-col 2xl:gap-2 2xl:self-end">
      <li className="col-span-2 md:col-span-6 2xl:hidden">
        <Separator className="bg-primary-200 2xl:h-px 3xl:my-2" />
      </li>
      <li className="col-span-2 md:col-span-3">
        <Tooltip>
          <TooltipTrigger className="w-full">
            <NavLink
              onClick={() => setIsMobileNavOpen(false)}
              to="/settings"
              className={({ isActive }) =>
                cn("flex w-full items-center gap-x-3 rounded-lg px-4 py-3.5 2xl:p-2", {
                  "bg-primary-700 text-white": isActive,
                  "bg-white text-neutral-900": !isActive,
                })
              }
            >
              <Icon name="Settings" className="size-6" />
              <span className="2xl:sr-only 3xl:not-sr-only">{t("navigationSideBar.settings")}</span>
            </NavLink>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="hidden 2xl:block 2xl:bg-neutral-950 2xl:capitalize 2xl:text-white 3xl:hidden"
          >
            {t("navigationSideBar.settings")}
          </TooltipContent>
        </Tooltip>
      </li>
      <li className="hidden 2xl:block">
        <Separator className="bg-primary-200 2xl:h-px" />
      </li>
      <li className="col-span-2 md:col-span-3">
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
              <span className="2xl:sr-only 3xl:not-sr-only">{t("navigationSideBar.logout")}</span>
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
    </menu>
  );
}
