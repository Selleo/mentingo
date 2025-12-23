import { Outlet } from "@remix-run/react";

import { Navigation } from "~/components/Navigation/Navigation";
import { MFAGuard } from "~/Guards/MFAGuard";

export default function NavigationWrapper() {
  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 flex-col overflow-hidden 2xl:flex-row">
        <Navigation />
        <MFAGuard mode="public">
          <Outlet />
        </MFAGuard>
      </div>
    </div>
  );
}
