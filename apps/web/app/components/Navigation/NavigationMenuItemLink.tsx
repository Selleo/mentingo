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
      to={item.link}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-x-3 rounded-lg px-4 py-3.5 hover:outline hover:outline-1 hover:outline-primary-200 2xl:p-2 2xl:hover:bg-primary-50 body-sm-md",
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
            className={cn("line-clamp-1 overflow-hidden truncate whitespace-nowrap capitalize")}
          >
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  );
};
