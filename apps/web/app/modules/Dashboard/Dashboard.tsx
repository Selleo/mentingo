import { Link, NavLink, Outlet, useLocation } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useLatestUnreadAnnouncements } from "~/api/queries/useLatestUnreadNotifications";
import { PlatformLogo } from "~/components/PlatformLogo";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { RouteGuard } from "~/Guards/RouteGuard";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { cn } from "~/lib/utils";
import AllArticlesTOC from "~/modules/Articles/AllArticlesTOC";
import { setPageTitle } from "~/utils/setPageTitle";

import Loader from "../common/Loader/Loader";

import { LatestAnnouncementsPopup, MobileNavigationDropdown } from "./components";

import type { MetaFunction } from "@remix-run/react";
import type { TFunction } from "i18next";

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

const PublicHeader = ({
  publicNavigationLinks,
  t,
}: {
  publicNavigationLinks: Array<{ to: string; label: string }>;
  t: TFunction;
}) => (
  <header className="sticky top-0 z-10 w-full">
    <div className="flex w-full items-center justify-between px-4 py-3">
      <Link to="/courses" aria-label={t("navigationSideBar.ariaLabels.goToAvailableCourses")}>
        <PlatformLogo variant="full" className="h-10 w-full" alt="Go to homepage" />
      </Link>
      <div className="flex items-center gap-3">
        <MobileNavigationDropdown
          links={publicNavigationLinks}
          menuLabel={t("navigationSideBar.menu")}
          closeLabel={t("navigationSideBar.close")}
          loginLabel={t("loginView.button.login")}
          signUpLabel={t("loginView.other.signUp")}
        />
        <div className="hidden items-center gap-6 md:flex">
          {publicNavigationLinks.map((link, idx) => (
            <NavLinkItem key={idx} to={link.to} label={link.label} />
          ))}
        </div>
        <Separator className="hidden h-10 md:block" orientation="vertical" />
        <div className="hidden items-center gap-3 md:flex">
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
);

export const Dashboard = ({ isAuthenticated }: DashboardProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const is2xl = useMediaQuery({ minWidth: 1440 });

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

  const enabledForPublic = (featureEnabled?: boolean, publicAccessible?: boolean) =>
    Boolean(featureEnabled && publicAccessible);

  const QAAccessible = enabledForPublic(
    globalSettings?.QAEnabled,
    globalSettings?.unregisteredUserQAAccessibility,
  );

  const newsAccessibleForPublic = enabledForPublic(
    globalSettings?.newsEnabled,
    globalSettings?.unregisteredUserNewsAccessibility,
  );

  const articlesAccessibleForPublic = enabledForPublic(
    globalSettings?.articlesEnabled,
    globalSettings?.unregisteredUserArticlesAccessibility,
  );

  const coursesAccessible = Boolean(globalSettings?.unregisteredUserCoursesAccessibility);
  const isArticlesRoute = pathname.startsWith("/articles");

  if (!isAuthenticated) {
    const publicNavigationLinks = [
      ...(QAAccessible ? [{ to: "/qa", label: t("navigationSideBar.qa") }] : []),
      ...(coursesAccessible ? [{ to: "/courses", label: t("navigationSideBar.courses") }] : []),
      ...(articlesAccessibleForPublic
        ? [{ to: "/articles", label: t("navigationSideBar.articles") }]
        : []),
      ...(newsAccessibleForPublic ? [{ to: "/news", label: t("navigationSideBar.news") }] : []),
    ];

    if (isArticlesRoute) {
      return (
        <div className="flex h-screen w-full flex-col 2xl:grid 2xl:grid-cols-[18rem_1fr] 2xl:grid-rows-[auto_1fr]">
          <div
            className={cn(
              is2xl ? "hidden 2xl:block 2xl:col-start-1 2xl:row-span-2 2xl:row-start-1" : "",
            )}
          >
            <AllArticlesTOC isMobile={!is2xl} />
          </div>

          {!is2xl && <AllArticlesTOC isMobile={true} />}

          <PublicHeader publicNavigationLinks={publicNavigationLinks} t={t} />

          <main className="flex-1 min-h-0 overflow-y-auto bg-primary-50 2xl:col-start-2 2xl:row-start-2">
            <Outlet />
          </main>
        </div>
      );
    }

    return (
      <div className="flex h-screen flex-col w-full">
        <PublicHeader publicNavigationLinks={publicNavigationLinks} t={t} />

        <main className="flex-1 overflow-y-auto bg-primary-50">
          <Outlet />
        </main>
      </div>
    );
  }

  if (isArticlesRoute) {
    return (
      <div className="flex flex-1 overflow-hidden bg-primary-50">
        <div className={cn(is2xl ? "hidden 2xl:block 2xl:w-72 2xl:min-w-72 2xl:shrink-0" : "")}>
          <AllArticlesTOC isMobile={!is2xl} />
        </div>
        {!is2xl && <AllArticlesTOC isMobile={true} />}
        <main className="relative flex-1 overflow-y-auto bg-primary-50">
          <LatestAnnouncementsPopup latestUnreadAnnouncements={latestUnreadAnnouncements || []} />
          <RouteGuard>
            <Outlet />
          </RouteGuard>
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
