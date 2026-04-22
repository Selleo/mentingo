import { matchesRequirement, type PermissionKey } from "~/common/permissions/permission.utils";

import { ExpandableNavigationMenu } from "./ExpandableNavigationMenu";
import { NavigationMenuItem } from "./NavigationMenuItem";

import type { Dispatch, SetStateAction } from "react";
import type { MenuItemType } from "~/config/navigationConfig";
import type { IconName } from "~/types/shared";

type NavigationMenuProps = {
  menuItems: MenuItemType[];
  permissions: PermissionKey[];
  setIsMobileNavOpen: Dispatch<SetStateAction<boolean>>;
  expandableLabel?: string;
  expandableIcon?: IconName;
  isExpandable?: boolean;
  testId?: string;
  showNavigationLabels: boolean;
  shouldShowTooltips: boolean;
  isSidebarCollapsed: boolean;
};

export function NavigationMenu({
  menuItems,
  permissions,
  setIsMobileNavOpen,
  expandableLabel,
  expandableIcon,
  isExpandable = false,
  testId,
  showNavigationLabels,
  shouldShowTooltips,
  isSidebarCollapsed,
}: NavigationMenuProps) {
  const filteredMenuItems = menuItems.filter((item) =>
    matchesRequirement(permissions, item.accessRequirement),
  );

  if (isExpandable) {
    return (
      <ExpandableNavigationMenu
        items={filteredMenuItems}
        setIsMobileNavOpen={setIsMobileNavOpen}
        expandableLabel={expandableLabel}
        expandableIcon={expandableIcon as IconName}
        isExpandable={isExpandable}
        testId={testId}
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
