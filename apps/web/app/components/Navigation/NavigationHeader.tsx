import { Link } from "@remix-run/react";

import { MobileMenuToggle } from "~/components/Navigation/MobileMenuToggle";
import { IS_MONO_DESIGN } from "~/config/designVariant";
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
        "flex w-full items-center justify-between 2xl:justify-center",
        isSidebarCollapsed ? "py-2 2xl:my-4 px-1" : "px-4 py-3 2xl:my-4 md:px-4 2xl:p-0 3xl:px-6",
        IS_MONO_DESIGN && "2xl:my-0 2xl:h-16 2xl:shrink-0 2xl:border-b 2xl:border-border",
        IS_MONO_DESIGN &&
          !isSidebarCollapsed &&
          "2xl:justify-start 2xl:pl-4 2xl:pr-14 3xl:pl-4 3xl:pr-14",
      )}
    >
      <Link
        to="/"
        aria-label="Go to homepage"
        className={cn(IS_MONO_DESIGN && isSidebarCollapsed && "2xl:invisible")}
      >
        {isSidebarCollapsed ? (
          <PlatformLogo variant="signet" className="size-10 md:size-12" alt="Go to homepage" />
        ) : (
          <>
            <PlatformLogo variant="signet" className="size-10 2xl:hidden" alt="Go to homepage" />
            <PlatformLogo
              variant="full"
              className={cn(
                "hidden 2xl:block 2xl:h-16 w-auto max-w-full",
                IS_MONO_DESIGN && "2xl:h-9",
              )}
              alt="Go to homepage"
            />
          </>
        )}
      </Link>
      <div className="flex gap-x-2">
        {!is2xlBreakpoint && <NavigationGlobalSearchWrapper containerClassName="2xl:hidden" />}

        <MobileMenuToggle
          isMobileNavOpen={isMobileNavOpen}
          setIsMobileNavOpen={setIsMobileNavOpen}
          hasConfigurationIssues={hasConfigurationIssues}
        />
      </div>
    </div>
  );
}
