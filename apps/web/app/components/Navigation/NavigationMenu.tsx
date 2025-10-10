import { NavigationMenuItem } from "./NavigationMenuItem";

import type { Dispatch, SetStateAction } from "react";
import type { MenuItemType } from "~/config/navigationConfig";
import type { UserRole } from "~/config/userRoles";

type NavigationMenuProps = {
  menuItems: MenuItemType[];
  role: string;
  setIsMobileNavOpen: Dispatch<SetStateAction<boolean>>;
};

export function NavigationMenu({ menuItems, role, setIsMobileNavOpen }: NavigationMenuProps) {
  const filteredMenuItems = menuItems.filter(
    (item) => item.roles && item.roles.includes(role as UserRole),
  );

  return (
    <menu className="flex flex-col gap-y-3 2xl:h-min">
      {filteredMenuItems.map((item) => {
        return (
          <NavigationMenuItem
            key={item.label}
            item={item}
            setIsMobileNavOpen={setIsMobileNavOpen}
          />
        );
      })}
    </menu>
  );
}
