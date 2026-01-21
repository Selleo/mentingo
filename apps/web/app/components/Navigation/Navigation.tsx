import { useLocation } from "@remix-run/react";
import { useEffect, useState, Fragment } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries";
import { useConfigurationState } from "~/api/queries/admin/useConfigurationState";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useStripeConfigured } from "~/api/queries/useStripeConfigured";
import { Icon } from "~/components/Icon";
import { Separator } from "~/components/ui/separator";
import { TooltipProvider } from "~/components/ui/tooltip";
import { getNavigationConfig, mapNavigationItems } from "~/config/navigationConfig";
import { USER_ROLE } from "~/config/userRoles";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";
import { shouldHideTopbarAndSidebar } from "~/modules/Admin/Admin.layout";

import { Button } from "../ui/button";

import { NavigationFooter } from "./NavigationFooter";
import { NavigationGlobalSearchWrapper } from "./NavigationGlobalSearchWrapper";
import { NavigationHeader } from "./NavigationHeader";
import { NavigationMenu } from "./NavigationMenu";
import { useNavigationStore } from "./stores/navigationStore";
import { useMobileNavigation } from "./useMobileNavigation";

import type { LeafMenuItem, NavigationGroups } from "~/config/navigationConfig";
import type { UserRole } from "~/utils/userRoles";

type DashboardNavigationProps = { menuItems?: NavigationGroups[] };

export function Navigation({ menuItems }: DashboardNavigationProps) {
  const { isMobileNavOpen, setIsMobileNavOpen } = useMobileNavigation();
  const { role } = useUserRole();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [is2xlBreakpoint, setIs2xlBreakpoint] = useState(false);
  const [is3xlBreakpoint, setIs3xlBreakpoint] = useState(false);
  const { data: isStripeConfigured } = useStripeConfigured();

  const { data: globalSettings } = useGlobalSettings();

  const { data: user } = useCurrentUser();

  const { data: configurationState } = useConfigurationState({
    enabled: user?.role === USER_ROLE.admin,
  });

  const hasConfigurationIssues =
    user?.role === USER_ROLE.admin &&
    configurationState?.hasIssues &&
    !configurationState?.isWarningDismissed;

  const { isSidebarCollapsed: persistedSidebarCollapsed, toggleSidebarCollapsed } =
    useNavigationStore();

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      setIs2xlBreakpoint(width >= 1440);
      setIs3xlBreakpoint(width >= 1680);
    };
    updateBreakpoint();
    window.addEventListener("resize", updateBreakpoint);
    return () => {
      window.removeEventListener("resize", updateBreakpoint);
    };
  }, []);

  if (!menuItems) {
    menuItems = mapNavigationItems(
      getNavigationConfig(
        t,
        globalSettings?.QAEnabled,
        globalSettings?.newsEnabled,
        globalSettings?.articlesEnabled,
        isStripeConfigured?.enabled,
      ),
    );
  }

  if (!role) return null;

  if (shouldHideTopbarAndSidebar(pathname)) return null;

  const isSidebarCollapsed = !is3xlBreakpoint ? is2xlBreakpoint : persistedSidebarCollapsed;
  const showNavigationLabels = !isSidebarCollapsed || !is2xlBreakpoint;
  const shouldShowTooltips = isSidebarCollapsed && is2xlBreakpoint;
  const showCollapseToggle = is3xlBreakpoint;

  return (
    <TooltipProvider>
      <header
        className={cn(
          "sticky top-0 h-min w-full transition-all duration-300 ease-in-out",
          "2xl:flex 2xl:h-dvh 2xl:flex-col 2xl:gap-y-6 2xl:px-2 2xl:py-4",
          "3xl:static",
          isSidebarCollapsed ? "2xl:w-14 3xl:w-14 3xl:px-2 3xl:py-4" : "3xl:w-64 3xl:p-4",
        )}
      >
        <NavigationHeader
          isMobileNavOpen={isMobileNavOpen}
          setIsMobileNavOpen={setIsMobileNavOpen}
          is2xlBreakpoint={is2xlBreakpoint}
          hasConfigurationIssues={hasConfigurationIssues}
          isSidebarCollapsed={isSidebarCollapsed}
        />

        {is2xlBreakpoint && (
          <div
            className={cn(
              "flex w-full px-2 3xl:px-0",
              isSidebarCollapsed ? "flex-col-reverse items-center gap-3" : "items-center gap-3",
            )}
          >
            <NavigationGlobalSearchWrapper
              useCompactVariant={isSidebarCollapsed}
              containerClassName={cn("w-full", {
                "flex justify-center": isSidebarCollapsed,
              })}
            />
            {showCollapseToggle && (
              <Button
                onClick={toggleSidebarCollapsed}
                className={cn(
                  "flex items-center justify-center rounded-lg bg-neutral-50 text-neutral-900 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-200",
                  isSidebarCollapsed ? "h-10 w-full" : "size-10",
                )}
                size="icon"
              >
                <Icon
                  name={isSidebarCollapsed ? "PanelLeftOpen" : "PanelLeftClose"}
                  className="size-5"
                />
              </Button>
            )}
          </div>
        )}

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
                    showNavigationLabels={showNavigationLabels}
                    shouldShowTooltips={shouldShowTooltips}
                    isSidebarCollapsed={isSidebarCollapsed}
                  />
                  <Separator className="bg-neutral-200 2xl:h-px" />
                </Fragment>
              );
            })}
          </div>

          <NavigationFooter
            setIsMobileNavOpen={setIsMobileNavOpen}
            hasConfigurationIssues={hasConfigurationIssues}
            showNavigationLabels={showNavigationLabels}
            shouldShowTooltips={shouldShowTooltips}
            isSidebarCollapsed={isSidebarCollapsed}
          />
        </nav>
      </header>
    </TooltipProvider>
  );
}
