import { useCurrentUserSessionSuspense } from "~/api/queries/useCurrentUserSessionSuspense";
import { Dashboard } from "~/modules/Dashboard/Dashboard";
import { useSyncUserAfterLogin } from "~/modules/Dashboard/hooks/useSyncUserAfterLogin";

export default function PublicDashboardLayout() {
  const { data: user } = useCurrentUserSessionSuspense();
  useSyncUserAfterLogin(user);

  const isAuthenticated = Boolean(user);

  return <Dashboard isAuthenticated={isAuthenticated} />;
}
