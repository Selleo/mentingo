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
};

export function NavigationMenuItem({
  item,
  setIsMobileNavOpen,
  className,
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
                "flex items-center gap-x-3 rounded-lg px-4 py-3.5 hover:outline hover:outline-1 hover:outline-primary-200 2xl:p-2 2xl:hover:bg-primary-50",
                {
                  "border border-primary-200 bg-white text-primary-800 2xl:bg-primary-50": isActive,
                  "bg-white text-neutral-900": !isActive,
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
                    "line-clamp-1 overflow-hidden truncate whitespace-nowrap capitalize 2xl:sr-only 3xl:not-sr-only",
                    {
                      "2xl:not-sr-only": showLabelOn2xl,
                    },
                  )}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className={cn(
            "hidden 2xl:block 2xl:bg-neutral-950 2xl:capitalize 2xl:text-white",
            "3xl:hidden",
          )}
        >
          {item.label}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
