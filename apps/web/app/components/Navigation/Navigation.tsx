import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Separator } from "~/components/ui/separator";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useHandleKeyboardShortcut } from "~/hooks/useHandleKeyboardShortcut";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";

import { NavigationFooter } from "./NavigationFooter";
import { NavigationGlobalSearch } from "./NavigationGlobalSearch";
import { NavigationHeader } from "./NavigationHeader";
import { NavigationMenu } from "./NavigationMenu";
import { NavigationMenuButton } from "./NavigationMenuButton";
import { useMobileNavigation } from "./useMobileNavigation";

import type { MenuItemType } from "~/config/navigationConfig";

type DashboardNavigationProps = { menuItems: MenuItemType[] };

export function Navigation({ menuItems }: DashboardNavigationProps) {
  const { isMobileNavOpen, setIsMobileNavOpen } = useMobileNavigation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [labelsVisible, setLabelsVisible] = useState(false);
  const { role } = useUserRole();
  const { t } = useTranslation();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isExpanded) {
      const id = setTimeout(() => setLabelsVisible(true), 220);
      return () => clearTimeout(id);
    }
    setLabelsVisible(false);
  }, [isExpanded]);

  useHandleKeyboardShortcut({
    shortcuts: [
      { key: "k", metaKey: true },
      { key: "k", ctrlKey: true },
    ],
    onShortcut: () => {
      const isIn2xlRange =
        typeof window !== "undefined" && window.innerWidth >= 1440 && window.innerWidth < 1680;

      if (isIn2xlRange) {
        setIsExpanded(true);
        setTimeout(() => {
          const input = searchInputRef.current?.querySelector("input") as HTMLInputElement | null;
          input?.focus();
        }, 250);
      } else {
        const input = searchInputRef.current?.querySelector("input") as HTMLInputElement | null;
        input?.focus();
      }
    },
  });

  if (!role) return null;

  return (
    <TooltipProvider>
      <header
        className={cn(
          "sticky top-0 z-10 h-min w-full transition-all duration-300 ease-in-out 2xl:flex 2xl:h-dvh 2xl:flex-col 2xl:gap-y-6 2xl:px-2 2xl:py-4 3xl:static 3xl:p-4",
          {
            "2xl:w-14 3xl:w-64": !isExpanded,
            "2xl:w-64": isExpanded,
          },
        )}
      >
        <NavigationHeader
          isMobileNavOpen={isMobileNavOpen}
          setIsMobileNavOpen={setIsMobileNavOpen}
          isExpanded={isExpanded}
        />

        <div className="hidden 2xl:block 3xl:hidden">
          <AnimatePresence mode="wait" initial={false}>
            {isExpanded ? (
              <motion.div
                key="search"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <NavigationGlobalSearch
                  ref={searchInputRef}
                  containerClassName="w-full"
                  autoFocusOnMount
                  onBlur={() => setIsExpanded(false)}
                />
              </motion.div>
            ) : (
              <motion.div
                key="button"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <NavigationMenuButton
                  item={{ iconName: "Search", label: t("navigationSideBar.findInApplication") }}
                  onClick={() => setIsExpanded(true)}
                  wrapperClassName="list-none"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <NavigationGlobalSearch ref={searchInputRef} containerClassName="hidden 3xl:block" />

        <Separator className="sr-only bg-primary-200 2xl:not-sr-only 2xl:h-px" />
        <nav
          className={cn("2xl:flex 2xl:h-full 2xl:flex-col 2xl:justify-between", {
            "flex h-[calc(100dvh-4rem)] flex-col justify-between gap-y-3 bg-primary-50 px-4 pb-4 pt-7 2xl:bg-transparent 2xl:p-0":
              isMobileNavOpen,
            "sr-only 2xl:not-sr-only": !isMobileNavOpen,
          })}
        >
          <NavigationMenu
            menuItems={menuItems}
            role={role}
            setIsMobileNavOpen={setIsMobileNavOpen}
            showLabelsOn2xl={labelsVisible}
          />
          <NavigationFooter
            setIsMobileNavOpen={setIsMobileNavOpen}
            showLabelsOn2xl={labelsVisible}
          />
        </nav>
      </header>
    </TooltipProvider>
  );
}
