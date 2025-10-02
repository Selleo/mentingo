import { Link } from "@remix-run/react";
import { AnimatePresence, motion } from "motion/react";

import { MobileMenuToggle } from "~/components/Navigation/MobileMenuToggle";

import { PlatformLogo } from "../PlatformLogo";

import { NavigationGlobalSearch } from "./NavigationGlobalSearch";

import type { Dispatch, SetStateAction } from "react";

type NavigationHeaderProps = {
  isMobileNavOpen: boolean;
  setIsMobileNavOpen: Dispatch<SetStateAction<boolean>>;
  isExpanded?: boolean;
};

export function NavigationHeader({
  isMobileNavOpen,
  setIsMobileNavOpen,
  isExpanded = false,
}: NavigationHeaderProps) {
  return (
    <div className="flex w-full items-center justify-between px-4 py-3 md:px-6 2xl:h-20 2xl:justify-center 2xl:p-0 3xl:px-8">
      <Link to="/" aria-label="Go to homepage">
        <PlatformLogo
          variant="full"
          className="h-6 w-full 2xl:sr-only 3xl:not-sr-only 3xl:h-10"
          alt="Go to homepage"
        />

        <div className="sr-only 2xl:not-sr-only 3xl:sr-only">
          <AnimatePresence mode="wait" initial={false}>
            {isExpanded ? (
              <motion.div
                key="full"
                initial={{ opacity: 0, scale: 0.8, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: -10 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="h-10 w-full"
              >
                <PlatformLogo variant="full" className="h-10 w-full" alt="Go to homepage" />
              </motion.div>
            ) : (
              <motion.div
                key="signet"
                initial={{ opacity: 0, scale: 0.8, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 10 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="size-12"
              >
                <PlatformLogo variant="signet" className="size-12" alt="Go to homepage" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Link>
      <div className="flex gap-x-2">
        <NavigationGlobalSearch wrapperClassName="not-sr-only 2xl:sr-only" className="h-10" />

        <MobileMenuToggle
          isMobileNavOpen={isMobileNavOpen}
          setIsMobileNavOpen={setIsMobileNavOpen}
        />
      </div>
    </div>
  );
}
