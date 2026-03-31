import { useMemo } from "react";

import { matchesRequirement, type PermissionKey } from "~/common/permissions/permission.utils";

import type { MenuItemType } from "~/config/navigationConfig";

interface UseAuthorizedMenuItems {
  menuItems: MenuItemType[] | undefined;
  permissions: PermissionKey[];
}

export const useAuthorizedMenuItems = ({ menuItems, permissions }: UseAuthorizedMenuItems) => {
  return useMemo(() => {
    if (!menuItems || !Array.isArray(menuItems)) {
      return [];
    }

    const filterMenuItems = (items: MenuItemType[]): MenuItemType[] => {
      return items.reduce<MenuItemType[]>((acc, item) => {
        if (matchesRequirement(permissions, item.accessRequirement)) {
          if ("link" in item) {
            acc.push(item);
          }
        }

        return acc;
      }, []);
    };

    return filterMenuItems(menuItems);
  }, [menuItems, permissions]);
};
