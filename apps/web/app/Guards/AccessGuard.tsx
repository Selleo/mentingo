import { useNavigate } from "@remix-run/react";
import { ACCESS_GUARD } from "@repo/shared";
import { useLayoutEffect } from "react";
import { match } from "ts-pattern";

import {
  availableCoursesQueryOptions,
  currentUserQueryOptions,
  studentCoursesQueryOptions,
} from "~/api/queries";
import { categoriesQueryOptions } from "~/api/queries/useCategories";
import { allCoursesQueryOptions } from "~/api/queries/useCourses";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import { USER_ROLE } from "~/config/userRoles";
import Loader from "~/modules/common/Loader/Loader";

import type { AccessGuard } from "@repo/shared";
import type React from "react";

const prefetchQueriesForUser = async (userRole: string | undefined) => {
  await queryClient.prefetchQuery(categoriesQueryOptions());

  return match(userRole)
    .with(USER_ROLE.admin, USER_ROLE.contentCreator, async () => {
      await queryClient.prefetchQuery(allCoursesQueryOptions());
    })
    .with(USER_ROLE.student, async () => {
      await queryClient.prefetchQuery(availableCoursesQueryOptions());
      await queryClient.prefetchQuery(studentCoursesQueryOptions());
    })
    .otherwise(async () => {
      await queryClient.prefetchQuery(availableCoursesQueryOptions());
    });
};

export const clientLoader = async () => {
  const currentUser = await queryClient.ensureQueryData(currentUserQueryOptions);

  const userRole = currentUser?.data?.role;

  await prefetchQueriesForUser(userRole);

  return null;
};

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
