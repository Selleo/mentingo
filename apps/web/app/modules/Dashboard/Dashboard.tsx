import { Link, Outlet } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useLatestUnreadAnnouncements } from "~/api/queries/useLatestUnreadNotifications";
import { PlatformLogo } from "~/components/PlatformLogo";
import { Button } from "~/components/ui/button";
import { RouteGuard } from "~/Guards/RouteGuard";
import { setPageTitle } from "~/utils/setPageTitle";

import Loader from "../common/Loader/Loader";

import { LatestAnnouncementsPopup } from "./components";

import type { MetaFunction } from "@remix-run/react";

type DashboardProps = {
  isAuthenticated: boolean;
};

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.dashboard");

export const Dashboard = ({ isAuthenticated }: DashboardProps) => {
  const { t } = useTranslation();

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
              <PlatformLogo variant="full" className="h-10 w-full" alt="Go to homepage" />
            </Link>
            <div className="flex gap-4">
              <Link to="/news">
                <Button variant="outline" className="w-full">
                  {t("navigationSideBar.news")}
                </Button>
              </Link>
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
    <main className="relative flex-1 overflow-y-auto bg-primary-50">
      <LatestAnnouncementsPopup latestUnreadAnnouncements={latestUnreadAnnouncements || []} />
      <RouteGuard>
        <Outlet />
      </RouteGuard>
    </main>
  );
};
