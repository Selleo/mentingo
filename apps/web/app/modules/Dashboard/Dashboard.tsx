import { Link, Outlet } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useLatestUnreadAnnouncements } from "~/api/queries/useLatestUnreadNotifications";
import { Icon } from "~/components/Icon";
import { Navigation } from "~/components/Navigation";
import { Button } from "~/components/ui/button";
import { getNavigationConfig, mapNavigationItems } from "~/config/navigationConfig";
import { RouteGuard } from "~/Guards/RouteGuard";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import Loader from "../common/Loader/Loader";

import { LatestAnnouncementsPopup } from "./components";

type DashboardProps = {
  isAuthenticated: boolean;
};

export const Dashboard = ({ isAuthenticated }: DashboardProps) => {
  const { t } = useTranslation();
  const { currentUser } = useCurrentUserStore();

  const { data: latestUnreadAnnouncements, isLoading } =
    useLatestUnreadAnnouncements(isAuthenticated);

  if (isLoading) {
    return (
      <div className="flex h-full w-full">
        <Loader />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen flex-col">
        <header className="sticky top-0 z-10 w-full">
          <div className="flex w-full justify-between px-4 py-3">
            <Link to="/courses" aria-label={t("navigationSideBar.ariaLabels.goToAvailableCourses")}>
              <Icon name="AppLogo" className="h-10 w-full" />
              <Icon name="AppSignet" className="sr-only" />
            </Link>
            <div className="flex gap-4">
              <Link to="/auth/login">
                <Button variant="outline" className="w-full">
                  {t("loginView.button.login")}
                </Button>
              </Link>
              <Link to="/auth/register">
                <Button className="w-full">{t("loginView.other.signUp")}</Button>
              </Link>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-primary-50">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 flex-col overflow-hidden 2xl:flex-row">
        <Navigation
          menuItems={mapNavigationItems(
            getNavigationConfig(currentUser?.id ?? "", currentUser?.role === "user", t),
          )}
        />
        <main className="relative flex-1 overflow-y-auto bg-primary-50">
          <LatestAnnouncementsPopup latestUnreadAnnouncements={latestUnreadAnnouncements || []} />
          <RouteGuard>
            <Outlet />
          </RouteGuard>
        </main>
      </div>
    </div>
  );
};
