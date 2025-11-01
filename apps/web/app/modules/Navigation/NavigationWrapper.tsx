import { Outlet } from "@remix-run/react";

import { Navigation } from "~/components/Navigation/Navigation";

export default function NavigationWrapper() {
  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 flex-col overflow-hidden 2xl:flex-row">
        <Navigation />
        <Outlet />
      </div>
    </div>
  );
}
