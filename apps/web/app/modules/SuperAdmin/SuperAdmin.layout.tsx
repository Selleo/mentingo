import { Outlet, useNavigate } from "@remix-run/react";
import { Suspense, useLayoutEffect } from "react";

import { useCurrentUserSuspense } from "~/api/queries/useCurrentUser";
import { RequireAuthenticatedUser } from "~/Guards/RequireAuthenticatedUser";
import Loader from "~/modules/common/Loader/Loader";

import type { PropsWithChildren } from "react";

const SuperAdminGuard = ({ children }: PropsWithChildren) => {
  const { data: currentUser } = useCurrentUserSuspense();
  const navigate = useNavigate();

  const isAllowed = Boolean(currentUser?.isManagingTenantAdmin && !currentUser?.isSupportMode);

  useLayoutEffect(() => {
    if (!isAllowed) {
      navigate("/");
    }
  }, [isAllowed, navigate]);

  if (!isAllowed) return null;

  return <>{children}</>;
};

const SuperAdminLayout = () => {
  return (
    <main className="max-h-dvh flex-1 overflow-y-auto bg-primary-50">
      <Suspense fallback={<Loader />}>
        <RequireAuthenticatedUser>
          <SuperAdminGuard>
            <Outlet />
          </SuperAdminGuard>
        </RequireAuthenticatedUser>
      </Suspense>
    </main>
  );
};

export default SuperAdminLayout;
