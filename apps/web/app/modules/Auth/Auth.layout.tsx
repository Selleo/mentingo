import { Outlet } from "@remix-run/react";

import { currentUserQueryOptions } from "~/api/queries";
import { queryClient } from "~/api/queryClient";
import { MFAGuard } from "~/Guards/MFAGuard";

import { useCurrentUserStore } from "../common/store/useCurrentUserStore";

export const clientLoader = async () => {
  try {
    await queryClient.ensureQueryData(currentUserQueryOptions);
  } catch {
    return null;
  }

  return null;
};

export default function AuthLayout() {
  const setHasVerifiedMFA = useCurrentUserStore((state) => state.setHasVerifiedMFA);

  setHasVerifiedMFA(false);

  return (
    <main className="flex min-h-screen w-screen items-center justify-center">
      <MFAGuard mode="auth">
        <Outlet />
      </MFAGuard>
    </main>
  );
}
