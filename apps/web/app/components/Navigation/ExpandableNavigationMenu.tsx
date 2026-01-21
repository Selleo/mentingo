import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "~/lib/utils";

import { Icon } from "../Icon";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../ui/dropdown-menu";

import { useIsWidthBetween } from "./hooks/useIsWidthBetween";
import { NavigationMenuItem } from "./NavigationMenuItem";
import { NavigationMenuItemLink } from "./NavigationMenuItemLink";
import { useNavigationStore } from "./stores/navigationStore";

import type { Dispatch, SetStateAction } from "react";
import type { MenuItemType } from "~/config/navigationConfig";
import type { IconName } from "~/types/shared";

interface ExpandableNavigationMenuProps {
  items: MenuItemType[];
  setIsMobileNavOpen: Dispatch<SetStateAction<boolean>>;
  expandableLabel?: string;
  expandableIcon: IconName;
  isExpandable: boolean;
  closeOnClickOutside?: boolean;
  showNavigationLabels: boolean;
  shouldShowTooltips: boolean;
  isSidebarCollapsed: boolean;
}

export const ExpandableNavigationMenu = ({
  items,
  setIsMobileNavOpen,
  expandableLabel,
  expandableIcon,
  closeOnClickOutside = true,
  showNavigationLabels,
  shouldShowTooltips,
  isSidebarCollapsed,
}: ExpandableNavigationMenuProps) => {
  const expandedMenus = useNavigationStore((state) => state.expandedMenus);
  const setExpandedMenus = useNavigationStore((state) => state.setExpandedMenus);

  const isBetween1440And1680 = useIsWidthBetween(1440, 1680, false);
  const shouldUseDropdownLayout = isBetween1440And1680 || isSidebarCollapsed;

  const [isExpanded, setIsExpanded] = useState(() =>
    shouldUseDropdownLayout ? false : expandedMenus.includes(expandableIcon),
  );

  const handleExpandChange = useCallback(
    (expanded: boolean) => {
      setIsExpanded(expanded);

      if (expanded) {
        return setExpandedMenus([...expandedMenus, expandableIcon]);
      }

      setExpandedMenus(expandedMenus.filter((label) => label !== expandableIcon));
    },
    [expandedMenus, expandableIcon, setExpandedMenus],
  );

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (shouldUseDropdownLayout) {
      setIsExpanded(false);
      return;
    }

    setIsExpanded(expandedMenus.includes(expandableIcon));
  }, [expandedMenus, expandableIcon, shouldUseDropdownLayout]);

  useEffect(() => {
    if (!closeOnClickOutside || !isExpanded) return;

    const onDocumentClick = (e: MouseEvent | TouchEvent) => {
      const el = containerRef.current;
      if (!el) return;

      if (!el.contains(e.target as Node)) {
        handleExpandChange(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);

    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
    };
  }, [closeOnClickOutside, isExpanded, handleExpandChange]);

  return (
    <DropdownMenu
      open={isExpanded}
      defaultOpen={isExpanded}
      onOpenChange={() => handleExpandChange(shouldUseDropdownLayout ? true : !isExpanded)}
    >
      <DropdownMenuTrigger className="w-full">
        <button
          type="button"
          className={cn(
            "text-md flex w-full items-center justify-between gap-x-3 rounded-lg bg-white px-4 py-3.5 text-neutral-900 hover:bg-white hover:text-neutral-900 hover:outline hover:outline-1 hover:outline-primary-200 2xl:p-2 3xl:hover:bg-primary-50 body-sm-md",
          )}
        >
          <Icon name={expandableIcon} className="size-6" />
          <span
            className={cn(
              "line-clamp-1 grow truncate whitespace-nowrap text-left font-normal capitalize",
              {
                "sr-only": !showNavigationLabels,
              },
            )}
          >
            {expandableLabel}
          </span>
          {showNavigationLabels && (
            <ChevronDown
              className={cn("size-6 shrink-0 text-neutral-500", {
                "rotate-180": isExpanded,
              })}
            />
          )}
        </button>
      </DropdownMenuTrigger>

      {isExpanded && shouldUseDropdownLayout && (
        <DropdownMenuContent
          ref={containerRef}
          align="end"
          className="absolute bottom-0 left-6 w-80 p-1"
          onClick={() => handleExpandChange(false)}
        >
          <menu className="flex flex-col gap-2 p-1">
            {items.map((item) => {
              return <NavigationMenuItemLink key={item.label} item={item} />;
            })}
          </menu>
        </DropdownMenuContent>
      )}

      {!shouldUseDropdownLayout && isExpanded && (
        <menu className="ml-4 flex flex-col gap-y-3">
          {items.map((item) => {
            return (
              <div key={item.label}>
                <NavigationMenuItem
                  item={item}
                  setIsMobileNavOpen={setIsMobileNavOpen}
                  showLabel={showNavigationLabels}
                  showTooltip={shouldShowTooltips}
                />
              </div>
            );
          })}
        </menu>
      )}
    </DropdownMenu>
  );
};
