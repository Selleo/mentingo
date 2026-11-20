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
        <TooltipTrigger asChild>
          {/* A wrapper, not asChild on NavLink: Slot can't merge NavLink's function className. */}
          <div className="w-full">
            <NavLink
              data-testid={item.testId}
              to={item.link}
              onClick={() => setIsMobileNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-x-3 rounded-xl border border-transparent px-4 py-3.5 transition-all duration-200 ease-out 2xl:p-2.5 body-sm-md",
                  {
                    "bg-brand brand-gradient font-bold text-contrast brand-glow": isActive,
                    "bg-transparent text-neutral-900 hover:translate-x-0.5 hover:bg-primary-50 hover:text-primary-800":
                      !isActive,
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
                    className={cn("size-6 shrink-0", {
                      "text-contrast": isActive,
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
          </div>
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
