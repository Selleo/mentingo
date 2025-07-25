import { redirect } from "@remix-run/react";

import { currentUserQueryOptions, useCurrentUser } from "~/api/queries/useCurrentUser";
import { queryClient } from "~/api/queryClient";
import { Dashboard } from "~/modules/Dashboard/Dashboard";

import { useSyncUserAfterProviderLogin } from "./hooks/useSyncUserAfterProviderLogin";

export const clientLoader = async () => {
  try {
    const user = await queryClient.ensureQueryData(currentUserQueryOptions);

    if (!user) {
      throw redirect("/auth/login");
    }
  } catch (error) {
    throw redirect("/auth/login");
  }

  return null;
};

export default function UserDashboardLayout() {
  const { data: user } = useCurrentUser();

  useSyncUserAfterProviderLogin(user);

  const isAuthenticated = Boolean(user);

  return <Dashboard isAuthenticated={isAuthenticated} />;
}
