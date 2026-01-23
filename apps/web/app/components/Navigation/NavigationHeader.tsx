import { Link } from "@remix-run/react";

import { MobileMenuToggle } from "~/components/Navigation/MobileMenuToggle";
import { cn } from "~/lib/utils";

import { PlatformLogo } from "../PlatformLogo";

import { NavigationGlobalSearchWrapper } from "./NavigationGlobalSearchWrapper";

import type { Dispatch, SetStateAction } from "react";

type NavigationHeaderProps = {
  isMobileNavOpen: boolean;
  setIsMobileNavOpen: Dispatch<SetStateAction<boolean>>;
  is2xlBreakpoint: boolean;
  isSidebarCollapsed: boolean;
  hasConfigurationIssues?: boolean;
};

export function NavigationHeader({
  isMobileNavOpen,
  setIsMobileNavOpen,
  is2xlBreakpoint,
  isSidebarCollapsed,
  hasConfigurationIssues,
}: NavigationHeaderProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between 2xl:h-20 2xl:justify-center",
        isSidebarCollapsed
          ? "px-3 py-2 md:px-4 2xl:px-2 3xl:px-3"
          : "px-4 py-3 md:px-6 2xl:p-0 3xl:px-8",
      )}
    >
      <Link to="/" aria-label="Go to homepage">
        {isSidebarCollapsed ? (
          <PlatformLogo variant="signet" className="size-10 md:size-12" alt="Go to homepage" />
        ) : (
          <PlatformLogo variant="full" className="h-10 w-auto" alt="Go to homepage" />
        )}
      </Link>
      <div className="flex gap-x-2">
        {!is2xlBreakpoint && <NavigationGlobalSearchWrapper />}

        <MobileMenuToggle
          isMobileNavOpen={isMobileNavOpen}
          setIsMobileNavOpen={setIsMobileNavOpen}
          hasConfigurationIssues={hasConfigurationIssues}
        />
      </div>
    </div>
  );
}
