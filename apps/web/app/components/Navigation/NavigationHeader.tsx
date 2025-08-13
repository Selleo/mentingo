import { Link } from "@remix-run/react";

import { Icon } from "~/components/Icon";
import { MobileMenuToggle } from "~/components/Navigation/MobileMenuToggle";

import type { Dispatch, SetStateAction } from "react";

type NavigationHeaderProps = {
  isMobileNavOpen: boolean;
  setIsMobileNavOpen: Dispatch<SetStateAction<boolean>>;
};

export function NavigationHeader({ isMobileNavOpen, setIsMobileNavOpen }: NavigationHeaderProps) {
  return (
    <div className="flex w-full items-center justify-between px-4 py-3 md:px-6 2xl:h-20 2xl:justify-center 2xl:p-0 3xl:px-8">
      <Link to="/" aria-label="Go to homepage">
        <Icon name="AppLogo" className="h-5 w-full 2xl:sr-only 3xl:not-sr-only 3xl:h-5" />
        <Icon name="AppSignet" className="sr-only 2xl:not-sr-only 2xl:size-10 3xl:sr-only" />
      </Link>
      <MobileMenuToggle isMobileNavOpen={isMobileNavOpen} setIsMobileNavOpen={setIsMobileNavOpen} />
    </div>
  );
}
