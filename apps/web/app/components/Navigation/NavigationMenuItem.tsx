import { NavLink } from "@remix-run/react";
import { cva } from "class-variance-authority";

import { Icon } from "~/components/Icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { IS_MONO_DESIGN } from "~/config/designVariant";
import { cn } from "~/lib/utils";

import type { Dispatch, SetStateAction } from "react";
import type { MenuItemType } from "~/config/navigationConfig";

export const monoNavigationRowVariants = cva(
  "relative flex h-14 w-full items-center gap-x-3 border-b border-border bg-background px-6 font-normal text-neutral-800 hover:bg-neutral-50 body-sm-md",
  {
    variants: {
      isActive: {
        true: "font-semibold text-primary-700 before:absolute before:inset-y-2 before:left-2 before:w-0.5 before:bg-primary-500",
      },
      isCollapsed: {
        true: "justify-center px-0",
      },
    },
  },
);

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
            data-testid={item.testId}
            to={item.link}
            onClick={() => setIsMobileNavOpen(false)}
            className={({ isActive }) =>
              cn(
                !IS_MONO_DESIGN && [
                  "relative flex items-center gap-x-3 rounded-lg border border-transparent px-4 py-3.5 hover:border-primary-200 2xl:p-2 2xl:hover:bg-primary-50 body-sm-md",
                  {
                    "border-primary-200 bg-white text-primary-800 2xl:bg-primary-50": isActive,
                    "bg-white text-neutral-900": !isActive,
                    "flex-col sm:flex-row gap-y-1 sm:gap-y-0": isFooter,
                    "justify-center": !showLabel,
                  },
                ],
                IS_MONO_DESIGN &&
                  !isFooter &&
                  monoNavigationRowVariants({ isActive, isCollapsed: !showLabel }),
                IS_MONO_DESIGN &&
                  isFooter && [
                    "relative flex flex-col items-center gap-x-3 gap-y-1 rounded bg-background px-2 py-3.5 font-normal text-neutral-800 hover:bg-neutral-50 sm:flex-row sm:gap-y-0 body-sm-md",
                    isActive && "text-primary-700",
                  ],
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  name={item.iconName}
                  className={cn(
                    "size-6",
                    { "text-primary-700": isActive },
                    IS_MONO_DESIGN && "size-5",
                    IS_MONO_DESIGN && showLabel && !isFooter && "hidden",
                  )}
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
