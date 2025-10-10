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
  showLabelsOn2xl?: boolean;
  expandableLabel?: string;
  expandableIcon: IconName;
  isExpandable: boolean;
  closeOnClickOutside?: boolean;
}

export const ExpandableNavigationMenu = ({
  items,
  setIsMobileNavOpen,
  showLabelsOn2xl,
  expandableLabel,
  expandableIcon,
  closeOnClickOutside = true,
}: ExpandableNavigationMenuProps) => {
  const expandedMenus = useNavigationStore((state) => state.expandedMenus);
  const setExpandedMenus = useNavigationStore((state) => state.setExpandedMenus);

  const isBetween1440And1680 = useIsWidthBetween(1440, 1680, false);

  const [isExpanded, setIsExpanded] = useState(
    isBetween1440And1680 ? false : expandedMenus.includes(expandableIcon),
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
    <DropdownMenu open={isExpanded} defaultOpen={isExpanded}>
      <DropdownMenuTrigger
        className="w-full"
        onClick={() => handleExpandChange(isBetween1440And1680 ? true : !isExpanded)}
      >
        <button
          type="button"
          className={cn(
            "text-md flex w-full items-center justify-between gap-x-3 rounded-lg bg-white px-4 py-3.5 text-neutral-900 hover:bg-white hover:text-neutral-900 hover:outline hover:outline-1 hover:outline-primary-200 2xl:p-2 3xl:hover:bg-primary-50",
          )}
        >
          <Icon name={expandableIcon} className="size-6" />
          <span
            className={cn(
              "line-clamp-1 grow truncate whitespace-nowrap text-left font-normal capitalize 2xl:sr-only 3xl:not-sr-only",
              {
                "2xl:not-sr-only": showLabelsOn2xl,
              },
            )}
          >
            {expandableLabel}
          </span>
          <ChevronDown
            className={cn("size-6 shrink-0 text-neutral-500 2xl:sr-only 3xl:not-sr-only", {
              "rotate-180": isExpanded,
            })}
          />
        </button>
      </DropdownMenuTrigger>

      {isExpanded && isBetween1440And1680 && (
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

      {isExpanded && !isBetween1440And1680 && (
        <menu className="ml-4 flex flex-col gap-y-3 2xl:h-min">
          {items.map((item) => {
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
      )}
    </DropdownMenu>
  );
};
