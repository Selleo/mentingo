import { Link, NavLink, Outlet } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useLatestUnreadAnnouncements } from "~/api/queries/useLatestUnreadNotifications";
import { PlatformLogo } from "~/components/PlatformLogo";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { RouteGuard } from "~/Guards/RouteGuard";
import { cn } from "~/lib/utils";
import { setPageTitle } from "~/utils/setPageTitle";

import Loader from "../common/Loader/Loader";

import { LatestAnnouncementsPopup, PublicMobileNavigationDropdown } from "./components";

import type { MetaFunction } from "@remix-run/react";

type DashboardProps = {
  isAuthenticated: boolean;
};

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.dashboard");

const NavLinkItem = ({ to, label }: { to: string; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      cn(
        "relative text-gray-700 transition-colors hover:text-primary before:absolute before:-bottom-1 before:left-0 before:h-0.5 before:bg-primary before:transition-all before:duration-300 before:w-0 hover:before:w-full",
        { "text-primary before:w-full": isActive },
      )
    }
  >
    {label}
  </NavLink>
);

export const Dashboard = ({ isAuthenticated }: DashboardProps) => {
  const { t } = useTranslation();

  const { data: globalSettings } = useGlobalSettings();

  const { data: latestUnreadAnnouncements, isLoading } =
    useLatestUnreadAnnouncements(isAuthenticated);

  if (isLoading) {
    return (
      <div className="flex h-full w-full">
        <Loader />
      </div>
    );
  }

  const QAAccessible = globalSettings?.QAEnabled && globalSettings?.unregisteredUserQAAccessibility;
  const coursesAccessible = globalSettings?.unregisteredUserCoursesAccessibility;

  if (!isAuthenticated) {
    const publicNavigationLinks = [
      ...(QAAccessible ? [{ to: "/qa", label: t("navigationSideBar.qa") }] : []),
      ...(coursesAccessible ? [{ to: "/courses", label: t("navigationSideBar.courses") }] : []),
    ];

    return (
      <div className="flex h-screen flex-col w-full">
        <header className="sticky top-0 z-10 w-full">
          <div className="flex w-full items-center justify-between px-4 py-3">
            <Link to="/courses" aria-label={t("navigationSideBar.ariaLabels.goToAvailableCourses")}>
              <PlatformLogo variant="full" className="h-10 w-full" alt="Go to homepage" />
            </Link>
            <div className="flex items-center gap-3">
              <PublicMobileNavigationDropdown
                links={publicNavigationLinks}
                menuLabel={t("navigationSideBar.menu")}
                closeLabel={t("navigationSideBar.close")}
                loginLabel={t("loginView.button.login")}
                signUpLabel={t("loginView.other.signUp")}
              />
              <div className="hidden items-center gap-6 md:flex">
                {QAAccessible && <NavLinkItem to="/qa" label={t("navigationSideBar.qa")} />}
                {coursesAccessible && (
                  <NavLinkItem to="/courses" label={t("navigationSideBar.courses")} />
                )}
              </div>
              <Separator className="hidden h-10 md:block" orientation="vertical" />
              <div className="hidden items-center gap-3 md:flex">
                <Link to="/articles">
                  <Button variant="outline" className="w-full">
                    {t("navigationSideBar.articles")}
                  </Button>
                </Link>
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
