import { Separator } from "~/components/ui/separator";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";

import { NavigationFooter } from "./NavigationFooter";
import { NavigationHeader } from "./NavigationHeader";
import { NavigationMenu } from "./NavigationMenu";
import { useMobileNavigation } from "./useMobileNavigation";

import type { MenuItemType } from "~/config/navigationConfig";

type DashboardNavigationProps = { menuItems: MenuItemType[] };

export function Navigation({ menuItems }: DashboardNavigationProps) {
  const { isMobileNavOpen, setIsMobileNavOpen } = useMobileNavigation();
  const { role } = useUserRole();

  if (!role) return null;

  return (
    <header className="sticky top-0 z-10 h-min w-full 2xl:static 2xl:flex 2xl:h-dvh 2xl:w-14 2xl:flex-col 2xl:gap-y-6 2xl:px-2 2xl:py-4 3xl:w-64 3xl:p-4">
      <NavigationHeader isMobileNavOpen={isMobileNavOpen} setIsMobileNavOpen={setIsMobileNavOpen} />
      <Separator className="sr-only bg-primary-200 2xl:not-sr-only 2xl:h-px" />
      <nav
        className={cn("2xl:flex 2xl:h-full 2xl:flex-col 2xl:justify-between", {
          "flex h-[calc(100dvh-4rem)] flex-col justify-between gap-y-3 bg-primary-50 px-4 pb-4 pt-7 2xl:bg-transparent 2xl:p-0":
            isMobileNavOpen,
          "sr-only 2xl:not-sr-only": !isMobileNavOpen,
        })}
      >
        <TooltipProvider>
          <NavigationMenu
            menuItems={menuItems}
            role={role}
            setIsMobileNavOpen={setIsMobileNavOpen}
          />
          <NavigationFooter setIsMobileNavOpen={setIsMobileNavOpen} />
        </TooltipProvider>
      </nav>
    </header>
  );
}
