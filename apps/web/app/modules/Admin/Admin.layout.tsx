import { type MetaFunction, Outlet, redirect, useLocation, useNavigate } from "@remix-run/react";
import { Suspense, useLayoutEffect } from "react";
import { match } from "ts-pattern";

import { currentUserQueryOptions } from "~/api/queries";
import { useLatestUnreadAnnouncements } from "~/api/queries/useLatestUnreadNotifications";
import { queryClient } from "~/api/queryClient";
import { RouteGuard } from "~/Guards/RouteGuard";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";
import { saveEntryToNavigationHistory } from "~/utils/saveEntryToNavigationHistory";
import { setPageTitle } from "~/utils/setPageTitle";

import Loader from "../common/Loader/Loader";
import { LatestAnnouncementsPopup } from "../Dashboard/components";

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

export const shouldHideTopbarAndSidebar = (pathname: string) =>
  match(pathname)
    .with("/admin/beta-courses/new", () => true)
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
