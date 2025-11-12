import { Link } from "@remix-run/react";

import { MobileMenuToggle } from "~/components/Navigation/MobileMenuToggle";

import { PlatformLogo } from "../PlatformLogo";

import { NavigationGlobalSearchWrapper } from "./NavigationGlobalSearchWrapper";

import type { Dispatch, SetStateAction } from "react";

type NavigationHeaderProps = {
  isMobileNavOpen: boolean;
  setIsMobileNavOpen: Dispatch<SetStateAction<boolean>>;
  is2xlBreakpoint: boolean;
  hasConfigurationIssues?: boolean;
};

export function NavigationHeader({
  isMobileNavOpen,
  setIsMobileNavOpen,
  is2xlBreakpoint,
  hasConfigurationIssues,
}: NavigationHeaderProps) {
  return (
    <div className="flex w-full items-center justify-between px-4 py-3 md:px-6 2xl:h-20 2xl:justify-center 2xl:p-0 3xl:px-8">
      <Link to="/" aria-label="Go to homepage">
        <PlatformLogo
          variant="full"
          className="h-10 w-full 2xl:sr-only 3xl:not-sr-only 3xl:h-10"
          alt="Go to homepage"
        />

        <PlatformLogo
          variant="signet"
          className="sr-only 2xl:not-sr-only 2xl:size-12 3xl:sr-only"
          alt="Go to homepage"
        />
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
