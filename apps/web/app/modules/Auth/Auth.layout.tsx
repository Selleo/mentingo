import { Outlet } from "@remix-run/react";

import { useCurrentUserStore } from "../common/store/useCurrentUserStore";

export default function AuthLayout() {
  const setHasVerifiedMFA = useCurrentUserStore((state) => state.setHasVerifiedMFA);

  setHasVerifiedMFA(false);

  return (
    <main className="flex h-screen w-screen items-center justify-center">
      <Outlet />
    </main>
  );
}
