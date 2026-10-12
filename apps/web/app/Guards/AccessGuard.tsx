import { useNavigate } from "@remix-run/react";
import { ACCESS_GUARD, type AccessGuard } from "@repo/shared";
import { useLayoutEffect } from "react";
import { match } from "ts-pattern";

import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { PageWrapper } from "~/components/PageWrapper";
import Loader from "~/modules/common/Loader/Loader";

import type React from "react";

type AccessGuardProps = {
  children: React.ReactElement;
  type: AccessGuard;
};

export const ContentAccessGuard = ({ children, type }: AccessGuardProps) => {
  const { data: globalSettings } = useGlobalSettings();
  const { data: currentUser } = useCurrentUser();
  const navigate = useNavigate();

  const isLoggedIn = !!currentUser;

  const hasAccess = match(type)
    .with(
      ACCESS_GUARD.UNREGISTERED_COURSE_ACCESS,
      () => globalSettings?.unregisteredUserCoursesAccessibility || isLoggedIn,
    )
    .with(
      ACCESS_GUARD.UNREGISTERED_QA_ACCESS,
      () =>
        globalSettings?.QAEnabled &&
        (globalSettings?.unregisteredUserQAAccessibility || isLoggedIn),
    )
    .with(
      ACCESS_GUARD.UNREGISTERED_NEWS_ACCESS,
      () =>
        globalSettings?.newsEnabled &&
        (globalSettings?.unregisteredUserNewsAccessibility || isLoggedIn),
    )
    .with(
      ACCESS_GUARD.UNREGISTERED_ARTICLES_ACCESS,
      () =>
        globalSettings?.articlesEnabled &&
        (globalSettings?.unregisteredUserArticlesAccessibility || isLoggedIn),
    )
    .exhaustive();

  useLayoutEffect(() => {
    if (globalSettings !== undefined && !hasAccess) {
      if (!isLoggedIn) {
        navigate("/auth/login");
      } else {
        navigate("/");
      }
    }
  }, [hasAccess, navigate, globalSettings, isLoggedIn]);

  if (globalSettings === undefined) {
    return (
      <PageWrapper>
        <div className="flex h-full items-center justify-center">
          <Loader />
        </div>
      </PageWrapper>
    );
  }

  if (!hasAccess) return null;

  return <>{children}</>;
};
