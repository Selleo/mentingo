import { useEffect, useState, Fragment } from "react";

import { Separator } from "~/components/ui/separator";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";

import { NavigationFooter } from "./NavigationFooter";
import { NavigationGlobalSearchWrapper } from "./NavigationGlobalSearchWrapper";
import { NavigationHeader } from "./NavigationHeader";
import { NavigationMenu } from "./NavigationMenu";
import { useMobileNavigation } from "./useMobileNavigation";

import type { LeafMenuItem, NavigationGroups } from "~/config/navigationConfig";
import type { UserRole } from "~/utils/userRoles";

type DashboardNavigationProps = { menuItems: NavigationGroups[] };

export function Navigation({ menuItems }: DashboardNavigationProps) {
  const { isMobileNavOpen, setIsMobileNavOpen } = useMobileNavigation();
  const { role } = useUserRole();
  const [is2xlBreakpoint, setIs2xlBreakpoint] = useState(false);

  useEffect(() => {
    const updateBreakpoint = () => {
      setIs2xlBreakpoint(window.innerWidth >= 1440);
    };
    updateBreakpoint();
    window.addEventListener("resize", updateBreakpoint);
    return () => {
      window.removeEventListener("resize", updateBreakpoint);
    };
  }, []);

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
          is2xlBreakpoint={is2xlBreakpoint}
        />

        {is2xlBreakpoint && <NavigationGlobalSearchWrapper />}

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
