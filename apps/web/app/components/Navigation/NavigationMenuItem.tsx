import { NavLink } from "@remix-run/react";

import { Icon } from "~/components/Icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import type { Dispatch, SetStateAction } from "react";
import type { MenuItemType } from "~/config/navigationConfig";

type NavigationMenuItemProps = {
  item: MenuItemType;
  setIsMobileNavOpen: Dispatch<SetStateAction<boolean>>;
  showLabelOn2xl?: boolean;
};

export function NavigationMenuItem({
  item,
  setIsMobileNavOpen,
  showLabelOn2xl,
}: NavigationMenuItemProps) {
  return (
    <li key={item.label}>
      <Tooltip>
        <TooltipTrigger className="w-full">
          <NavLink
            to={item.link}
            onClick={() => setIsMobileNavOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-x-3 rounded-lg px-4 py-3.5 hover:bg-primary-700 hover:text-white 2xl:p-2",
                {
                  "bg-primary-700 text-white": isActive,
                  "bg-white text-neutral-900": !isActive,
                },
              )
            }
          >
            <Icon name={item.iconName} className="size-6" />
            <span
              className={cn(
                "line-clamp-1 truncate whitespace-nowrap capitalize 2xl:sr-only 3xl:not-sr-only",
                {
                  "2xl:not-sr-only": showLabelOn2xl,
                },
              )}
            >
              {item.label}
            </span>
          </NavLink>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className={cn(
            "hidden 2xl:bg-neutral-950 2xl:capitalize 2xl:text-white",
            {
              "2xl:hidden": showLabelOn2xl,
              "2xl:block": !showLabelOn2xl,
            },
            "3xl:hidden",
          )}
        >
          {item.label}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
