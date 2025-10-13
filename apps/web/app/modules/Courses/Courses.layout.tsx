import { useNavigate } from "@remix-run/react";
import { useLayoutEffect, type PropsWithChildren } from "react";
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

import type { ParentRouteData } from "../layout";
import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = ({ matches }) => {
  const parentMatch = matches.find((match) => match.id.includes("layout"));
  const companyShortName = (parentMatch?.data as ParentRouteData)?.companyInfo?.data
    ?.companyShortName;
  const title = companyShortName ? `${companyShortName} - Courses` : "Courses";

  return [{ title }];
};

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

export const CoursesAccessGuard = ({ children }: PropsWithChildren) => {
  const { data: globalSettings } = useGlobalSettings();
  const { data: currentUser } = useCurrentUser();
  const navigate = useNavigate();

  const isLoggedIn = !!currentUser;
  const hasUnregisteredAccess = globalSettings?.unregisteredUserCoursesAccessibility;
  const hasAccess = isLoggedIn || hasUnregisteredAccess;

  useLayoutEffect(() => {
    if (globalSettings !== undefined && !hasAccess) {
      navigate("/auth/login");
    }
  }, [hasAccess, navigate, globalSettings]);

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
