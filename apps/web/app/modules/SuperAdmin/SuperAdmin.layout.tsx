import { type MetaFunction, Outlet, redirect, useNavigate } from "@remix-run/react";
import { Suspense, useLayoutEffect } from "react";

import { currentUserQueryOptions } from "~/api/queries";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { queryClient } from "~/api/queryClient";
import Loader from "~/modules/common/Loader/Loader";
import { setPageTitle } from "~/utils/setPageTitle";

import type { PropsWithChildren } from "react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.superAdmin");

export const clientLoader = async ({ request: _request }: { request: Request }) => {
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

const SuperAdminGuard = ({ children }: PropsWithChildren) => {
  const { data: currentUser } = useCurrentUser();
  const navigate = useNavigate();

  const isAllowed = Boolean(currentUser?.isManagingTenantAdmin);

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
        <SuperAdminGuard>
          <Outlet />
        </SuperAdminGuard>
      </Suspense>
    </main>
  );
};

export default SuperAdminLayout;
