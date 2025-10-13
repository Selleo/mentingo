import { ExpandableNavigationMenu } from "./ExpandableNavigationMenu";
import { NavigationMenuItem } from "./NavigationMenuItem";

import type { Dispatch, SetStateAction } from "react";
import type { MenuItemType } from "~/config/navigationConfig";
import type { UserRole } from "~/config/userRoles";
import type { IconName } from "~/types/shared";

type NavigationMenuProps = {
  menuItems: MenuItemType[];
  role: string;
  restrictedRoles?: UserRole[];
  setIsMobileNavOpen: Dispatch<SetStateAction<boolean>>;
  showLabelsOn2xl?: boolean;
  expandableLabel?: string;
  expandableIcon?: IconName;
  isExpandable?: boolean;
};

export function NavigationMenu({
  menuItems,
  role,
  setIsMobileNavOpen,
  showLabelsOn2xl,
  expandableLabel,
  expandableIcon,
  isExpandable = false,
}: NavigationMenuProps) {
  const filteredMenuItems = menuItems.filter(
    (item) => item.roles && item.roles.includes(role as UserRole),
  );

  if (isExpandable) {
    return (
      <ExpandableNavigationMenu
        items={filteredMenuItems}
        setIsMobileNavOpen={setIsMobileNavOpen}
        showLabelsOn2xl={showLabelsOn2xl}
        expandableLabel={expandableLabel}
        expandableIcon={expandableIcon as IconName}
        isExpandable={isExpandable}
      />
    );
  }

  return (
    <menu className="flex flex-col gap-y-3 2xl:h-min">
      {filteredMenuItems.map((item) => {
        return (
          <NavigationMenuItem
            key={item.label}
            item={item}
            showLabelOn2xl={showLabelsOn2xl}
            setIsMobileNavOpen={setIsMobileNavOpen}
          />
        );
      })}
    </menu>
  );
}
