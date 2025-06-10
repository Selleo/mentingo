import { currentUserQueryOptions, useCurrentUser } from "~/api/queries/useCurrentUser";
import { queryClient } from "~/api/queryClient";
import { Dashboard } from "~/modules/Dashboard/Dashboard";

export const clientLoader = async () => {
  await queryClient.fetchQuery(currentUserQueryOptions);

  return null;
};

export default function PublicDashboardLayout() {
  const { data: user } = useCurrentUser();

  const isAuthenticated = Boolean(user);

  return (
    <Dashboard isAuthenticated={isAuthenticated} />
  )
}
