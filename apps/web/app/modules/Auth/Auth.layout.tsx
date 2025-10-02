import { Outlet, redirect } from "@remix-run/react";

import { currentUserQueryOptions } from "~/api/queries";
import { queryClient } from "~/api/queryClient";

import { useCurrentUserStore } from "../common/store/useCurrentUserStore";

import { LOGIN_REDIRECT_URL } from "./constants";

import type { CurrentUserResponse } from "~/api/generated-api";

export const clientLoader = async () => {
  let user: CurrentUserResponse | null = null;

  try {
    user = await queryClient.ensureQueryData(currentUserQueryOptions);
  } catch {
    return null;
  }

  if (user) {
    throw redirect(LOGIN_REDIRECT_URL);
  }

  return null;
};

export default function AuthLayout() {
  const setHasVerifiedMFA = useCurrentUserStore((state) => state.setHasVerifiedMFA);

  setHasVerifiedMFA(false);

  return (
    <main className="flex h-screen w-screen items-center justify-center">
      <Outlet />
    </main>
  );
}
