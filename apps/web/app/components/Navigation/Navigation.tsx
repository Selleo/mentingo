import { useState, Fragment } from "react";
import { useTranslation } from "react-i18next";

import { Separator } from "~/components/ui/separator";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useHandleKeyboardShortcut } from "~/hooks/useHandleKeyboardShortcut";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";

import { NavigationFooter } from "./NavigationFooter";
import { NavigationGlobalSearchWrapper } from "./NavigationGlobalSearchWrapper";
import { NavigationHeader } from "./NavigationHeader";
import { NavigationMenu } from "./NavigationMenu";
import { NavigationMenuButton } from "./NavigationMenuButton";
import { useMobileNavigation } from "./useMobileNavigation";

import type { LeafMenuItem, NavigationGroups } from "~/config/navigationConfig";
import type { UserRole } from "~/utils/userRoles";

type DashboardNavigationProps = { menuItems: NavigationGroups[] };

export function Navigation({ menuItems }: DashboardNavigationProps) {
  const { isMobileNavOpen, setIsMobileNavOpen } = useMobileNavigation();
  const { role } = useUserRole();
  const { t } = useTranslation();
  const [isGlobalSearchDialogOpen, setIsGlobalSearchDialogOpen] = useState(false);

  useHandleKeyboardShortcut({
    shortcuts: [
      { key: "k", metaKey: true },
      { key: "k", ctrlKey: true },
    ],
    onShortcut: () => {
      setIsGlobalSearchDialogOpen((prev) => !prev);
    },
  });

  if (!role) return null;

  return (
    <TooltipProvider>
      <header
        className={cn(
          "sticky top-0 z-10 h-min w-full transition-all duration-300 ease-in-out",
          "2xl:flex 2xl:h-dvh 2xl:w-14 2xl:flex-col 2xl:gap-y-6 2xl:px-2 2xl:py-4",
          "3xl:static 3xl:w-64 3xl:p-4",
        )}
      >
        <NavigationHeader
          isMobileNavOpen={isMobileNavOpen}
          setIsMobileNavOpen={setIsMobileNavOpen}
        />

        <div className="hidden 2xl:block 3xl:hidden">
          <NavigationMenuButton
            item={{ iconName: "Search", label: t("navigationSideBar.findInApplication") }}
            onClick={() => setIsGlobalSearchDialogOpen(true)}
            wrapperClassName="list-none h-[42px] w-[42px]"
            className="justify-center"
          />
        </div>

        <NavigationGlobalSearchWrapper
          containerClassName="hidden 3xl:block"
          isDialogOpen={isGlobalSearchDialogOpen}
          setIsDialogOpen={setIsGlobalSearchDialogOpen}
        />

        <Separator className="sr-only bg-neutral-200 2xl:not-sr-only 2xl:h-px" />
        <nav
          className={cn("2xl:flex 2xl:h-full 2xl:flex-col 2xl:justify-between", {
            "flex h-[calc(100dvh-4rem)] flex-col justify-between gap-y-3 bg-primary-50 px-4 pb-4 pt-7 2xl:bg-transparent 2xl:p-0":
              isMobileNavOpen,
            "sr-only 2xl:not-sr-only": !isMobileNavOpen,
          })}
        >
          <div className="flex flex-col gap-y-3">
            {menuItems.map((group) => {
              const { restrictedRoles } = group;

              if (restrictedRoles && !restrictedRoles.includes(role as UserRole)) return null;

              return (
                <Fragment key={group.title}>
                  <NavigationMenu
                    menuItems={group.items as unknown as LeafMenuItem[]}
                    role={role}
                    setIsMobileNavOpen={setIsMobileNavOpen}
                    isExpandable={group.isExpandable}
                    expandableLabel={group.title}
                    expandableIcon={group.icon}
                  />
                  <Separator className="bg-neutral-200 2xl:h-px" />
                </Fragment>
              );
            })}
          </div>

          <NavigationFooter setIsMobileNavOpen={setIsMobileNavOpen} />
        </nav>
      </header>
    </TooltipProvider>
  );
}
