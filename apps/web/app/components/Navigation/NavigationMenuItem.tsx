import { NavLink } from "@remix-run/react";
import { cva } from "class-variance-authority";

import { Icon } from "~/components/Icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import type { Dispatch, SetStateAction } from "react";
import type { MenuItemType } from "~/config/navigationConfig";

export const monoNavigationRowVariants = cva(
  "mono:relative mono:h-14 mono:w-full mono:rounded-none mono:border-0 mono:border-b mono:border-border mono:bg-background mono:px-6 mono:py-0 mono:font-normal mono:text-neutral-800 mono:hover:border-border mono:hover:bg-neutral-50 mono:hover:text-neutral-800 mono:2xl:bg-background mono:2xl:px-6 mono:2xl:py-0 mono:2xl:hover:bg-neutral-50 mono:3xl:hover:bg-neutral-50",
  {
    variants: {
      isActive: {
        true: "mono:font-semibold mono:text-primary-700 mono:hover:text-primary-700 mono:before:absolute mono:before:inset-y-2 mono:before:left-2 mono:before:w-0.5 mono:before:bg-primary-500",
      },
      isCollapsed: {
        true: "mono:justify-center mono:px-0 mono:2xl:px-0",
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
                "relative flex items-center gap-x-3 rounded-lg border border-transparent px-4 py-3.5 hover:border-primary-200 2xl:p-2 2xl:hover:bg-primary-50 body-sm-md",
                {
                  "border-primary-200 bg-white text-primary-800 2xl:bg-primary-50": isActive,
                  "bg-white text-neutral-900": !isActive,
                  "flex-col sm:flex-row gap-y-1 sm:gap-y-0": isFooter,
                  "justify-center": !showLabel,
                },
                !isFooter && monoNavigationRowVariants({ isActive, isCollapsed: !showLabel }),
                isFooter &&
                  "mono:rounded mono:border-0 mono:bg-background mono:px-2 mono:font-normal mono:text-neutral-800 mono:hover:bg-neutral-50 mono:2xl:bg-background mono:2xl:px-2 mono:2xl:py-3.5 mono:2xl:hover:bg-neutral-50",
                isFooter && isActive && "mono:text-primary-700",
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
                    "mono:size-5",
                    showLabel && !isFooter && "mono:hidden",
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
