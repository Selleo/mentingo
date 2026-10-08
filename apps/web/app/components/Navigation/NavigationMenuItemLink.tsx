import { NavLink } from "@remix-run/react";

import { cn } from "~/lib/utils";

import { Icon } from "../Icon";

import type { LeafMenuItem } from "~/config/navigationConfig";

interface NavigationMenuItemLinkProps {
  item: LeafMenuItem;
}

export const NavigationMenuItemLink = ({ item }: NavigationMenuItemLinkProps) => {
  return (
    <NavLink
      data-testid={item.testId}
      to={item.link}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-x-3 rounded-lg border border-transparent px-4 py-3.5 hover:border-primary-200 2xl:p-2 2xl:hover:bg-primary-50 body-sm-md",
          {
            "border-primary-200 bg-white text-primary-800 2xl:bg-primary-50": isActive,
            "bg-white text-neutral-900": !isActive,
          },
          "mono:rounded mono:border-0 mono:px-3 mono:py-2.5 mono:font-normal mono:text-neutral-800 mono:hover:bg-neutral-50 mono:2xl:px-3 mono:2xl:py-2.5 mono:2xl:hover:bg-neutral-50",
          isActive && "mono:bg-primary-50 mono:font-semibold mono:text-primary-700",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            name={item.iconName}
            className={cn("size-6", { "text-primary-700": isActive }, "mono:size-5")}
          />
          <span
            className={cn("line-clamp-1 overflow-hidden truncate whitespace-nowrap capitalize")}
          >
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  );
};
