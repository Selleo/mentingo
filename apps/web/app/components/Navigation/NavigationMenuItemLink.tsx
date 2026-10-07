import { NavLink } from "@remix-run/react";

import { IS_MONO_DESIGN } from "~/config/designVariant";
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
          !IS_MONO_DESIGN && [
            "flex items-center gap-x-3 rounded-lg border border-transparent px-4 py-3.5 hover:border-primary-200 2xl:p-2 2xl:hover:bg-primary-50 body-sm-md",
            {
              "border-primary-200 bg-white text-primary-800 2xl:bg-primary-50": isActive,
              "bg-white text-neutral-900": !isActive,
            },
          ],
          IS_MONO_DESIGN && [
            "flex items-center gap-x-3 rounded px-3 py-2.5 font-normal text-neutral-800 hover:bg-neutral-50 body-sm-md",
            isActive && "bg-primary-50 font-semibold text-primary-700",
          ],
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            name={item.iconName}
            className={cn("size-6", { "text-primary-700": isActive }, IS_MONO_DESIGN && "size-5")}
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
