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
  expandableLabel?: string;
  expandableIcon?: IconName;
  isExpandable?: boolean;
  showNavigationLabels: boolean;
  shouldShowTooltips: boolean;
  isSidebarCollapsed: boolean;
};

export function NavigationMenu({
  menuItems,
  role,
  setIsMobileNavOpen,
  expandableLabel,
  expandableIcon,
  isExpandable = false,
  showNavigationLabels,
  shouldShowTooltips,
  isSidebarCollapsed,
}: NavigationMenuProps) {
  const filteredMenuItems = menuItems.filter(
    (item) => item.roles && item.roles.includes(role as UserRole),
  );

  if (isExpandable) {
    return (
      <ExpandableNavigationMenu
        items={filteredMenuItems}
        setIsMobileNavOpen={setIsMobileNavOpen}
        expandableLabel={expandableLabel}
        expandableIcon={expandableIcon as IconName}
        isExpandable={isExpandable}
        showNavigationLabels={showNavigationLabels}
        shouldShowTooltips={shouldShowTooltips}
        isSidebarCollapsed={isSidebarCollapsed}
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
            setIsMobileNavOpen={setIsMobileNavOpen}
            showLabel={showNavigationLabels}
            showTooltip={shouldShowTooltips}
          />
        );
      })}
    </menu>
  );
}
