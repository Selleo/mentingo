import { type MetaFunction, Outlet, redirect, useLocation, useNavigate } from "@remix-run/react";
import { Suspense, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { currentUserQueryOptions } from "~/api/queries";
import { useLatestUnreadAnnouncements } from "~/api/queries/useLatestUnreadNotifications";
import { queryClient } from "~/api/queryClient";
import { Navigation } from "~/components/Navigation";
import { getNavigationConfig, mapNavigationItems } from "~/config/navigationConfig";
import { RouteGuard } from "~/Guards/RouteGuard";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import Loader from "../common/Loader/Loader";
import { LatestAnnouncementsPopup } from "../Dashboard/components";

import type { PropsWithChildren } from "react";

export const meta: MetaFunction = () => {
  return [{ title: "Admin" }];
};

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

const AdminGuard = ({ children }: PropsWithChildren) => {
  const { isAdmin, isContentCreator } = useUserRole();
  const navigate = useNavigate();

  const isAllowed = isAdmin || isContentCreator;

  const { data: latestUnreadAnnouncements } = useLatestUnreadAnnouncements(isContentCreator);

  useLayoutEffect(() => {
    if (!isAllowed) {
      navigate("/");
    }
  }, [isAllowed, navigate]);

  if (!isAllowed) return null;

  return (
    <>
      <LatestAnnouncementsPopup latestUnreadAnnouncements={latestUnreadAnnouncements || []} />
      {children}
    </>
  );
};

const AdminLayout = () => {
  const { t } = useTranslation();
  const { currentUser } = useCurrentUserStore();
  const { pathname } = useLocation();

  const hideTopbarAndSidebar = match(pathname)
    .with("/admin/beta-courses/new", () => true)
    .with("/admin/courses/new-scorm", () => true)
    .otherwise(() => false);

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 flex-col overflow-hidden 2xl:flex-row">
        {!hideTopbarAndSidebar && (
          <Navigation
            menuItems={mapNavigationItems(getNavigationConfig(currentUser?.id ?? "", false, t))}
          />
        )}
        <main
          className={cn("max-h-dvh flex-1 overflow-y-auto bg-primary-50", {
            "bg-white p-0": hideTopbarAndSidebar,
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
      </div>
    </div>
  );
};

export default AdminLayout;
