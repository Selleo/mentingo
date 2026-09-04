import { type MetaFunction, Outlet, redirect, useLocation, useNavigate } from "@remix-run/react";
import { PERMISSIONS, type PermissionKey } from "@repo/shared";
import { Suspense, useLayoutEffect } from "react";
import { match } from "ts-pattern";

import { currentUserQueryOptions } from "~/api/queries";
import { queryClient } from "~/api/queryClient";
import { hasAnyPermission } from "~/common/permissions/permission.utils";
import { RouteGuard } from "~/Guards/RouteGuard";
import { usePermissions } from "~/hooks/usePermissions";
import { cn } from "~/lib/utils";
import { saveEntryToNavigationHistory } from "~/utils/saveEntryToNavigationHistory";
import { setPageTitle } from "~/utils/setPageTitle";

import Loader from "../common/Loader/Loader";

import type { PropsWithChildren } from "react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.admin");

export const clientLoader = async ({ request }: { request: Request }) => {
  try {
    const user = await queryClient.ensureQueryData(currentUserQueryOptions);

    if (!user) {
      saveEntryToNavigationHistory(request);

      throw redirect("/auth/login");
    }
  } catch (error) {
    throw redirect("/auth/login");
  }

  return null;
};

const AdminGuard = ({ children }: PropsWithChildren) => {
  const { permissions } = usePermissions();
  const navigate = useNavigate();

  const isAllowed = canAccessAdminLayout(permissions);

  useLayoutEffect(() => {
    if (!isAllowed) {
      navigate("/");
    }
  }, [isAllowed, navigate]);

  if (!isAllowed) return null;

  return <>{children}</>;
};

const ADMIN_LAYOUT_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.USER_MANAGE,
  PERMISSIONS.COURSE_UPDATE_OWN,
  PERMISSIONS.LEARNING_PATH_CREATE,
  PERMISSIONS.LEARNING_PATH_UPDATE,
  PERMISSIONS.LEARNING_PATH_UPDATE_OWN,
  PERMISSIONS.LEARNING_PATH_COURSE_UPDATE,
  PERMISSIONS.LEARNING_PATH_COURSE_UPDATE_OWN,
  PERMISSIONS.LEARNING_PATH_DELETE,
  PERMISSIONS.LEARNING_PATH_ENROLLMENT,
  PERMISSIONS.LEARNING_PATH_EXPORT,
];

export const canAccessAdminLayout = (permissions: PermissionKey[]) =>
  hasAnyPermission(permissions, ADMIN_LAYOUT_PERMISSIONS);

export const shouldHideTopbarAndSidebar = (pathname: string) =>
  match(pathname)
    .with("/admin/beta-courses/new", () => true)
    .with("/admin/beta-courses/new/standard", () => true)
    .with("/admin/courses/new-scorm", () => true)
    .otherwise(() => false);

const AdminLayout = () => {
  const { pathname } = useLocation();

  return (
    <main
      className={cn("max-h-dvh flex-1 overflow-y-auto bg-primary-50", {
        "bg-white p-0": shouldHideTopbarAndSidebar(pathname),
      })}
    >
      <Suspense fallback={<Loader />}>
        <AdminGuard>
          <RouteGuard>
            <Outlet />
          </RouteGuard>
        </AdminGuard>
      </Suspense>
    </main>
  );
};

export default AdminLayout;
