import { NavLink } from "@remix-run/react";

import { Icon } from "~/components/Icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import type { Dispatch, SetStateAction } from "react";
import type { MenuItemType } from "~/config/navigationConfig";

type NavigationMenuItemProps = {
  item: MenuItemType;
  setIsMobileNavOpen: Dispatch<SetStateAction<boolean>>;
  className?: string;
  showBadge?: boolean;
  isFooter?: boolean;
  showLabel?: boolean;
  showTooltip?: boolean;
};

export function NavigationMenuItem({
  item,
  setIsMobileNavOpen,
  className,
  showBadge,
  isFooter = false,
  showLabel = true,
  showTooltip = false,
}: NavigationMenuItemProps) {
  return (
    <li key={item.label} className={className}>
      <Tooltip>
        <TooltipTrigger className="w-full">
          <NavLink
            to={item.link}
            onClick={() => setIsMobileNavOpen(false)}
            className={({ isActive }) =>
              cn(
                "relative flex items-center gap-x-3 rounded-lg px-4 py-3.5 hover:outline hover:outline-1 hover:outline-primary-200 2xl:p-2 2xl:hover:bg-primary-50 body-sm-md",
                {
                  "border border-primary-200 bg-white text-primary-800 2xl:bg-primary-50": isActive,
                  "bg-white text-neutral-900": !isActive,
                  "flex-col sm:flex-row gap-y-1 sm:gap-y-0": isFooter,
                  "justify-center": !showLabel,
                },
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  name={item.iconName}
                  className={cn("size-6", {
                    "text-primary-700": isActive,
                  })}
                />
                <span
                  className={cn(
                    "line-clamp-1 overflow-hidden truncate whitespace-nowrap capitalize",
                    {
                      "sr-only": !showLabel,
                    },
                  )}
                >
                  {item.label}
                </span>
                {showBadge && (
                  <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500" />
                )}
              </>
            )}
          </NavLink>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className={cn("bg-neutral-950 capitalize text-white", {
            hidden: !showTooltip,
          })}
        >
          {item.label}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
