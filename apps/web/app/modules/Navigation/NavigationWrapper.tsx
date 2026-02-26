import { Outlet } from "@remix-run/react";

import { useCurrentUser } from "~/api/queries";
import { Navigation } from "~/components/Navigation/Navigation";
import { MFAGuard } from "~/Guards/MFAGuard";
import { cn } from "~/lib/utils";
import { SupportModeBanner } from "~/modules/SupportMode/SupportModeBanner";

export default function NavigationWrapper() {
  const { data: currentUser } = useCurrentUser();

  return (
    <div
      className={cn("flex h-screen flex-col", {
        "min-h-screen border-2 border-warning-600": currentUser?.isSupportMode,
      })}
    >
      <SupportModeBanner />
      <div className="flex flex-1 flex-col overflow-hidden 2xl:flex-row">
        <Navigation />
        <MFAGuard mode="public">
          <Outlet />
        </MFAGuard>
      </div>
    </div>
  );
}
