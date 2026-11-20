import { NavLink, type NavLinkProps } from "@remix-run/react";
import { forwardRef, type ReactNode } from "react";

import { cn } from "~/lib/utils";

import { Icon } from "../Icon";

import type { LeafMenuItem } from "~/config/navigationConfig";

// Extra props come from Radix `asChild` (e.g. DropdownMenuItem), which makes the link the menu item.
type NavigationMenuItemLinkProps = Omit<NavLinkProps, "to" | "className" | "children"> & {
  item: LeafMenuItem;
  className?: string;
  children?: ReactNode;
};

export const NavigationMenuItemLink = forwardRef<HTMLAnchorElement, NavigationMenuItemLinkProps>(
  ({ item, className, children, ...props }, ref) => {
    return (
      <NavLink
        {...props}
        ref={ref}
        data-testid={item.testId}
        to={item.link}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-x-3 rounded-lg border border-transparent px-4 py-3.5 hover:border-primary-200 2xl:p-2 2xl:hover:bg-primary-50 body-sm-md",
            {
              "border-primary-200 bg-white text-primary-800 2xl:bg-primary-50": isActive,
              "bg-white text-neutral-900": !isActive,
            },
            className,
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
              className={cn("line-clamp-1 overflow-hidden truncate whitespace-nowrap capitalize")}
            >
              {item.label}
            </span>
            {children}
          </>
        )}
      </NavLink>
    );
  },
);

NavigationMenuItemLink.displayName = "NavigationMenuItemLink";
